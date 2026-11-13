// Owner-only: lists one page of a TikTok account's videos. Each video is then imported through the
// exact same single-link pipeline (studioImportTikTok) so account imports are identical: clean, in R2 forever.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isCleanPlay, type AccountItem } from "./tiktok-account";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export const studioTikTokAccountPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(4096), user: z.string().regex(/^[A-Za-z0-9._]{2,24}$/), cursor: z.string().max(40).default("0") }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth.server");
    await requireOwner(data.token).catch(() => { throw new Error("401: Could not verify session"); });
    let j: any = null;
    for (let i = 0; i < 3 && !j?.data; i++) {
      if (i) await new Promise((r) => setTimeout(r, 1500));
      j = await fetch("https://www.tikwm.com/api/user/posts", {
        method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `unique_id=${encodeURIComponent(data.user)}&count=35&cursor=${encodeURIComponent(data.cursor)}`,
        signal: AbortSignal.timeout(15000),
      }).then((r) => r.json()).catch(() => null);
    }
    if (!j?.data) throw new Error("503: TikTok wouldn't list this account right now. Try again in a minute, or paste the video links instead.");
    const raw: any[] = Array.isArray(j.data.videos) ? j.data.videos : [];
    const items: AccountItem[] = raw.map((v) => ({
      id: String(v.video_id ?? v.aweme_id ?? ""), title: String(v.title ?? "").slice(0, 200), cover: String(v.cover ?? ""), clean: isCleanPlay(v),
    })).filter((v) => /^\d+$/.test(v.id));
    return { items, cursor: String(j.data.cursor ?? ""), hasMore: !!j.data.hasMore && items.length > 0 };
  });
