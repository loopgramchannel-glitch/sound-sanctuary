import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clapperboard } from "lucide-react";
import { Page } from "@/components/lg";
import { postIsShort, useRatios } from "@/components/PostView";
import { ShortsPlayer } from "@/components/Shorts";
import { postsQuery } from "@/lib/posts-query";
import { shareLink } from "@/lib/share";
import { hourSeed, mixFeed } from "@/lib/feed-mix";

export const Route = createFileRoute("/shorts")({
  head: () => ({
    meta: [
      { title: "Shorts — LoopgramChannel" },
      { name: "description", content: "Swipe through short vertical videos from LoopgramChannel." },
      { property: "og:title", content: "Shorts — LoopgramChannel" },
      { property: "og:description", content: "Swipe through short vertical videos from LoopgramChannel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: ShortsPage,
});

function ShortsPage() {
  const { data } = useSuspenseQuery(postsQuery);
  const ratios = useRatios(data.map((p) => p.videoUrl));
  const shorts = mixFeed(data, hourSeed()).filter((p) => postIsShort(p, ratios));
  if (!shorts.length) {
    return (
      <Page>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-primary shadow-glow"><Clapperboard className="h-9 w-9 text-primary-foreground" /></div>
          <h1 className="text-2xl font-bold">No Shorts yet</h1>
          <p className="text-sm text-muted-foreground">Vertical videos will show up here as soon as they're posted.</p>
          <Link to="/" className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Browse videos</Link>
        </div>
      </Page>
    );
  }
  return (
    <ShortsPlayer
      shorts={shorts}
      startId={shorts[0]!.id}
      onShare={(p) => shareLink({ title: p.title, text: `Watch ${p.title || "this"} on LoopgramChannel`, url: `${location.origin}/post/${p.id}` })}
    />
  );
}
