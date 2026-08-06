const CACHE_NAME = "seriespelis-v2-kb1-1-person-insights-service";

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/core/navigation.js",
  "./js/core/storage.js",
  "./js/core/state.js",
  "./js/data/genre-normalizer.js",
  "./js/data/library-model.js",
  "./js/data/library-repository.js",
  "./js/data/library-service.js",
  "./js/data/progress-service.js",
  "./js/data/statistics-service.js",
  "./js/data/person-insights-service.js",
  "./js/data/tmdb-client.js",
  "./js/data/tmdb-season-service.js",
  "./js/data/platform-match.js",
  "./js/data/user-platforms-repository.js",
  "./js/features/history-filters-search.js",
  "./js/features/season-episode-selectors.js",
  "./js/features/smart-collections.js",
  "./js/features/tmdb-ui.js",
  "./js/features/user-platforms-ui.js",
  "./js/features/statistics-ui.js",
  "./js/features/detail-view.js",
  "./js/features/progress-ui.js",
  "./js/ui/render.js",
  "./js/ui/modals.js",
  "./js/features/ratings-forms.js",
  "./js/app.js",
  "./manifest.json",
  "./service-worker.js",
  "./reset.html",
  "./diagnostico.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-167.png",
  "./icons/icon-152.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigation = event.request.mode === "navigate" ||
    event.request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
