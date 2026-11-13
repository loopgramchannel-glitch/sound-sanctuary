// Device alerts: subscriptions live in D1 `push_subs`; broadcast runs when a post first goes public.
import { d1, d1Batch } from "./backend.server";
import { VAPID_PUBLIC_KEY } from "./push-keys";
import { sendPush, type Sub } from "./webpush";

const DDL = "CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL)";
let ready = false;
async function ensure() { if (!ready) { await d1(DDL); ready = true; } }

export async function saveSub(s: Sub) {
  await ensure();
  await d1("INSERT INTO push_subs (endpoint, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth", [s.endpoint, s.p256dh, s.auth, Date.now()]);
}
export async function removeSub(endpoint: string) { await ensure(); await d1("DELETE FROM push_subs WHERE endpoint = ?1", [endpoint]); }

type Alert = { title: string; body: string; url: string; image?: string | undefined };
export const PAGE = 1000;

/** Sends one page (up to PAGE devices after `after`, 50 at a time); dead devices are removed. Returns the next cursor or null when done. */
export async function sendPage(data: Alert, after: string): Promise<{ sent: number; failed: number; next: string | null }> {
  const priv = process.env["VAPID_PRIVATE_KEY"];
  if (!priv) return { sent: 0, failed: 0, next: null };
  await ensure();
  const keys = { pub: VAPID_PUBLIC_KEY, priv, subject: "mailto:loopgramplus@gmail.com" };
  const page = (await d1<Sub>("SELECT endpoint, p256dh, auth FROM push_subs WHERE endpoint > ?1 ORDER BY endpoint LIMIT ?2", [after, PAGE])).results;
  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (let i = 0; i < page.length; i += 50) {
    const res = await Promise.all(page.slice(i, i + 50).map((s) => sendPush(s, data, keys).catch(() => 0)));
    res.forEach((st, j) => { if (st >= 200 && st < 300) sent++; else { failed++; if (st === 404 || st === 410) dead.push(page[i + j]!.endpoint); } });
  }
  if (dead.length) await d1Batch(dead.map((e) => ({ sql: "DELETE FROM push_subs WHERE endpoint = ?1", params: [e] }))).catch(() => {});
  return { sent, failed, next: page.length === PAGE ? page[page.length - 1]!.endpoint : null };
}

/** Background page: send it, then queue the next one. Any number of devices, no single long run. */
export async function runPushJob(j: Alert & { bid: string; after: string }) {
  const r = await sendPage(j, j.after);
  if (r.next) {
    const { sendJob } = await import("./queue.server");
    await sendJob({ kind: "pushpage", bid: j.bid, after: r.next, title: j.title, body: j.body, url: j.url, image: j.image });
  }
}

/** Sends the first page right away (fast for small audiences), the rest goes to the background queue page by page. */
export async function broadcast(data: Alert) {
  const r = await sendPage(data, "");
  let queued = false;
  if (r.next) {
    const { sendJob } = await import("./queue.server");
    queued = await sendJob({ kind: "pushpage", bid: crypto.randomUUID(), after: r.next, ...data });
  }
  return { sent: r.sent, failed: r.failed, queued };
}
