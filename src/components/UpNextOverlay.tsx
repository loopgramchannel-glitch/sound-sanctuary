import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { PostT } from "@/lib/posts";
import { UP_NEXT_SECONDS } from "@/lib/growth";

/** YouTube-style "Up next in 5" card shown when a video ends; plays the next one unless cancelled. */
export function UpNextOverlay({ next, onCancel }: { next: PostT; onCancel: () => void }) {
  const nav = useNavigate();
  const [left, setLeft] = useState(UP_NEXT_SECONDS);
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0) { if (!fired.current) { fired.current = true; nav({ to: "/post/$id", params: { id: next.id } }); } return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div role="dialog" aria-label="Up next" className="mt-3 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg">
      {next.imageUrl && <img src={next.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-lg bg-secondary object-cover" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Up next in {left}</p>
        <p className="truncate text-sm font-semibold">{next.title || "Next video"}</p>
      </div>
      <button onClick={onCancel} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent">Cancel</button>
      <button onClick={() => nav({ to: "/post/$id", params: { id: next.id } })} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Play now</button>
    </div>
  );
}
