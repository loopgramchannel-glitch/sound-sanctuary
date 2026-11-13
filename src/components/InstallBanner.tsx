import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { usePwaInstall } from "@/lib/pwa-install";
const KEY = "lg:install-dismissed";

/** "Install LoopgramChannel" bar for phones: one-tap install on Android/Chrome, Share → Add to Home Screen hint on iPhone. */
export function InstallBanner() {
  const { installed, canPrompt, install } = usePwaInstall();
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [iosReady, setIosReady] = useState(false);
  useEffect(() => {
    try { setDismissed(!!localStorage.getItem(KEY)); } catch { setDismissed(false); }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!isIos) return;
    setIos(true);
    const t = setTimeout(() => setIosReady(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const show = !installed && !dismissed && (ios ? iosReady : canPrompt);
  if (!show) return null;
  const close = () => { setDismissed(true); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  return (
    <div role="dialog" aria-label="Install app" className="fixed inset-x-3 bottom-20 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
      <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install LoopgramChannel</p>
        <p className="text-xs text-muted-foreground">{ios ? "Tap Share, then “Add to Home Screen”." : "Full-screen videos from your home screen."}</p>
      </div>
      {!ios && canPrompt && (
        <button onClick={async () => { await install(); close(); }} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Download className="h-3.5 w-3.5" />Install</button>
      )}
      <button onClick={close} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
    </div>
  );
}
