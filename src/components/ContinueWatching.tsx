import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PostT } from "@/lib/posts";
import { continueWatching, type HistoryItem } from "@/lib/growth";
import { HISTORY_EVENT, readHistory } from "@/lib/watch-history";

/** Row of videos this phone started but didn't finish. Read after hydration (history lives on the device). */
export function ContinueWatching({ posts }: { posts: PostT[] }) {
  const [h, setH] = useState<HistoryItem[]>([]);
  useEffect(() => { const on = () => setH(readHistory()); on(); addEventListener(HISTORY_EVENT, on); return () => removeEventListener(HISTORY_EVENT, on); }, []);
  const items = continueWatching(h, posts);
  if (!items.length) return null;
  return (
    <section aria-label="Continue watching" className="px-3 pb-4">
      <h2 className="mb-2 text-lg font-bold">Continue watching</h2>
      <div className="scrollbar-none -mx-3 flex gap-3 overflow-x-auto px-3">
        {items.map(({ post, progress }) => (
          <Link key={post.id} to="/post/$id" params={{ id: post.id }} className="w-44 shrink-0 sm:w-56">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary">
              {post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-medium">{post.title || "Video"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
