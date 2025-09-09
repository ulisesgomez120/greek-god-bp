// Basic service worker for Greek God PWA
// - Precaches a small app shell
// - Runtime cache for navigation and images
// - Posts messages to clients when a new SW is installed

const CACHE_VERSION = "v1";
const PRECACHE = `ggbp-precache-${CACHE_VERSION}`;
const RUNTIME = `ggbp-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/", // HTML entry
  "/index.html",
  "/manifest.json",
  "/assets/icon.png",
  "/assets/icon.svg",
  "/assets/adaptive-icon.png",
  "/assets/favicon.png",
  "/assets/splash-icon.png",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Best-effort; continue even if some assets fail to cache
        console.warn("SW: precache failed", err);
      });
    })
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== PRECACHE && key !== RUNTIME).map((key) => caches.delete(key)));
    })
  );
});

// Fetch handler: serve precached assets, fallback to network with runtime caching
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // For navigation requests, serve index.html from cache (App Shell)
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match("/index.html")
        .then(
          (cached) =>
            cached ||
            fetch(request).then((res) => {
              // Cache for future navigations
              return caches.open(RUNTIME).then((cache) => {
                cache.put(request, res.clone());
                return res;
              });
            })
        )
        .catch(() => caches.match("/"))
    );
    return;
  }

  // For same-origin images and assets: cache-first strategy
  if (
    url.origin === self.location.origin &&
    (request.destination === "image" || request.destination === "script" || request.destination === "style")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Put a copy in the runtime cache
            return caches.open(RUNTIME).then((cache) => {
              try {
                cache.put(request, response.clone());
              } catch (e) {
                // Putting in cache can fail for cross-origin opaque responses
              }
              return response;
            });
          })
          .catch(() => {
            // Fallback to cache for navigation root
            return caches.match("/assets/icon.png");
          });
      })
    );
    return;
  }

  // Default: network-first fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Put a copy in runtime cache for same-origin
        if (url.origin === self.location.origin) {
          caches.open(RUNTIME).then((cache) => {
            try {
              cache.put(request, response.clone());
            } catch (e) {
              // ignore
            }
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for skipWaiting message to immediately activate new SW
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Notify clients when new SW is installed and waiting
self.addEventListener("statechange", function () {
  // no-op; statechange events on ServiceWorker instances are handled in the page
});

// Handle notification click to focus or open the app
self.addEventListener("notificationclick", function (event) {
  try {
    event.notification.close();
  } catch (e) {
    // ignore
  }

  const urlToOpen = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch(() => {
        // swallow errors
      })
  );
});

// Notification close handler (analytics / cleanup hook)
self.addEventListener("notificationclose", function (event) {
  // Placeholder: could postMessage to clients or record analytics
});

// Push handler: display incoming push messages (if using Push API / VAPID)
self.addEventListener("push", function (event) {
  try {
    let payload = {};
    if (event.data) {
      try {
        payload = event.data.json();
      } catch (e) {
        payload = { title: "Notification", body: event.data.text ? event.data.text() : "" };
      }
    }

    const title = payload.title || "TrainSmart";
    const options = {
      body: payload.body || "",
      data: payload.data || {},
      tag: payload.tag,
      renotify: payload.renotify || false,
      // you can extend options with icon, badge, actions, etc.
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // swallow to avoid crash
  }
});
