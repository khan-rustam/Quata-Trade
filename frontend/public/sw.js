/*
 * QuataTrade service worker — deliberately MINIMAL and safe for a financial app.
 *
 * Purpose:
 *   1. Make the PWA installable (a `fetch` handler is required by Chrome/Android).
 *   2. Show a graceful offline page for navigations when the network is unreachable.
 *   3. Drive controlled auto-updates: a new deploy INSTALLS but WAITS. It only takes
 *      over when the user accepts ("Update now"), so the app can never reload itself
 *      underneath an active trade, escrow, withdrawal or KYC step.
 *
 * It NEVER caches API responses, authenticated pages, or any money data — those are
 * always fetched live from the network. Only the static offline fallback + a couple
 * of icons are precached. No stale balances, ever.
 */
const CACHE = "quata-shell-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // NOTE: no skipWaiting() here on purpose — the new worker stays in `waiting`
  // until the page explicitly sends SKIP_WAITING (user pressed "Update now").
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks the waiting worker to take over (user accepted the update).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
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
