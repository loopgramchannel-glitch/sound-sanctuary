import { createFileRoute } from "@tanstack/react-router";
import { NotificationsFeed } from "@/components/NotificationBell";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — LoopgramChannel" },
      { name: "description", content: "New videos and Shorts from LoopgramChannel." },
      { property: "og:title", content: "Notifications — LoopgramChannel" },
      { property: "og:description", content: "Catch up on the latest LoopgramChannel videos and Shorts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsFeed,
});
