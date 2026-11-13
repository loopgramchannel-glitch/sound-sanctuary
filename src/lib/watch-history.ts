// Browser-only storage for "Continue watching" (on the viewer's phone; no server cost). Call from effects/handlers only.
import { recordHistory, type HistoryItem } from "./growth";

const KEY = "lg:history:v1";
export const HISTORY_EVENT = "lg-history";

/** Seconds into the video currently on the watch page (for "share at current time"). */
export const playerTime = { id: "", t: 0 };

export function readHistory(): HistoryItem[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function saveProgress(id: string, t: number, d: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(recordHistory(readHistory(), { id, t: Math.floor(t), d: Math.floor(d), at: Date.now() })));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch { /* storage off */ }
}
