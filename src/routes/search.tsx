import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, History, Search, X } from "lucide-react";
import { postIsShort, useRatios } from "@/components/PostView";
import { Page } from "@/components/lg";
import { PostTile } from "@/components/PostTile";
import { AdSlot } from "@/components/AdSlot";
import { searchAdAfter } from "@/lib/search-ads";
import { useAuth } from "@/hooks/useAuth";
import { ShortTile, ShortsShelf } from "@/components/Shorts";
import { postsQuery } from "@/lib/posts-query";
import { usePostStats } from "@/lib/use-post-stats";
import { searchPosts } from "@/lib/local-search";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().max(100).catch("") }),
  head: () => ({
    meta: [
      { title: "Search — LoopgramChannel" },
      { name: "description", content: "Search LoopgramChannel videos and Shorts." },
      { property: "og:title", content: "Search — LoopgramChannel" },
      { property: "og:description", content: "Search LoopgramChannel videos and Shorts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const nav = useNavigate();
  const { settings: adSet } = useAuth();
  const adAfter = adSet?.adSearchAfter ?? 2, adEvery = adSet?.adSearchEvery ?? 0;
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) nav({ to: "/search", search: { q: text.trim() }, replace: true }); }, 300);
    return () => clearTimeout(t);
  }, [text]);
  const { data } = useSuspenseQuery(postsQuery);
  const hits = searchPosts(data, q);
  const stats = usePostStats(hits.map((p) => p.id));
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem("lg:recent") || "[]")); } catch {} }, []);
  const saveRecent = (list: string[]) => { setRecent(list); localStorage.setItem("lg:recent", JSON.stringify(list)); };
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => saveRecent([q, ...recent.filter((r) => r !== q)].slice(0, 10)), 1500);
    return () => clearTimeout(t);
  }, [q]);
  const [focus, setFocus] = useState(!q);
  const [filter, setFilter] = useState("All");
  useEffect(() => setFilter("All"), [q]);
  const ratios = useRatios(hits.map((p) => p.videoUrl));
  const cats = [...new Set(hits.map((p) => p.category).filter(Boolean))];
  const shown = filter === "All" ? hits
    : filter === "Shorts" ? hits.filter((p) => postIsShort(p, ratios))
    : filter === "Videos" ? hits.filter((p) => !postIsShort(p, ratios))
    : hits.filter((p) => p.category === filter);
  const t = text.trim().toLowerCase();
  const suggestions = t ? [...new Set([
    ...data.map((p) => p.category).filter((c) => c && c.toLowerCase().includes(t)),
    ...data.map((p) => p.title).filter((x) => x && x.toLowerCase().includes(t)),
  ])].slice(0, 8) : [];
  const pick = (s: string) => { setText(s); setFocus(false); nav({ to: "/search", search: { q: s }, replace: true }); (document.activeElement as HTMLElement)?.blur(); };
  const chip = (on: boolean) => `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${on ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary hover:bg-accent"}`;
  const back = () => { if (window.history.length > 1) window.history.back(); else nav({ to: "/" }); };
  return (
    <Page>
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b bg-background px-2 py-2">
        <button onClick={back} aria-label="Back" className="rounded-full p-2 hover:bg-accent"><ArrowLeft className="h-5 w-5" /></button>
        <form className="flex h-10 flex-1 items-center rounded-full border bg-secondary/60 pl-4 focus-within:border-primary" onSubmit={(e) => { e.preventDefault(); nav({ to: "/search", search: { q: text.trim() }, replace: true }); (document.activeElement as HTMLElement)?.blur(); }}>
          <input autoFocus={!q} value={text} onFocus={() => setFocus(true)} onChange={(e) => { setText(e.target.value); setFocus(true); }} placeholder="Search LoopgramChannel" aria-label="Search" enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {text && <button type="button" onClick={() => setText("")} aria-label="Clear search" className="p-2"><X className="h-4 w-4" /></button>}
        </form>
      </div>
      {focus && suggestions.length > 0 && text.trim() ? (
        <ul className="py-1">
          {suggestions.map((s) => (
            <li key={s}>
              <button onClick={() => pick(s)} className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm hover:bg-accent">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="truncate">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : !q ? (
        recent.length ? (
          <ul className="py-1">
            {recent.map((r) => (
              <li key={r} className="flex items-center hover:bg-accent">
                <button onClick={() => setText(r)} className="flex flex-1 items-center gap-4 px-4 py-3 text-left text-sm"><History className="h-5 w-5 text-muted-foreground" />{r}</button>
                <button onClick={() => saveRecent(recent.filter((x) => x !== r))} aria-label={`Remove ${r}`} className="p-3 text-muted-foreground"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="p-4 text-sm text-muted-foreground">Type to search videos.</p>
      )
        : hits.length === 0 ? <p className="px-4 text-sm text-muted-foreground">No videos match “{q}”.</p>
        : (
          <div className="mx-auto max-w-4xl space-y-3 px-2 pb-6">
            <div className="scrollbar-none flex gap-2 overflow-x-auto py-3">
              {["All", "Shorts", "Videos", ...cats].map((x) => <button key={x} onClick={() => setFilter(x)} className={chip(filter === x)}>{x}</button>)}
            </div>
            {shown.length === 0 && <p className="px-2 text-sm text-muted-foreground">Nothing in “{filter}” for this search.</p>}
            {filter === "Shorts" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {shown.map((p) => <ShortTile key={p.id} post={p} className="w-full" />)}
              </div>
            ) : filter === "Videos" ? (
              shown.map((p, i) => (
                <div key={p.id}>
                  <PostTile post={p} compact views={stats[p.id]?.views} />
                  {searchAdAfter(i, adAfter, adEvery) && <AdSlot kind="search" className="mt-3" />}
                </div>
              ))
            ) : (() => {
              const shorts = shown.filter((p) => postIsShort(p, ratios));
              const videos = shown.filter((p) => !postIsShort(p, ratios));
              const row = (p: (typeof videos)[number]) => <PostTile key={p.id} post={p} compact views={stats[p.id]?.views} />;
              return (
                <>
                  {videos.slice(0, 2).map((p, j) => <div key={p.id}>{row(p)}{searchAdAfter(j, adAfter, adEvery) && videos.length > j + 1 && <AdSlot kind="search" className="mt-3" />}</div>)}
                  {shorts.length > 0 && <div className="-mx-2"><ShortsShelf posts={shorts} /></div>}
                  {videos.slice(2).map((p, j) => <div key={p.id}>{row(p)}{searchAdAfter(j + 2, adAfter, adEvery) && <AdSlot kind="search" className="mt-3" />}</div>)}
                </>
              );
            })()}
          </div>
        )}
    </Page>
  );
}
