// Studio: import many videos from one TikTok account. Separate from the single-link box, but every
// video goes through the same single import (clean, no logo, saved as a real file in your storage forever).
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pause, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { studioImportTikTok } from "@/lib/tiktok-import.functions";
import { studioTikTokAccountPage } from "@/lib/tiktok-account.functions";
import { studioPostSave } from "@/lib/posts.functions";
import { ACCOUNT_COUNTS, tiktokHandle, videoLinks } from "@/lib/tiktok-account";
import { Post } from "@/lib/posts";

const DONE_KEY = "lg:tiktok:imported";
const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const primary = "inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const code = (e: unknown) => Number(msg(e).match(/^(\d{3}):/)?.[1] ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadDone(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]")); } catch { return new Set(); } }

export function TikTokAccountImport({ onChange }: { onChange: () => void }) {
  const { getToken } = useAuth();
  const [mode, setMode] = useState<"account" | "links">("account");
  const [input, setInput] = useState("");
  const [count, setCount] = useState<number>(15);
  const [running, setRunning] = useState(false);
  const [st, setSt] = useState({ found: 0, saved: 0, skipped: 0, failed: 0, now: "" });
  const stop = useRef(false);
  const done = useRef<Set<string>>(new Set());
  useEffect(() => { done.current = loadDone(); }, []);

  const importOne = async (url: string, id: string, fallbackTitle: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = await getToken(); if (!token) throw new Error("401: Not signed in");
        const r = await studioImportTikTok({ data: { token, url } });
        const post = Post.parse({
          id: `tt-${id}`.slice(0, 64).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          title: r.title || fallbackTitle, videoUrl: r.videoUrl, imageUrl: r.imageUrl, ratio: r.ratio, source: r.source,
          published: true, createdAt: Date.now(),
        });
        await studioPostSave({ data: { token: (await getToken())!, post } });
        return "saved" as const;
      } catch (e) {
        const c = code(e);
        if (c === 409) return "skipped" as const; // already in the library: never saved twice
        if (c === 400 || c === 404) return "skipped" as const; // slideshow, private or removed: filtered out
        if (c === 401) throw e;
        await sleep(4000 * (attempt + 1));
      }
    }
    return "failed" as const;
  };

  const run = async () => {
    stop.current = false; setRunning(true);
    const s = { found: 0, saved: 0, skipped: 0, failed: 0, now: "" };
    const tick = (now = s.now) => { s.now = now; setSt({ ...s }); };
    const handle = async (url: string, id: string, title: string) => {
      if (done.current.has(id)) { s.skipped++; return tick(); }
      tick(title || id);
      const r = await importOne(url, id, title);
      s[r]++;
      if (r === "saved") { done.current.add(id); localStorage.setItem(DONE_KEY, JSON.stringify([...done.current])); if (s.saved % 10 === 1) onChange(); }
      tick(); await sleep(1500);
    };
    try {
      if (mode === "links") {
        const links = videoLinks(input).slice(0, count); s.found = links.length; tick();
        for (const u of links) { if (stop.current) break; await handle(u, u.match(/\/video\/(\d+)/)?.[1] ?? u, ""); }
      } else {
        const user = tiktokHandle(input); if (!user) throw new Error("Type a TikTok username like @name");
        let cursor = "0", more = true;
        while (more && !stop.current && s.saved + s.skipped + s.failed < count) {
          const token = await getToken(); if (!token) throw new Error("Not signed in");
          const page = await studioTikTokAccountPage({ data: { token, user, cursor } });
          cursor = page.cursor; more = page.hasMore;
          for (const v of page.items) {
            if (stop.current || s.saved + s.skipped + s.failed >= count) break;
            s.found++;
            if (!v.clean) { s.skipped++; tick(); continue; } // clean-play filter
            await handle(`https://www.tiktok.com/@${user}/video/${v.id}`, v.id, v.title);
          }
        }
      }
      toast.success(`Done: ${s.saved} clean videos saved to your media library`);
    } catch (e) { toast.error(msg(e).replace(/^\d{3}:\s*/, "")); }
    finally { setRunning(false); tick(""); onChange(); }
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="font-bold">Import a whole TikTok account</h3>
        <p className="text-xs text-muted-foreground">Same as single import: clean, no logo, saved as a real video in your storage forever. Slideshows, private and removed videos are skipped.</p>
      </div>
      <div className="flex gap-2">
        {(["account", "links"] as const).map((m) => (
          <button key={m} type="button" disabled={running} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-foreground text-background" : "bg-secondary"}`}>{m === "account" ? "By username" : "Paste many links"}</button>
        ))}
      </div>
      {mode === "account"
        ? <input value={input} disabled={running} onChange={(e) => setInput(e.target.value)} placeholder="@username or tiktok.com/@username" className={field} />
        : <textarea value={input} disabled={running} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Paste TikTok video links, one per line" className={field} />}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">How many
          <select value={count} disabled={running} onChange={(e) => setCount(Number(e.target.value))} className="rounded-lg border bg-background px-2 py-1">
            {(ACCOUNT_COUNTS.includes(count as never) ? [] : [count]).concat([...ACCOUNT_COUNTS]).map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">or exact
          <input type="number" min={1} max={10000} value={count} disabled={running} onChange={(e) => setCount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className="w-24 rounded-lg border bg-background px-2 py-1" />
        </label>
        <span className="text-xs text-muted-foreground">Videos go live right away.</span>
      </div>
      <div className="flex items-center gap-2">
        {running
          ? <button type="button" className={primary} onClick={() => { stop.current = true; }}><Pause className="h-4 w-4" />Stop</button>
          : <button type="button" className={primary} disabled={!input.trim()} onClick={run}><Play className="h-4 w-4" />Start import</button>}
        {running && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      {(running || st.found > 0) && (
        <div className="space-y-1 text-xs">
          <p>Found {st.found} · Saved {st.saved} · Skipped {st.skipped} · Failed {st.failed}</p>
          {st.now && <p className="truncate text-muted-foreground">Now: {st.now}</p>}
          {running && <p className="text-muted-foreground">Keep this page open. If you stop, starting again skips videos already saved.</p>}
        </div>
      )}
    </section>
  );
}
