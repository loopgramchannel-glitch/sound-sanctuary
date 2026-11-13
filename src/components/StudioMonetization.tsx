// Studio → Ads: owner switches for the AdSense units, plus an audience snapshot.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { studioMoney, studioOverview, studioSaveSettings, type SiteSettingsT } from "@/lib/studio.functions";
import { ADSENSE_CLIENT, AD_KINDS, AD_SLOTS, AD_UNIT_NAMES } from "@/lib/ads";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-bold">{title}</h2>{children}</section>;
}

export function MonetizationPanel() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const tok = async () => { const t = await getToken(); if (!t) throw new Error("Signed out"); return t; };
  const q = useQuery({ queryKey: ["studio", "overview"], queryFn: async () => studioOverview({ data: { token: await tok() } }) });
  const [f, setF] = useState<SiteSettingsT | null>(null);
  useEffect(() => { if (q.data && !f) setF(q.data.settings as SiteSettingsT); }, [q.data]);
  const m = useMutation({
    mutationFn: async () => studioSaveSettings({ data: { token: await tok(), settings: f! } }),
    onSuccess: () => { toast.success("Saved. Visitors see it on their next page load."); qc.invalidateQueries({ queryKey: ["studio"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (!f) return <p className="text-sm text-muted-foreground">{q.isError ? "Could not load settings." : "Loading…"}</p>;
  const tick = (k: "adsOn" | "adWatchOn" | "adFeedOn", label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" disabled={disabled} checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <div className="max-w-xl space-y-4">
      <MoneyBox tok={tok} />
      <Box title="Google AdSense">
        {tick("adsOn", "Show ads on my website (master switch)")}
        <div className="mt-2 space-y-2 pl-5">
          {tick("adWatchOn", "Display ads — below player (watch page)", !f.adsOn)}
          {tick("adFeedOn", "In-feed ads — posts feed & Shorts slides", !f.adsOn)}
          <div className="rounded-lg border p-2">
            <p className="mb-1 text-xs font-semibold">Each ad unit</p>
            {AD_KINDS.map((k) => {
              const on = !f.adUnitsOff.includes(k);
              return (
                <label key={k} className={`flex items-center justify-between gap-2 py-1 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
                  <span className="flex items-center gap-2"><input type="checkbox" disabled={!f.adsOn} checked={on}
                    onChange={(e) => setF({ ...f, adUnitsOff: e.target.checked ? f.adUnitsOff.filter((x) => x !== k) : [...f.adUnitsOff, k] })} />{AD_UNIT_NAMES[k]}</span>
                  <span className="text-xs text-muted-foreground">{AD_SLOTS[k].slot}</span>
                </label>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">Feed ad after every
            <input type="number" min={3} max={30} value={f.adFeedEvery} onChange={(e) => setF({ ...f, adFeedEvery: Math.min(30, Math.max(3, Number(e.target.value) || 8)) })} className="h-8 w-16 rounded border bg-background px-2" /> posts
          </label>
          <div className="flex flex-wrap gap-2">
            {[4, 6, 8, 12].map((n) => (
              <button key={n} type="button" disabled={!f.adsOn || !f.adFeedOn} onClick={() => setF({ ...f, adFeedEvery: n })}
                className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${f.adFeedEvery === n ? "bg-primary text-primary-foreground" : ""}`}>Every {n}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Shorts ads (full-screen, between Shorts)</p>
          <label className={`flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adShortsOn} onChange={(e) => setF({ ...f, adShortsOn: e.target.checked })} /> Show ads in Shorts
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">Ad after every
            <input type="number" min={1} max={30} value={f.adShortsEvery} onChange={(e) => setF({ ...f, adShortsEvery: Math.min(30, Math.max(1, Number(e.target.value) || 5)) })} className="h-8 w-16 rounded border bg-background px-2" /> Shorts
          </label>
          <div className="mt-2 flex gap-2">
            {[2, 4, 6].map((n) => <button key={n} type="button" onClick={() => setF({ ...f, adShortsEvery: n })} className={`rounded-full border px-3 py-1 text-xs ${f.adShortsEvery === n ? "bg-primary text-primary-foreground" : ""}`}>Every {n}</button>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ad unit {AD_SLOTS.shorts.slot}</p>
        </div>
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Search page ads</p>
          <label className={`flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adSearchOn} onChange={(e) => setF({ ...f, adSearchOn: e.target.checked })} /> Show ads in search results
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">First ad after
            <input type="number" min={1} max={10} value={f.adSearchAfter} onChange={(e) => setF({ ...f, adSearchAfter: Math.min(10, Math.max(1, Number(e.target.value) || 2)) })} className="h-8 w-16 rounded border bg-background px-2" /> results
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">Then repeat every
            <input type="number" min={0} max={20} value={f.adSearchEvery} onChange={(e) => setF({ ...f, adSearchEvery: Math.min(20, Math.max(0, Number(e.target.value) || 0)) })} className="h-8 w-16 rounded border bg-background px-2" /> results
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[0, 4, 6, 8].map((n) => <button key={n} type="button" onClick={() => setF({ ...f, adSearchEvery: n })} className={`rounded-full border px-3 py-1 text-xs ${f.adSearchEvery === n ? "bg-primary text-primary-foreground" : ""}`}>{n === 0 ? "Only once" : `Every ${n}`}</button>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ad unit {AD_SLOTS.search.slot}. 0 = show only one ad per search.</p>
        </div>
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Watch page ads</p>
          <label className={`flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adWatchOn} onChange={(e) => setF({ ...f, adWatchOn: e.target.checked })} /> Below the video player (unit {AD_SLOTS.watch.slot})
          </label>
          <label className={`mt-2 flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adDetailOn ?? true} onChange={(e) => setF({ ...f, adDetailOn: e.target.checked })} /> Top of "Up next" list (unit {AD_SLOTS.detail.slot})
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Never covers or pauses the video.</p>
        </div>
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Home &amp; Explore divider ad</p>
          <label className={`flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adHomeOn ?? true} onChange={(e) => setF({ ...f, adHomeOn: e.target.checked })} /> Show ad at the bottom of Home &amp; Explore
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Ad unit {AD_SLOTS.home.slot}. Appears after visitors finish scrolling the video list, never during playback.</p>
        </div>
        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Sidebar menu ad</p>
          <label className={`flex items-center gap-2 text-sm ${f.adsOn ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!f.adsOn} checked={f.adSidebarOn ?? true} onChange={(e) => setF({ ...f, adSidebarOn: e.target.checked })} /> Show ad at the bottom of the side menu
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Ad unit {AD_SLOTS.sidebar.slot}. Computers: bottom of the left menu (wide screens). Phones: bottom of the "You" page.</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Publisher {ADSENSE_CLIENT}. You never see ads while signed in as owner. Ads only fill once Google approves your own domain.</p>
      </Box>
      <button disabled={m.isPending} onClick={() => m.mutate()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
        {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}

function MoneyBox({ tok }: { tok: () => Promise<string> }) {
  const q = useQuery({ queryKey: ["studio", "money"], queryFn: async () => studioMoney({ data: { token: await tok() } }), staleTime: 60_000 });
  const d = q.data;
  return (
    <Box title="Audience">
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Active users today" value={d?.users?.day ?? "—"} />
            <Stat label="Active users 7 / 30 days" value={d?.users ? `${d.users.week} / ${d.users.month}` : "—"} />
          </div>
          <p className="text-xs text-muted-foreground">Total accounts: {d?.users?.total ?? "—"}. Active = signed in during that period.</p>
          <a href="https://adsense.google.com/adsense/new/u/0/pub-1332482197214084/reports" target="_blank" rel="noreferrer" className="inline-block text-sm underline">Ad income: open AdSense reports →</a>
          <button onClick={() => q.refetch()} className="ml-3 text-sm underline">Refresh</button>
        </div>
      )}
    </Box>
  );
}
