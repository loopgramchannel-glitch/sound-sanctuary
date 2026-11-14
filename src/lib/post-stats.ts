// Browser-safe rules for post views & likes (YouTube-style). Shared by server and UI.

/** TikTok-style: a view counts after 1 second of real playback. */
export const VIEW_AFTER_SHORT_S = 1;
export const VIEW_AFTER_VIDEO_S = 1;
/** Shorts keep looping: every further this-many seconds of watching counts as a replay view. */
export const VIEW_REPLAY_S = 15;
/** Anti-spam only: the same viewer can't add views on one post faster than this. */
export const VIEW_DEDUPE_S = 5;

export type Vote = 0 | 1 | -1;
export type PostStats = { views: number; likes: number };

/** YouTube-style short numbers: 999, 1.2K, 12K, 1.2M, 3.4B. */
export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(n || 0));
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [d, u] of units) {
    if (v >= d) {
      const x = v / d;
      const s = x < 10 ? (Math.floor(x * 10) / 10).toString() : Math.floor(x).toString();
      return `${s}${u}`;
    }
  }
  return String(v);
}

export function viewsLabel(n: number): string {
  const v = Math.max(0, Math.floor(n || 0));
  return v === 1 ? "1 view" : `${formatCount(v)} views`;
}

/** Changing a vote from `prev` to `next` moves the like / dislike totals by this much. */
export function voteDelta(prev: Vote, next: Vote): { likes: number; dislikes: number } {
  return {
    likes: (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0),
    dislikes: (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0),
  };
}

/** Tapping the same thumb again clears it (YouTube toggle). */
export function nextVote(current: Vote, tapped: 1 | -1): Vote {
  return current === tapped ? 0 : tapped;
}
