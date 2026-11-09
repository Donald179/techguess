const CACHE_NAME = "techgest-multipage-pwa-v1";
const APP_SHELL = [
  "./",
  "./login.html",
  "./index.html",
  "./clients.html",
  "./prestations.html",
  "./paiements.html",
  "./depenses.html",
  "./devis-factures.html",
  "./rapports.html",
  "./parametres.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/shared.css",
  "./assets/css/login.css",
  "./assets/css/dashboard.css",
  "./assets/css/clients.css",
  "./assets/css/prestations.css",
  "./assets/css/paiements.css",
  "./assets/css/depenses.css",
  "./assets/css/devis-factures.css",
  "./assets/css/rapports.css",
  "./assets/css/parametres.css",
  "./assets/js/supabase-config.js",
  "./assets/js/supabase-service.js",
  "./assets/js/db.js",
  "./assets/js/sync.js",
  "./assets/js/pdf-export.js",
  "./assets/js/layout.js",
  "./assets/js/login.js",
  "./assets/js/dashboard.js",
  "./assets/js/clients.js",
  "./assets/js/prestations.js",
  "./assets/js/paiements.js",
  "./assets/js/depenses.js",
  "./assets/js/devis-factures.js",
  "./assets/js/rapports.js",
  "./assets/js/parametres.js",
  "./assets/images/icon.ico",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => Promise.resolve()))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((oldKey) => caches.delete(oldKey)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne jamais mettre en cache les requêtes API vers Supabase (.supabase.co)
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("./offline.html");
          return fallback || new Response("Hors ligne", { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
