const CACHE_VERSION = "v4";
const PRECACHE_NAME = `coachos-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `coachos-runtime-${CACHE_VERSION}`;
const CACHE_PREFIX = "coachos-";
const MAX_RUNTIME_ENTRIES = 80;
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== PRECACHE_NAME &&
                key !== RUNTIME_CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimRuntimeCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_RUNTIME_ENTRIES;
  if (overflow <= 0) return;

  await Promise.all(
    keys.slice(0, overflow).map((request) => cache.delete(request))
  );
}

async function cacheFirstStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (!response.ok) return response;

  const cache = await caches.open(RUNTIME_CACHE_NAME);
  await cache.put(request, response.clone());
  await trimRuntimeCache(cache);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json";

  if (!isStaticAsset) return;

  event.respondWith(cacheFirstStaticAsset(request));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Ignore malformed payload data and show the generic reminder.
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "CoachOS", {
      body: data.body ?? "Zeit für deinen täglichen Check-in.",
      icon: "/icons/icon-192.svg",
      badge: "/icons/badge-72.svg",
      vibrate: [200, 100, 200],
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = new URL("/", self.location.origin).href;
  try {
    const candidate = new URL(
      String(event.notification.data?.url ?? "/"),
      self.location.origin
    );
    if (candidate.origin === self.location.origin) {
      targetUrl = candidate.href;
    }
  } catch {
    // Keep the safe same-origin fallback.
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url === targetUrl && "focus" in w) return w.focus();
        }
        return clients.openWindow(targetUrl);
      })
  );
});
