// Pure in-memory buffer for views & likes (no network). The server flushes it to Cloudflare D1
// as ONE transaction every few seconds, so a viral video costs one write per server instance per flush,
// not one write per viewer. Shared by post-stats.server.ts and tests.
import type { Vote } from "./post-stats";

export type Stmt = { sql: string; params: (string | number | null)[] };
type Totals = { v: number; l: number; d: number };

/** Adds deltas to a post's permanent total. */
export const addStmt = (id: string, v: number, l: number, d: number, now: number): Stmt => ({
  sql: `INSERT INTO post_stats (post_id, views, likes, dislikes, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(post_id) DO UPDATE SET views = views + excluded.views, likes = likes + excluded.likes,
        dislikes = dislikes + excluded.dislikes, updated_at = excluded.updated_at`,
  params: [id, v, l, d, now],
});

/**
 * One viewer's thumb, applied inside the flush transaction. The like/dislike change is worked out by the
 * database from the vote it already has stored, so a client can never fake its previous vote to add likes.
 */
export function voteStmts(id: string, viewer: string, vote: Vote, now: number): Stmt[] {
  const old = (want: number) => `COALESCE((SELECT CASE WHEN vote = ${want} THEN 1 ELSE 0 END FROM post_votes WHERE post_id = ?1 AND viewer = ?2), 0)`;
  return [
    { sql: "INSERT OR IGNORE INTO post_stats (post_id, views, likes, dislikes, updated_at) VALUES (?1, 0, 0, 0, ?3)", params: [id, viewer, now] },
    {
      sql: `UPDATE post_stats SET likes = MAX(0, likes + ?3 - ${old(1)}), dislikes = MAX(0, dislikes + ?4 - ${old(-1)}), updated_at = ?5 WHERE post_id = ?1`,
      params: [id, viewer, vote === 1 ? 1 : 0, vote === -1 ? 1 : 0, now],
    },
    vote === 0
      ? { sql: "DELETE FROM post_votes WHERE post_id = ?1 AND viewer = ?2", params: [id, viewer] }
      : { sql: "INSERT INTO post_votes (post_id, viewer, vote, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(post_id, viewer) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at", params: [id, viewer, vote, now] },
  ];
}

export class StatBuffer {
  private views = new Map<string, number>();
  /** Latest thumb per viewer+post; a later tap in the same window replaces the earlier one. */
  private votes = new Map<string, { id: string; viewer: string; vote: Vote }>();
  private seen = new Map<string, number>();
  constructor(private dedupeMs: number, private maxKeys = 50_000) {}

  /** True if this viewer's view of this post counts (same viewer inside the window counts once). */
  view(id: string, viewer: string, now: number): boolean {
    const k = `${id}:${viewer}`;
    const until = this.seen.get(k);
    if (until && until > now) return false;
    if (this.seen.size > this.maxKeys) this.seen.clear();
    this.seen.set(k, now + this.dedupeMs);
    this.views.set(id, (this.views.get(id) ?? 0) + 1);
    return true;
  }
  vote(id: string, viewer: string, vote: Vote) {
    if (this.votes.size > this.maxKeys) return; // overloaded: drop rather than run out of memory
    this.votes.set(`${id}:${viewer}`, { id, viewer, vote });
  }
  pendingVote(id: string, viewer: string): Vote | undefined { return this.votes.get(`${id}:${viewer}`)?.vote; }
  pendingViews(id: string): number { return this.views.get(id) ?? 0; }
  get size() { return this.views.size + this.votes.size; }

  /** Empties the buffer into one list of statements (run as one transaction). */
  drain(now: number): { stmts: Stmt[]; restore: () => void; ids: string[] } {
    const views = this.views, votes = this.votes;
    this.views = new Map(); this.votes = new Map();
    const stmts: Stmt[] = [];
    for (const [id, n] of views) stmts.push(addStmt(id, n, 0, 0, now));
    for (const v of votes.values()) stmts.push(...voteStmts(v.id, v.viewer, v.vote, now));
    const ids = [...new Set([...views.keys(), ...[...votes.values()].map((v) => v.id)])];
    // On a failed write, put everything back for the next flush (newer taps win over restored ones).
    const restore = () => {
      for (const [id, n] of views) this.views.set(id, (this.views.get(id) ?? 0) + n);
      for (const [k, v] of votes) if (!this.votes.has(k)) this.votes.set(k, v);
    };
    return { stmts, restore, ids };
  }
}

/**
 * How long to wait between flushes. Quiet sites save every 3s; busy instances wait longer (max 30s)
 * so the total write rate to the single D1 database stays flat no matter how many visitors arrive.
 */
export function flushDelay(pendingKeys: number, jitter = 0): number {
  const base = pendingKeys < 200 ? 3_000 : pendingKeys < 2_000 ? 10_000 : 30_000;
  return Math.round(base * (1 + Math.max(0, Math.min(1, jitter)) * 0.3));
}

/** D1 caps statements per batch; split one big drain into safe-size transactions. */
export function chunkStmts<T>(stmts: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < stmts.length; i += size) out.push(stmts.slice(i, i + size));
  return out;
}

export type { Totals };
