const CACHE = "bumply-v3";
const ASSETS = ["/", "/sos", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// --- Web push ---
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Bumply", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "Bumply 🌸";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/dashboard" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/dashboard";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // Network-first for page navigations. Offline: serve the cached page if we have
  // it, else the always-available /sos (danger-sign check + ANC), else the shell.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((c) => c || caches.match("/sos")).then((c) => c || caches.match("/"))
      )
    );
    return;
  }

  // Cache-first for static assets.
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => cached)
    )
  );
});
