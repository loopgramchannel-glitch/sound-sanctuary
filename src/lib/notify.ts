// On-device notification inbox. Private entries (owner imports, account/security) never leave this browser.
export type Note = { id: string; kind: "video" | "short" | "import" | "account"; title: string; body: string; at: number; href?: string; image?: string; private?: boolean };
const KEY = "lg:notes", SEEN = "lg:notes-seen";
const subs = new Set<() => void>();
const read = (): Note[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const localNotes = read;
export function seenAt(): number { return Number(localStorage.getItem(SEEN) || 0); }
export function markAllRead() { localStorage.setItem(SEEN, String(Date.now())); subs.forEach((f) => f()); }
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
/** Adds a private, on-device notification (never sent to other visitors). */
export function notify(n: Omit<Note, "id" | "at" | "private">) {
  if (typeof window === "undefined") return;
  const list = [{ ...n, id: `${n.kind}-${Date.now()}`, at: Date.now(), private: true }, ...read()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(list)); subs.forEach((f) => f());
}
/** Unread = newer than the last time the bell was opened. */
export function unreadCount(notes: Pick<Note, "at">[], seen: number): number { return notes.filter((n) => n.at > seen).length; }
