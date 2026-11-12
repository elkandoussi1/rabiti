/* Rabiti service worker: app shell offline, fresh files when online. */
const CACHE = "rabiti-v14-v2";
const ASSETS = [
  "./index.html",
  "./public.html",
  "./app.css",
  "./store.css",
  "./ui.js",
  "./api.js",
  "./views.js",
  "./app.js",
  "./public.js",
  "./app-update.js",
  "./config.js",
  "./supabase.min.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./assets/rabiti-banner.svg"
];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((path) => new Request(path, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /^rabiti-v/.test(key) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  } catch {
    return (await caches.match(request)) ||
      (fallbackPath ? await caches.match(fallbackPath) : null) ||
      Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const path = url.pathname;
    const root = new URL("./", self.registration.scope).pathname;
    const index = new URL("index.html", self.registration.scope).pathname;
    const store = new URL("public.html", self.registration.scope).pathname;
    if (![root, index, store].includes(path)) return;
    event.respondWith(networkFirst(request, path === store ? "./public.html" : "./index.html"));
    return;
  }

  if (!ASSETS.some((path) => scopeUrl(path) === url.href)) return;
  event.respondWith(networkFirst(request));
});
