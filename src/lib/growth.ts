// Browser-safe, pure helpers for growth features (share previews, timestamps, watch history, up next).
import type { PostT } from "./posts";
import { parseVideoSource } from "./video-source";

/** Absolute https URL or null (social apps ignore relative or http images). */
export const absHttps = (u?: string) => (u && /^https:\/\//i.test(u) ? u : null);

/** Share preview tags for one video page. */
export function postShareMeta(p: Pick<PostT, "id" | "title" | "text" | "imageUrl" | "videoUrl"> | null | undefined) {
  if (!p) return [{ title: "Watch — LoopgramChannel" }];
  const title = `${p.title || "Video"} — LoopgramChannel`;
  const desc = (p.text || `Watch ${p.title || "this video"} on LoopgramChannel.`).replace(/\s+/g, " ").slice(0, 160);
  const img = absHttps(p.imageUrl) ?? absHttps(p.videoUrl ? parseVideoSource(p.videoUrl).thumb : undefined);
  const mp4 = absHttps(p.videoUrl) && /\.mp4(\?|$)/i.test(p.videoUrl) ? p.videoUrl : null;
  return [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:type", content: "video.other" },
    { property: "og:url", content: `/post/${p.id}` },
    { name: "twitter:card", content: "summary_large_image" },
    ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
    ...(mp4 ? [{ property: "og:video", content: mp4 }, { property: "og:video:type", content: "video/mp4" }] : []),
  ];
}

/** Share link that opens at the given second (whole seconds; under 3s shares from the start). */
export function shareUrlAt(base: string, seconds: number): string {
  const u = new URL(base);
  u.searchParams.delete("t");
  const s = Math.floor(seconds);
  if (s >= 3) u.searchParams.set("t", String(s));
  return u.toString();
}

/** Start second from a "?t=" value: "45", "45s", "1m30s". 0 when absent or invalid. */
export function parseStartTime(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw.trim());
  if (!m || !m[0]) return 0;
  const n = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return n > 0 && n < 86400 ? n : 0;
}

export type HistoryItem = { id: string; t: number; d: number; at: number };
export const HISTORY_MAX = 30;

/** Adds/updates one entry, newest first, capped. Finished videos (≥95%) leave "continue watching". */
export function recordHistory(list: HistoryItem[], item: HistoryItem): HistoryItem[] {
  const rest = list.filter((h) => h.id !== item.id);
  const done = item.d > 0 && item.t / item.d >= 0.95;
  return (done ? rest : [item, ...rest]).slice(0, HISTORY_MAX);
}

/** Posts to show under "Continue watching": started (≥5s), still published, in history order. */
export function continueWatching(list: HistoryItem[], posts: PostT[]): { post: PostT; progress: number }[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  return list
    .filter((h) => h.t >= 5 && byId.has(h.id))
    .map((h) => ({ post: byId.get(h.id)!, progress: h.d > 0 ? Math.min(1, h.t / h.d) : 0 }));
}

/** YouTube player message → { state, time } (state 1 = playing, 0 = ended); null for anything else. */
export function readYouTubeMsg(data: unknown): { state?: number; time?: number } | null {
  let d: any = data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== "object") return null;
  if (d.event === "onStateChange" && typeof d.info === "number") return { state: d.info };
  if (d.event === "infoDelivery" && d.info && typeof d.info === "object") {
    const out: { state?: number; time?: number } = {};
    if (typeof d.info.playerState === "number") out.state = d.info.playerState;
    if (typeof d.info.currentTime === "number") out.time = d.info.currentTime;
    return out;
  }
  return null;
}
export const isYouTubeEnded = (data: unknown) => readYouTubeMsg(data)?.state === 0;

/** The video that auto-plays after this one ends. */
export const nextUp = (upNext: PostT[]) => upNext[0] ?? null;
export const UP_NEXT_SECONDS = 5;
