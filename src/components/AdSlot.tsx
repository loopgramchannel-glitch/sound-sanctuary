// Google AdSense unit. Hidden for the owner and whenever Studio switches it off.
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ADSENSE_CLIENT, AD_SLOTS } from "@/lib/ads";

declare global { interface Window { adsbygoogle?: unknown[] } }

export type AdKind = keyof typeof AD_SLOTS;

export function useAdsAllowed(kind: AdKind) {
  const { ready, role, settings } = useAuth();
  if (!ready || !settings || role === "owner") return false;
  if (!settings.adsOn || settings.adUnitsOff?.includes(kind)) return false;
  // Display units (watch, detail, search, home) share the Studio display-ad switch;
  // in-feed units (feed, shorts) share the feed-ad switch.
  if (kind === "shorts") return settings.adShortsOn ?? true;
  if (kind === "sidebar") return settings.adSidebarOn ?? true;
  if (kind === "home") return settings.adHomeOn ?? true;
  if (kind === "detail") return settings.adDetailOn ?? true;
  if (kind === "search") return settings.adSearchOn ?? true;
  return kind === "feed" ? settings.adFeedOn : settings.adWatchOn;
}

export function AdSlot({ kind, className = "", label = true }: { kind: AdKind; className?: string; label?: boolean }) {
  const allowed = useAdsAllowed(kind);
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!allowed || !ref.current || ref.current.dataset["adsbygoogleStatus"]) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker */ }
  }, [allowed]);
  if (!allowed) return null;
  const u = AD_SLOTS[kind];
  return (
    <div className={`overflow-hidden ${className}`} aria-label="Advertisement">
      {label && <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Ad</p>}
      <ins ref={ref} className="adsbygoogle" style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT} data-ad-slot={u.slot} data-ad-format={u.format}
        {...("layoutKey" in u ? { "data-ad-layout-key": u.layoutKey } : { "data-full-width-responsive": "true" })} />
    </div>
  );
}
