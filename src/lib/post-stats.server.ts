// Post views & likes, counted on Cloudflare only (D1). No Upstash on this path.
// Every server instance keeps a small in-memory buffer and writes it to D1 as one transaction every few
// seconds, so a viral video costs ~1 write per instance per flush instead of 1 per viewer.
import { d1, d1Batch } from "./backend.server";
import { VIEW_DEDUPE_S, type PostStats, type Vote } from "./post-stats";
import { coalesceStats, type StatJob } from "./jobs";
import { addStmt, chunkStmts, flushDelay, StatBuffer } from "./stat-buffer";

const buf = new StatBuffer(VIEW_DEDUPE_S * 1000);
let lastFlush = 0, wait = flushDelay(0, Math.random()), flushing: Promise<void> | null = null;

/** Writes buffered views/likes to D1 (one transaction). Cheap no-op when nothing is waiting or not due. */
export async function flushStats(force = false): Promise<void> {
  const now = Date.now();
  if (!buf.size || flushing || (!force && now - lastFlush < wait)) return flushing ?? undefined;
  lastFlush = now;
  wait = flushDelay(buf.size, Math.random()); // busier instance → fewer, bigger writes; jitter spreads instances out
  const { stmts, restore, ids } = buf.drain(now);
  flushing = (async () => {
    try { for (const part of chunkStmts(stmts)) await d1Batch(part); for (const id of ids) memo.delete(id); }
    catch { restore(); } // D1 busy/down: keep everything for the next flush
  })().finally(() => { flushing = null; });
  return flushing;
}

// ---- Local abuse limit: one instance never lets an address hammer the counters ----
const hits = new Map<string, { n: number; t: number }>();
function allow(key: string, max: number, windowMs = 60_000) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); if (hits.size > 20000) hits.clear(); return true; }
  return ++h.n <= max;
}

/** Counts one real view (same viewer within 30 min = one view). Never waits on a database. */
export async function recordView(id: string, viewer: string, ip: string): Promise<{ counted: boolean }> {
  if (!allow(`v:${ip}`, 120)) return { counted: false };
  const counted = buf.view(id, viewer, Date.now());
  if (counted) void flushStats().catch(() => {});
  return { counted };
}

/** Sets this viewer's thumb. The database works out the like change from the stored vote at flush time. */
export async function setVote(id: string, viewer: string, ip: string, vote: Vote): Promise<{ vote: Vote; likes?: number } | null> {
  if (!allow(`l:${ip}`, 60)) return null;
  buf.vote(id, viewer, vote);
  void flushStats().catch(() => {});
  return { vote };
}

export async function getVote(id: string, viewer: string): Promise<Vote> {
  const pending = buf.pendingVote(id, viewer);
  if (pending !== undefined) return pending;
  try {
    const r = await d1<{ vote: number }>("SELECT vote FROM post_votes WHERE post_id = ?1 AND viewer = ?2", [id, viewer]);
    return (Number(r.results[0]?.vote) || 0) as Vote;
  } catch { return 0; }
}

/** Worker side for stat jobs still sitting in the queue from before: applied exactly once. */
export async function applyStatJobs(jobs: StatJob[]) {
  if (!jobs.length) return;
  const now = Date.now();
  const seen = await d1<{ bid: string }>(`SELECT bid FROM stat_jobs_done WHERE bid IN (${jobs.map((_, n) => `?${n + 1}`).join(",")})`, jobs.map((j) => j.bid));
  const done = new Set(seen.results.map((r) => r.bid));
  const fresh = jobs.filter((j) => !done.has(j.bid));
  if (fresh.length) {
    await d1Batch([
      ...fresh.map((j) => ({ sql: "INSERT OR IGNORE INTO stat_jobs_done (bid, done_at) VALUES (?1, ?2)", params: [j.bid, now] })),
      ...[...coalesceStats(fresh)].map(([id, c]) => addStmt(id, c.views, c.likes, c.dislikes, now)),
    ]);
  }
  if (Math.random() < 0.02) void d1("DELETE FROM stat_jobs_done WHERE done_at < ?1", [now - 7 * 86400_000]).catch(() => {});
  for (const j of jobs) memo.delete(j.id);
}

// ---- Reads: per-instance 10s memo over D1 totals (the public stats endpoint is also edge-cached) ----
const memo = new Map<string, { v: PostStats; exp: number }>();
export async function readStats(ids: string[]): Promise<Record<string, PostStats>> {
  const out: Record<string, PostStats> = {};
  const now = Date.now();
  const need = ids.filter((id) => { const m = memo.get(id); if (m && m.exp > now) { out[id] = m.v; return false; } return true; });
  if (need.length) {
    try {
      for (let i = 0; i < need.length; i += 100) {
        const chunk = need.slice(i, i + 100);
        const r = await d1<{ post_id: string; views: number; likes: number }>(
          `SELECT post_id, views, likes FROM post_stats WHERE post_id IN (${chunk.map((_, n) => `?${n + 1}`).join(",")})`, chunk);
        for (const it of r.results) out[it.post_id] = { views: Math.max(0, Number(it.views) || 0), likes: Math.max(0, Number(it.likes) || 0) };
      }
      for (const id of need) { out[id] ??= { views: 0, likes: 0 }; memo.set(id, { v: out[id]!, exp: now + 10_000 }); }
      if (memo.size > 5000) memo.clear();
    } catch { for (const id of need) out[id] ??= { views: 0, likes: 0 }; } // D1 down: show zeros, don't memo
  }
  // Include views this instance hasn't written yet, so a viewer sees their own view right away.
  for (const id of ids) { const p = buf.pendingViews(id); if (p && out[id]) out[id] = { ...out[id]!, views: out[id]!.views + p }; }
  return out;
}
