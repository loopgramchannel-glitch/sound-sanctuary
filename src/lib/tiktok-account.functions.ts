// Owner-only: lists one page of a TikTok account's videos. Each video is then imported through the
// exact same single-link pipeline (studioImportTikTok) so account imports are identical: clean, in R2 forever.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isCleanPlay, type AccountItem } from "./tiktok-account";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export const studioTikTokAccountPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(4096), user: z.string().regex(/^[A-Za-z0-9._]{2,24}$/), cursor: z.string().max(300).default("0") }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth.server");
    await requireOwner(data.token).catch(() => { throw new Error("401: Could not verify session"); });
    // 1) TikTok's own creator feed: pages through the whole account, newest first (no keys needed).
    const feed = await viaCreatorFeed(data.user, data.cursor).catch(() => null);
    if (feed && (feed.items.length || data.cursor !== "0")) return feed;
    let j: any = null;
    if (data.cursor === "0" || !data.cursor.includes("|")) {
      j = await fetch("https://www.tikwm.com/api/user/posts", {
        method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `unique_id=${encodeURIComponent(data.user)}&count=35&cursor=${encodeURIComponent(data.cursor)}`,
        signal: AbortSignal.timeout(6000),
      }).then((r) => r.json()).catch(() => null);
    }
    if (!j?.data) {
      if (data.cursor !== "0") return { items: [] as AccountItem[], cursor: "", hasMore: false };
      const items = await viaEmbed(data.user);
      if (!items.length) throw new Error("503: TikTok wouldn't list this account right now. Try again in a minute, or paste the video links instead.");
      return { items, cursor: "", hasMore: false };
    }
    const raw: any[] = Array.isArray(j.data.videos) ? j.data.videos : [];
    const items: AccountItem[] = raw.map((v) => ({
      id: String(v.video_id ?? v.aweme_id ?? ""), title: String(v.title ?? "").slice(0, 200), cover: String(v.cover ?? ""), clean: isCleanPlay(v),
    })).filter((v) => /^\d+$/.test(v.id));
    return { items, cursor: String(j.data.cursor ?? ""), hasMore: !!j.data.hasMore && items.length > 0 };
  });

/** TikTok's public profile embed: lists the account's most recent videos (about 10-15, no paging). */
export async function viaEmbed(user: string): Promise<AccountItem[]> {
  const r = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(user)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const html = await r.text();
  for (const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let d: any; try { d = JSON.parse(m[1]!); } catch { continue; }
    const src = d?.source?.data; if (!src) continue;
    for (const v of Object.values<any>(src)) {
      if (!Array.isArray(v?.videoList)) continue;
      return v.videoList.map((x: any) => ({ id: String(x.id ?? ""), title: String(x.title ?? x.desc ?? "").slice(0, 200), cover: String(x.coverUrl ?? ""), clean: true }))
        .filter((x: AccountItem) => /^\d+$/.test(x.id));
    }
  }
  return [];
}

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Cursor format: "<secUid>|<ms timestamp>". Page 1 ("0") looks the secUid up from the profile page. */
export async function viaCreatorFeed(user: string, cursor: string) {
  let secUid = "", ms = Date.now();
  if (cursor.includes("|")) { const [a, b] = cursor.split("|"); secUid = a!; ms = Number(b) || ms; }
  else {
    const html = await fetch(`https://www.tiktok.com/@${encodeURIComponent(user)}`, { headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(12000) }).then((r) => r.text());
    secUid = html.match(/"secUid":"([^"]+)"/)?.[1] ?? "";
  }
  if (!secUid) return null;
  const device = String(7_000_000_000_000_000_000n + BigInt(Math.floor(Math.random() * 1e15)));
  const q = new URLSearchParams({ aid: "1988", app_language: "en", app_name: "tiktok_web", count: "35", cursor: String(ms), device_id: device, device_platform: "web_pc", secUid, type: "1" });
  let j: any = null;
  for (let i = 0; i < 3 && !Array.isArray(j?.itemList); i++) {
    j = await fetch(`https://www.tiktok.com/api/creator/item_list/?${q}`, { headers: { "User-Agent": DESKTOP_UA, Referer: `https://www.tiktok.com/@${user}` }, signal: AbortSignal.timeout(12000) })
      .then((r) => r.json()).catch(() => null);
  }
  const list: any[] = Array.isArray(j?.itemList) ? j.itemList : [];
  const items: AccountItem[] = list.map((v) => ({
    id: String(v.id ?? ""), title: String(v.desc ?? "").slice(0, 200), cover: String(v.video?.cover ?? ""),
    clean: !v.imagePost && !!(v.video?.playAddr || v.video?.downloadAddr || v.video?.duration),
  })).filter((v) => /^\d+$/.test(v.id));
  const last = Number(list[list.length - 1]?.createTime) * 1000;
  const hasMore = !!j?.hasMorePrevious && items.length > 0 && last > 0 && last < ms;
  return { items, cursor: hasMore ? `${secUid}|${last}` : "", hasMore };
}
