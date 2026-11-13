// Owner-only YouTube importer: copies a YouTube video's clean MP4 (YouTube burns no logo into the file) into R2,
// so the post plays from our own storage even if YouTube later removes the original.
// Resolver order: self-hosted cobalt (COBALT_API_URL [+ COBALT_API_KEY]) → YouTube's own player API.
// YouTube often blocks the second path from cloud servers, so cobalt is the reliable route.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { youTubeId } from "./tiktok";

const MAX_BYTES = 300 * 1024 * 1024;

async function viaCobalt(url: string): Promise<string | null> {
  const base = process.env["COBALT_API_URL"];
  if (!base) return null;
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (process.env["COBALT_API_KEY"]) headers["Authorization"] = `Api-Key ${process.env["COBALT_API_KEY"]}`;
  const r = await fetch(base.replace(/\/$/, "") + "/", {
    method: "POST", headers, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ url, videoQuality: "1080", youtubeVideoCodec: "h264", downloadMode: "auto" }),
  }).then((x) => x.json() as Promise<any>).catch(() => null);
  return r && (r.status === "tunnel" || r.status === "redirect") && r.url ? String(r.url) : null;
}

async function viaPlayer(id: string): Promise<{ url: string; w: number; h: number } | null> {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ videoId: id, context: { client: { clientName: "ANDROID_VR", clientVersion: "1.60.19", deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L", hl: "en" } } }),
  }).then((x) => x.json() as Promise<any>).catch(() => null);
  const f = (r?.streamingData?.formats ?? []).filter((x: any) => x.url && String(x.mimeType).startsWith("video/mp4"))
    .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
  return f ? { url: f.url, w: f.width ?? 0, h: f.height ?? 0 } : null;
}

export const studioImportYouTube = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(4096), url: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner, audit } = await import("./auth.server");
    const me = await requireOwner(data.token).catch(() => { throw new Error("401: Could not verify session"); });
    const id = youTubeId(data.url);
    if (!id) throw new Error("400: That isn't a YouTube link.");
    const need = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
    if (need.some((k) => !process.env[k])) throw new Error("503: Media bucket isn't set up.");
    const { assertNew } = await import("./tiktok-import.functions");
    const source = await assertNew(`https://www.youtube.com/watch?v=${id}`);

    const isShort = /\/shorts\//i.test(data.url);
    let src = await viaCobalt(`https://www.youtube.com/watch?v=${id}`);
    let w = 0, h = 0;
    if (!src) { const p = await viaPlayer(id); if (p) { src = p.url; w = p.w; h = p.h; } }
    if (!src) {
      // YouTube blocks server downloads: fall back to a playable YouTube link with its cover and title.
      let title = "";
      try {
        const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(8000) });
        if (o.ok) title = String(((await o.json()) as any).title ?? "").slice(0, 200);
        else throw new Error("404");
      } catch { throw new Error("404: That YouTube video isn't available. It may be private or deleted."); }
      void audit(me, "media.youtube.link", id, "ok", {});
      return {
        videoUrl: isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
        imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, title, ratio: isShort ? 0.5625 : 0, linked: true, source,
      };
    }

    const vid = await fetch(src, { signal: AbortSignal.timeout(120000) });
    if (!vid.ok || !vid.body) throw new Error("502: YouTube didn't send the video. Try again.");
    const buf = await vid.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("400: Video is too large to import (300 MB max). Download it and use Add video.");

    const { AwsClient } = await import("aws4fetch");
    const client = new AwsClient({ accessKeyId: process.env["R2_ACCESS_KEY_ID"]!, secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"]!, service: "s3", region: "auto" });
    const bucketUrl = `${process.env["R2_ENDPOINT"]!.replace(/\/$/, "")}/${process.env["R2_BUCKET_NAME"]}`;
    const publicBase = process.env["R2_PUBLIC_URL"]!.replace(/\/$/, "");
    const rand = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `media/originals/${rand}.mp4`;
    const put = await client.fetch(`${bucketUrl}/${key}`, { method: "PUT", body: buf, headers: { "Content-Type": "video/mp4" } });
    if (!put.ok) throw new Error(`502: The bucket refused the file (${put.status}).`);

    let imageUrl = "";
    for (const q of ["maxresdefault", "hqdefault"]) {
      try {
        const c = await fetch(`https://i.ytimg.com/vi/${id}/${q}.jpg`, { signal: AbortSignal.timeout(10000) });
        if (!c.ok) continue;
        const ck = `media/images/${rand}.jpg`;
        const cp = await client.fetch(`${bucketUrl}/${ck}`, { method: "PUT", body: await c.arrayBuffer(), headers: { "Content-Type": "image/jpeg" } });
        if (cp.ok) { imageUrl = `${publicBase}/${ck}`; break; }
      } catch { /* cover optional */ }
    }

    let title = "";
    try {
      const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(8000) });
      if (o.ok) title = String(((await o.json()) as any).title ?? "").slice(0, 200);
    } catch { /* title optional */ }

    try { const { sendJob } = await import("./queue.server"); await sendJob({ kind: "transcode", key }); } catch { /* 10-minute scan catches it */ }
    void audit(me, "media.youtube.import", key, "ok", { size: buf.byteLength });
    return { videoUrl: `${publicBase}/${key}`, imageUrl, title, ratio: w && h ? Math.round((w / h) * 1000) / 1000 : isShort ? 0.5625 : 0, linked: false, source };
  });
