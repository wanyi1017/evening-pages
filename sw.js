// Service worker: keeps a copy of Evening Pages on the phone so it opens offline.
// The page itself is fetched fresh whenever there's a connection, and the saved
// copy is used only when there isn't, so new versions show up right away.
// Journal entries never pass through here: they live in localStorage.

const CACHE = "evening-pages-v1"; // change the name to drop old copies
const APP_FILES = ["./", "index.html", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fonts from Google: use the saved copy if there is one, otherwise fetch and save it.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(request).then((saved) => saved || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // The app's own files: try the network first, and fall back to the saved copy offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          // Opening the app keeps the offline fallback page up to date too.
          if (request.mode === "navigate") {
            const page = response.clone();
            caches.open(CACHE).then((cache) => cache.put("index.html", page));
          }
        }
        return response;
      })
      .catch(() => caches.match(request).then((saved) => saved || caches.match("index.html")))
  );
});
