/** True for tiktok.com video links, including vm./vt. short links. */
export function isTikTokUrl(u: string): boolean {
  try {
    const h = new URL(u.trim()).hostname.toLowerCase();
    return h === "tiktok.com" || h.endsWith(".tiktok.com");
  } catch { return false; }
}

/** YouTube video id from watch, youtu.be, shorts, embed and live links; null otherwise. */
export function youTubeId(u: string): string | null {
  try {
    const url = new URL(u.trim());
    const h = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (h === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? null;
    else if (h === "youtube.com" || h === "youtube-nocookie.com") {
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
