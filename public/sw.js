/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = "swiss-redesign-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/index.css",
  "/manifest.json"
];

// Perform install & cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static lifecycle assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Clean up stale, legacy cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing deprecated cache keys:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept requests and serve from cache if offline
self.addEventListener("fetch", (event) => {
  // Pass API requests directly to network, never cache API post results
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Return resource or dynamic check
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        
        // Cache newly loaded static assets on the fly
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback or offline support
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
