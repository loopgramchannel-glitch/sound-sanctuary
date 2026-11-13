import { Bell, BellRing } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { postsQuery, timeAgo } from "@/lib/posts-query";
import { postIsShort, PostThumb } from "@/components/PostView";
import { useAuth } from "@/hooks/useAuth";
import { enablePush, pushIsOn, pushSupported } from "@/lib/push";
import { localNotes, markAllRead, seenAt, subscribe, unreadCount, type Note } from "@/lib/notify";

/** Shared notification list: public new videos/Shorts for everyone, plus private on-device alerts (imports only for the owner). */
export function useNotes() {
  const auth = useAuth();
  const owner = auth.role === "owner";
  const { data: posts = [] } = useQuery(postsQuery);
  const [tick, setTick] = useState(0);
  const [seen, setSeen] = useState(Number.MAX_SAFE_INTEGER);
  useEffect(() => { setSeen(seenAt()); return subscribe(() => { setSeen(seenAt()); setTick((t) => t + 1); }); }, []);
  const notes = useMemo<(Note & { post?: (typeof posts)[number] })[]>(() => {
    const pub = posts.filter((p) => p.published).slice(0, 50).map((p) => {
      const short = postIsShort(p, {});
      return { id: p.id, kind: short ? "short" as const : "video" as const, title: short ? "New Short" : "LoopgramChannel posted", body: p.title || p.text.slice(0, 80) || "New video", at: p.createdAt, href: `/post/${p.id}`, post: p };
    });
    const mine = typeof window === "undefined" ? [] : localNotes().filter((n) => n.kind !== "import" || owner);
    return [...mine, ...pub].sort((a, b) => b.at - a.at).slice(0, 60);
  }, [posts, owner, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { notes, seen, refresh: () => setTick((t) => t + 1) };
}

/** Header bell: opens the full notifications page, shows the unread counter. */
export function NotificationBell() {
  const { notes, seen } = useNotes();
  const lastTop = useRef<number | null>(null);
  useEffect(() => {
    const top = notes.find((n) => !n.private);
    if (!top) return;
    if (lastTop.current !== null && top.at > lastTop.current && typeof Notification !== "undefined" && Notification.permission === "granted")
      try { new Notification(top.title, { body: top.body, icon: "/icon-192.png" }); } catch { /* unsupported */ }
    lastTop.current = top.at;
  }, [notes]);
  const unread = unreadCount(notes, seen);
  return (
    <Link to="/notifications" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`} className="relative rounded-full p-2 hover:bg-secondary" activeProps={{ className: "bg-secondary" }}>
      <Bell className="h-6 w-6" />
      {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

/** Full-page list used by /notifications. */
export function NotificationsFeed() {
  const { notes, seen, refresh } = useNotes();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [canAsk, setCanAsk] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (pushSupported() && Notification.permission !== "denied") pushIsOn().then((on) => setCanAsk(!on)); }, []);
  const turnOn = async () => {
    const r = await enablePush();
    if (r === "on") { setCanAsk(false); setMsg("Alerts are on. You'll get a message on this device when a new video is posted."); }
    else setMsg(r === "denied" ? "Alerts are blocked. Allow notifications for this site in your browser settings." : r === "unsupported" ? "This browser can't show alerts. On iPhone, add the site to your Home Screen first." : "Couldn't turn on alerts. Try again.");
    refresh();
  };
  const shown = tab === "unread" ? notes.filter((n) => n.at > seen) : notes;
  return (
    <div className="mx-auto max-w-3xl px-2 pb-6 sm:px-4">
      <div className="flex items-center justify-between px-2 py-3">
        <h1 className="text-xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="text-sm font-medium text-primary hover:underline">Mark all as read</button>
      </div>
      <div className="flex gap-2 px-2 pb-3">
        {(["all", "unread"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-foreground text-background" : "bg-secondary"}`}>{t === "all" ? "All" : "Unread"}</button>)}
      </div>
      {msg && <p className="mx-2 mb-3 rounded-xl bg-secondary px-4 py-3 text-sm">{msg}</p>}
      {canAsk && <button onClick={turnOn} className="mx-2 mb-3 flex w-[calc(100%-1rem)] items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-left text-sm hover:bg-accent"><BellRing className="h-5 w-5 text-primary" />Turn on phone alerts for new videos</button>}
      <ul>
        {shown.length === 0 && <li className="px-4 py-16 text-center text-muted-foreground"><Bell className="mx-auto mb-3 h-10 w-10" />You're all caught up.</li>}
        {shown.map((n) => {
          const inner = (
            <div className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-secondary">
              <span className={`mt-4 h-2 w-2 shrink-0 rounded-full ${n.at > seen ? "bg-primary" : "bg-transparent"}`} />
              <img src="/icon.svg" alt="" className="h-10 w-10 shrink-0 rounded-full bg-secondary p-1" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-semibold">{n.title}</span>{n.kind === "import" && <span className="ml-1 text-xs text-muted-foreground">(only you)</span>}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.at)}</p>
              </div>
              {n.post && <PostThumb post={n.post} className="aspect-video w-28 shrink-0 rounded-lg sm:w-40" />}
            </div>
          );
          return <li key={n.id}>{n.href ? <Link to={n.href}>{inner}</Link> : inner}</li>;
        })}
      </ul>
    </div>
  );
}
