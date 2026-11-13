<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture rules
- Keep the four data flows separate (see docs/ARCHITECTURE.md): ordinary page reads must not touch Cloudflare D1 or R2, so one failing service can't take down pages.
- YouTube trailers must pass the `resolveVideos()` playability check before they're shown; LOOPGRAM never presents trailers as full movies.
- Paged lists use `useInfiniteList` (src/lib/infinite.ts) + `InfiniteFooter`; one engine keeps dedupe, end detection and retry consistent.
- Search index writes go only through `handleSearchJob()` in algolia.server.ts (admin key, server-only); the browser queries Algolia with the search-only key. One job entry point lets the D1 job queue reuse it.
- Background work goes through `sendJob()`/`processBatch()` (queue.server.ts) with a Redis done-marker per job key; producers fall back to running inline when the queue is unavailable. Server logs go through `log()` (log.server.ts), which scrubs secrets and writes JSON lines to the platform log.
- Auth is Firebase email/password; the browser never decides roles. Every Studio server function calls `requireOwner()` (auth.server.ts: verifies the ID token via Google JWKS, owner = OWNER_UID or verified `role: owner` claim, account live, session not revoked). Admin calls use the Identity Toolkit REST API with the service account (no firebase-admin, it doesn't run on workerd).
- Studio audit entries are written only server-side via `audit()`; public site settings (banner, maintenance) live in Redis `site:settings` and maintenance never blocks /login or /studio.
- Constants used by both a route's options (validateSearch, loader) and its component live in `src/lib`, not the route file; the route code-splitter cannot share non-exported route-file constants.
- Studio uploads go browser → R2 via short-lived signed PUT links from `upload.functions.ts`; destination keys come only from `uploadKey()` (upload-keys.ts) so movie/episode files land where `findStream()` looks. Large files never pass through the worker.
- Owner posts live in Redis `site:posts`, read/written only via posts.functions.ts. Why: one access path for owner content.

- Periodic work (D1 queue drain) runs from `heartbeat()` (heartbeat.server.ts), started via `ctx.waitUntil` in src/server.ts and gated by Redis `lg:heartbeat` (≈1/min across instances). Why: no external scheduler; every step is idempotent so cut-off runs just retry.
- Owner posts are searchable only through the separate Algolia index `loopgram_posts`, written by `syncPost()`/`reconcilePosts()` from the Cloudflare D1 post state (PUBLISHED only). Why: keeps the two content sources distinguishable and drafts out of search.

- Post views/likes go only through post-stats.server.ts: per-instance StatBuffer flushed to D1 in one transaction every few seconds; like deltas computed in SQL. Why: one write per instance per flush, no Redis dependency.
- Adaptive HLS for full movies/episodes (and Studio post videos via `post <url>`, played through `attachSource()` in hls-attach.ts with MP4 fallback) is made offline by scripts/transcode-hls.ts (ffmpeg ladder, never upscales) and uploaded to R2 at the findStream() paths; segments immutable, playlists short-cached, master uploaded last. Why: workers cannot run ffmpeg, and R2 edge caching serves chunks without origin load.
- New owner videos (posts, movies, episodes): studioUploadDone sends a D1 `transcode` job; scripts/transcode-worker.ts (ffmpeg, run anywhere, `--drain` in the 10-minute GitHub Actions cron) converts it via convertOne() in convert-posts.ts, whose full scan stays as the safety net. The web heartbeat hands transcode jobs straight back to the queue. Why: workers cannot run ffmpeg.
- Site settings (`site:settings`) are read/written only via settings-store.server.ts: dual-write Redis + D1 table `site_settings` (key SITE), newest `_savedAt` wins on read, 15s per-isolate memo. Why: Studio saves and auto-pull switches must work when Redis is over quota.
- Ads render only through `<AdSlot kind>` (AdSlot.tsx), gated by `site:settings` ad switches and hidden for the owner; public AdSense IDs live in src/lib/ads.ts. Why: one switchboard so Studio can turn every ad off.
- The site is owner posts + YouTube links + AdSense only (no movie catalog, subscriptions or watch parties), with the video feed as the home page. Why: owner pivoted to a YouTube-style channel.

- Permanent data lives in Cloudflare D1 (schema in db/schema.sql), reached only via `d1()`/`d1Batch()` in backend.server.ts over the D1 HTTP API; multi-statement batches are transactions. Background jobs are rows in the D1 `jobs` table leased via queue.server.ts. Why: no AWS; one Cloudflare account holds data, queue and media.
- Studio Health lists every key per service from `SERVICE_KEYS` (studio.functions.ts) as set/missing only, never values. Why: owner sees all keys in one place without leaking them.
- Public HTML pages (/, /explore, /search, /post/:id) get shared edge-cache headers via `cachePolicy()` in src/server.ts; signed-in, cookie-setting, error, /studio, /login, /api and server-function responses are never edge-cached. Why: the CDN absorbs traffic spikes instead of the worker, Redis and D1.
- `d1Batch()` uses the native `env.DB` binding when the host provides one, else the D1 HTTP API. Why: the binding has no management-API rate limit; scripts and dev keep working over HTTP.
- Public view/like counts are read via the edge-cached GET /api/public/stats (src/lib/stats-cache.ts); views are buffered per isolate and flushed to D1 in batches, not queued one job per view. Why: viral posts must not cost one origin or SQL write per visitor.
- TikTok links are imported server-side by `studioImportTikTok` (tiktok-import.functions.ts) into R2 media/originals/ via a no-watermark resolver, then queued for transcode. Why: TikTok blocks browser downloads and has no clean embed.
- YouTube imports: `studioImportYouTube` → R2 via optional COBALT_API_URL, else player API. Why: YouTube blocks cloud IPs.
- No shop page or affiliate links (owner removed them); description links render via `<LinkedText>`.

- TikTok account imports (TikTokAccountImport.tsx) list pages via `studioTikTokAccountPage` and import each video through the same `studioImportTikTok` + `studioPostSave` as single links. Why: account imports stay byte-identical to single imports (clean, in R2).
