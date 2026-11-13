import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: any; __tsLoad?: Promise<void> } }

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__tsLoad ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return window.__tsLoad;
}

/** Cloudflare robot check. Calls onToken with a fresh token (or null when it expires). */
export function Turnstile({ onToken, resetKey, onError }: { onToken: (t: string | null) => void; resetKey?: number; onError?: (code: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let alive = true;
    load().then(() => {
      if (!alive || !ref.current || !window.turnstile) return;
      id.current = window.turnstile.render(ref.current, {
        sitekey: siteKey, theme: "dark", size: "flexible",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": (code: string) => { onToken(null); onError?.(String(code)); return true; },
      });
    }).catch(() => onError?.("load"));
    return () => { alive = false; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = null; };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && id.current && window.turnstile) { window.turnstile.reset(id.current); onToken(null); }
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px] w-full" />;
}
