// Service worker minimale: mette in cache solo gli asset statici della
// stessa origine (icone, manifest, JS/CSS compilati), mai le pagine HTML
// e mai le richieste verso Supabase. Le navigazioni (event.request.mode
// === "navigate") passano SEMPRE dal server: cachare l'HTML di un'app con
// dati finanziari personali rischierebbe di mostrare, offline su un
// dispositivo condiviso, la sessione dell'utente precedente.

const CACHE_NAME = "bilancio-shell-v2";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate" || request.destination === "document") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
