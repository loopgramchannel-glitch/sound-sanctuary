// Owner-only TikTok importer: resolves a TikTok link to its clean (no-watermark) MP4 and copies it into R2.
// Exception to "browser → R2": TikTok files are small and TikTok blocks browser downloads (CORS), so the server copies them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isTikTokUrl } from "./tiktok";

const MAX_BYTES = 300 * 1024 * 1024;

export const studioImportTikTok = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(4096), url: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner, audit } = await import("./auth.server");
    const me = await requireOwner(data.token).catch(() => { throw new Error("401: Could not verify session"); });
    if (!isTikTokUrl(data.url)) throw new Error("400: That isn't a TikTok link.");
    const need = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
    if (need.some((k) => !process.env[k])) throw new Error("503: Media bucket isn't set up.");

    const url = await canonicalTikTok(data.url);
    const d = await resolveTikTok(url);
    const abs = (u: string) => (u.startsWith("http") ? u : `https://www.tikwm.com${u}`);

    const vid = await fetch(abs(d.play), { headers: d.headers ?? {}, signal: AbortSignal.timeout(60000) });
    if (!vid.ok || !vid.body) throw new Error("502: TikTok didn't send the video. Try again.");
    const buf = await vid.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("400: Video is too large to import.");

    const { AwsClient } = await import("aws4fetch");
    const client = new AwsClient({ accessKeyId: process.env["R2_ACCESS_KEY_ID"]!, secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"]!, service: "s3", region: "auto" });
    const bucketUrl = `${process.env["R2_ENDPOINT"]!.replace(/\/$/, "")}/${process.env["R2_BUCKET_NAME"]}`;
    const publicBase = process.env["R2_PUBLIC_URL"]!.replace(/\/$/, "");
    const rand = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `media/originals/${rand}.mp4`;
    const put = await client.fetch(`${bucketUrl}/${key}`, { method: "PUT", body: buf, headers: { "Content-Type": "video/mp4" } });
    if (!put.ok) throw new Error(`502: The bucket refused the file (${put.status}).`);

    let imageUrl = "";
    if (d.cover) {
      try {
        const c = await fetch(abs(d.cover), { headers: d.headers ?? {}, signal: AbortSignal.timeout(10000) });
        if (c.ok) {
          const ck = `media/images/${rand}.jpg`;
          const cp = await client.fetch(`${bucketUrl}/${ck}`, { method: "PUT", body: await c.arrayBuffer(), headers: { "Content-Type": "image/jpeg" } });
          if (cp.ok) imageUrl = `${publicBase}/${ck}`;
        }
      } catch { /* cover is optional; Studio makes one from the video */ }
    }

    try { const { sendJob } = await import("./queue.server"); await sendJob({ kind: "transcode", key }); } catch { /* 10-minute scan catches it */ }
    void audit(me, "media.tiktok.import", key, "ok", { size: buf.byteLength });
    const w = Number(d.width) || 0, h = Number(d.height) || 0;
    return {
      videoUrl: `${publicBase}/${key}`,
      imageUrl,
      title: String(d.title || "").slice(0, 200),
      ratio: w && h ? Math.round((w / h) * 1000) / 1000 : 0.5625,
    };
  });
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** Follows vt./vm./tiktok.com/t/ short links to the full /@user/video/ID link and strips tracking params. */
async function canonicalTikTok(raw: string): Promise<string> {
  let u = raw.trim();
  if (!/\/(video|photo)\/\d+/.test(u)) {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(u, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) }).catch(() => null);
      const loc = r?.headers.get("location");
      if (!loc) break;
      u = new URL(loc, u).toString();
      if (/\/(video|photo)\/\d+/.test(u)) break;
    }
  }
  const m = u.match(/tiktok\.com\/(@[^/?#]+)\/(video|photo)\/(\d+)/);
  if (m) return `https://www.tiktok.com/${m[1]}/${m[2]}/${m[3]}`;
  return u.split("?")[0] ?? u;
}

type Resolved = { play: string; cover?: string; title?: string; width?: number; height?: number; headers?: Record<string, string> };
const SLIDESHOW = "400: That TikTok is a photo slideshow, not a video. Only videos can be imported.";
const GONE = "404: TikTok says this video isn't available (private, removed or region-locked). Open it in TikTok to check, then copy the link again.";
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
let tikwmNext = 0; // per-isolate spacing so batch posting stays under TikWM's 1 req/s

/** Multi-engine resolver: TikWM → TikTok's own page → optional Cobalt. A busy engine never stops the import. */
async function resolveTikTok(url: string): Promise<Resolved> {
  const errors: string[] = [];
  for (const engine of [viaTikwm, viaTikTokPage, viaCobalt]) {
    try {
      const r = await engine(url);
      if (r) return r;
    } catch (e: any) {
      const m = String(e?.message || e);
      if (m.startsWith("400:")) throw e; // slideshow: no engine can fix it
      errors.push(m);
    }
  }
  if (errors.some((m) => m === GONE)) throw new Error(GONE);
  throw new Error("503: Every TikTok download engine is busy right now. Wait a minute and try again, or use Add video.");
}

async function viaTikwm(url: string): Promise<Resolved | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = tikwmNext - Date.now();
    tikwmNext = Math.max(Date.now(), tikwmNext) + 1200;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const j: any = await fetch("https://www.tikwm.com/api/", { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: `hd=1&url=${encodeURIComponent(url)}`, signal: AbortSignal.timeout(12000) }).then((r) => r.json()).catch(() => null);
    const d = j?.data;
    if (Array.isArray(d?.images) && d.images.length) throw new Error(SLIDESHOW);
    if (d?.hdplay || d?.play) return { play: d.hdplay || d.play, cover: d.cover, title: d.title, width: d.width, height: d.height };
    if (/parsing/i.test(String(j?.msg || ""))) return null; // let the next engine double-check
  }
  return null;
}

/** Reads TikTok's own web page (clean in-feed stream); the download needs the cookies TikTok sets on that page. */
async function viaTikTokPage(url: string): Promise<Resolved | null> {
  const r = await fetch(url, { headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null;
  const cookie = ((r.headers as any).getSetCookie?.() as string[] || []).map((c) => c.split(";")[0]).join("; ");
  const html = await r.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const detail = JSON.parse(m[1]!)?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const it = detail?.itemInfo?.itemStruct;
  if (!it) { if (detail?.statusCode && detail.statusCode !== 0) throw new Error(GONE); return null; }
  if (it.imagePost) throw new Error(SLIDESHOW);
  const v = it.video || {};
  const play = v.playAddr || v.downloadAddr;
  if (!play) return null;
  return { play, cover: v.cover || v.originCover, title: it.desc, width: v.width, height: v.height, headers: { "User-Agent": DESKTOP_UA, Referer: "https://www.tiktok.com/", ...(cookie ? { Cookie: cookie } : {}) } };
}

/** Optional self-hosted Cobalt (COBALT_API_URL) as the last engine. */
async function viaCobalt(url: string): Promise<Resolved | null> {
  const base = process.env["COBALT_API_URL"];
  if (!base) return null;
  const j: any = await fetch(base.replace(/\/$/, "") + "/", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", ...(process.env["COBALT_API_KEY"] ? { Authorization: `Api-Key ${process.env["COBALT_API_KEY"]}` } : {}) }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(20000) }).then((r) => r.json()).catch(() => null);
  return j?.url ? { play: j.url } : null;
}
