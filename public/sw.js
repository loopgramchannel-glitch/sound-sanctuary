// LoopgramChannel service worker: offline shell + stale-while-revalidate for content API, assets and images.
const V = "lg-v5";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"])).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("lg-") && k !== V).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/~oauth")) return;
  if (e.request.mode === "navigate") {
    // Network-first for pages so deploys are never stuck; cached shell only when offline.
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put("/", c)); return r; }).catch(() => caches.match("/")));
    return;
  }
  const same = u.origin === location.origin;
  const cacheable = (same && u.pathname.startsWith("/assets/")) || u.hostname.endsWith("r2.dev");
  if (!cacheable) return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

// Phone alerts: show the message even when the site is closed (like TikTok/YouTube).
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "LoopgramChannel", {
    body: d.body || "New video", icon: "/icon-192.png", badge: "/icon-192.png", image: d.image,
    tag: d.url || "loopgram", renotify: true, vibrate: [120, 60, 120], data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
