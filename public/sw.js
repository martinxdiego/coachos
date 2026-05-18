const CACHE_NAME = "coachos-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "CoachOS", {
      body: data.body ?? "Vergiss deinen heutigen Wellness-Check nicht! 💪",
      icon: "/icons/icon-192.svg",
      badge: "/icons/badge-72.svg",
      vibrate: [200, 100, 200],
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(url) && "focus" in w) return w.focus();
        }
        return clients.openWindow(url);
      })
  );
});
