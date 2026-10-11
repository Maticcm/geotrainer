// GeoTrainer PWA Service Worker
const CACHE_NAME = "geotrainer-cache-v3";

const PRECACHE_URLS = [
  "/",
  "/icon.svg",
  "/favicon.svg",
  "/world-clean.svg",
  "/data/categories/oceans-seas.geojson",
  "/data/categories/continents.geojson",
  "/data/categories/mountains.geojson",
  "/data/categories/canals-straits.geojson",
  "/data/categories/countries.geojson",
  "/data/categories/rivers.geojson",
  "/data/categories/lakes.geojson",
  "/data/categories/islands.geojson",
  "/data/categories/deserts.geojson",
  "/data/categories/peninsulas.geojson",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch((err) => console.warn("SW precache partial:", err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests, non-GET, and Next.js HMR websocket / dev requests
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  // Network-only for Auth and API endpoints
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Navigation (HTML pages) - ALWAYS Network-first so code updates are never stale
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-While-Revalidate for static assets, SVG maps, and GeoJSON files
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
