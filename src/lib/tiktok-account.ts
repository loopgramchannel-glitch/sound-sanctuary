// Browser-safe helpers for the TikTok account importer.
export const ACCOUNT_COUNTS = [100, 500, 1000, 2000, 5000, 10000] as const;

/** "@name", "name" or a tiktok.com/@name link → "name"; null when it isn't a username. */
export function tiktokHandle(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/tiktok\.com\/@([A-Za-z0-9._]{2,24})/) ?? s.match(/^@?([A-Za-z0-9._]{2,24})$/);
  return m ? m[1]! : null;
}

export type AccountItem = { id: string; title: string; cover: string; clean: boolean };

/** Clean-play filter: only real videos with a watermark-free stream; photo slideshows and broken posts are dropped. */
export function isCleanPlay(v: { images?: unknown; play?: string; hdplay?: string }): boolean {
  if (Array.isArray(v.images) && v.images.length) return false;
  return !!(v.hdplay || v.play);
}

/** Links in pasted text that point to single TikTok videos, deduped by video id. */
export function videoLinks(text: string): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const u of text.match(/https?:\/\/\S+/g) ?? []) {
    if (!/tiktok\.com/i.test(u)) continue;
    const id = u.match(/\/video\/(\d+)/)?.[1] ?? u;
    if (!seen.has(id)) { seen.add(id); out.push(u); }
  }
  return out;
}
