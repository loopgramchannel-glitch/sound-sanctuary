// Browser-safe helpers for the TikTok account importer.
export const ACCOUNT_COUNTS = [10, 15, 25, 50, 100, 500, 1000, 2000, 5000, 10000] as const;

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

/** Parallel downloads for account/pasted-link imports. */
export const IMPORT_WORKERS = 6;

/**
 * Bookmarklet run on a TikTok profile in the owner's own browser: scrolls to the end of the
 * account and copies every video link, ready for "Paste many links".
 */
export const COLLECT_BOOKMARKLET = "javascript:" + encodeURIComponent(`(async()=>{const s=new Set,w=t=>new Promise(r=>setTimeout(r,t));let same=0,last=0;const b=document.createElement('div');b.style.cssText='position:fixed;top:10px;left:10px;z-index:99999;background:#000;color:#fff;padding:10px;border-radius:8px;font:14px sans-serif';document.body.appendChild(b);while(same<6&&s.size<10000){document.querySelectorAll('a[href*="/video/"]').forEach(a=>s.add(a.href.split('?')[0]));b.textContent='Loopgram: found '+s.size+' videos...';window.scrollTo(0,document.body.scrollHeight);await w(1500);same=s.size===last?same+1:0;last=s.size}const t=[...s].join('\\n');try{await navigator.clipboard.writeText(t);b.textContent='Copied '+s.size+' links. Paste them in Loopgram.'}catch(e){prompt('Copy these '+s.size+' links:',t)}})()`);
