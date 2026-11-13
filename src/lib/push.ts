// Browser side of phone alerts: ask permission, subscribe through the site's service worker, save on the server.
import { VAPID_PUBLIC_KEY } from "./push-keys";
import { pushSubscribe } from "./push.functions";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}
const key = () => Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/") + "="), (c) => c.charCodeAt(0));

/** Returns "on" when the device will now get alerts. */
export async function enablePush(): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }));
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await pushSubscribe({ data: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } });
    return "on";
  } catch { return "error"; }
}
export async function pushIsOn(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  return !!(await reg?.pushManager.getSubscription().catch(() => null));
}
