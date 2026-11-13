import { useEffect, useState } from "react";

export const INSTALLED_KEY = "lg:pwa-installed";
const MODES = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];

/** Pure check: true when the site runs as an installed app or was installed on this device. */
export function isInstalledEnv(env: { modes: string[]; iosStandalone?: boolean | undefined; referrer?: string | undefined; stored?: string | null | undefined }): boolean {
  return env.modes.some((m) => MODES.includes(m)) || env.iosStandalone === true || (env.referrer ?? "").startsWith("android-app://") || env.stored === "1";
}

function readEnv() {
  let stored: string | null = null;
  try { stored = localStorage.getItem(INSTALLED_KEY); } catch { /* ignore */ }
  return {
    modes: MODES.filter((m) => matchMedia(`(display-mode: ${m})`).matches),
    iosStandalone: (navigator as { standalone?: boolean }).standalone,
    referrer: document.referrer,
    stored,
  };
}

export function markInstalled() { try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ } }

/** Browser install prompt + installed state shared by the header button and the phone banner. */
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function usePwaInstall() {
  const [installed, setInstalled] = useState(true); // hidden until checked, avoids flash
  const [evt, setEvt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const check = () => setInstalled(isInstalledEnv(readEnv()));
    check();
    const nav = navigator as { getInstalledRelatedApps?: () => Promise<unknown[]> };
    nav.getInstalledRelatedApps?.().then((a) => { if (a.length) { markInstalled(); setInstalled(true); } }).catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault(); setEvt(e as InstallPrompt);
      // Browser offers install again => app was uninstalled; forget the old flag.
      try { localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ }
      check();
    };
    const onDone = () => { markInstalled(); setEvt(null); setInstalled(true); };
    const mqs = MODES.map((m) => matchMedia(`(display-mode: ${m})`));
    mqs.forEach((q) => q.addEventListener?.("change", check));
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onDone);
    return () => {
      mqs.forEach((q) => q.removeEventListener?.("change", check));
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onDone);
    };
  }, []);
  const install = async (): Promise<boolean> => {
    if (!evt) return false;
    await evt.prompt();
    const r = await evt.userChoice.catch(() => null);
    setEvt(null);
    if (r?.outcome === "accepted") { markInstalled(); setInstalled(true); }
    return true;
  };
  return { installed, canPrompt: !!evt, install };
}
