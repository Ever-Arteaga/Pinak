/*
 * Service worker de PINAK.
 * Hace instalable la app y muestra una pantalla amable si no hay internet.
 * A propósito NO guarda en caché páginas ni datos: así nunca se ve una versión
 * vieja de la app ni información financiera desactualizada.
 */
const VERSION = "pinak-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/pinak-mark.png", "/pinak-wordmark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Solo páginas de PINAK. Firebase, Google y Bold nunca se interceptan.
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
