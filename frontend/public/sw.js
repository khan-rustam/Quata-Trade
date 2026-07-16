/*
 * QuataTrade service worker — deliberately MINIMAL and safe for a financial app.
 *
 * Purpose:
 *   1. Make the PWA installable (a `fetch` handler is required by Chrome/Android).
 *   2. Show a graceful offline page for navigations when the network is unreachable.
 *
 * It NEVER caches API responses, authenticated pages, or any money data — those are
 * always fetched live from the network. Only the static offline fallback + a couple
 * of icons are precached. No stale balances, ever.
 */
const CACHE = "quata-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PUT (money-moving) requests

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party (RPC, avatars) → network
  if (url.pathname.startsWith("/api")) return; // never cache API / money data

  // Only intervene for page navigations: network-first, offline page as fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res ?? new Response("Offline", { status: 503, statusText: "Offline" })),
      ),
    );
  }
});
