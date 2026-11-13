// Public, edge-cached view/like counts. Same answer for every visitor, so the CDN absorbs viral traffic.
import { createFileRoute } from "@tanstack/react-router";
import { parseStatIds, STATS_CACHE } from "@/lib/stats-cache";

export const Route = createFileRoute("/api/public/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ids = parseStatIds(new URL(request.url).searchParams.get("ids"));
        if (!ids) return new Response("bad ids", { status: 400 });
        const { readStats } = await import("@/lib/post-stats.server");
        const data = await readStats(ids).catch(() => ({}));
        return Response.json(data, { headers: { "cache-control": STATS_CACHE } });
      },
    },
  },
});
