/**
 * PWA update state. A new deploy installs a new service worker which then sits in
 * `waiting` (sw.js deliberately does NOT skipWaiting). We surface that as "an update
 * is ready" so the UI can ask the user — the app never reloads itself underneath an
 * active trade, escrow, withdrawal or KYC step.
 */

let waiting: ServiceWorker | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) cb();
}

export function getWaitingWorker(): ServiceWorker | null {
  return waiting;
}

export function onUpdateChange(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function setWaiting(sw: ServiceWorker | null): void {
  if (waiting === sw) return;
  waiting = sw;
  notify();
}

/**
 * Watch a registration for a newly-installed (waiting) worker, and poll for new
 * deploys: on an interval, and whenever the tab regains focus. Returns a cleanup fn.
 */
export function watchForUpdates(registration: ServiceWorkerRegistration, intervalMs = 15 * 60_000): () => void {
  // Already waiting (e.g. a deploy landed while the tab was closed).
  if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);

  const onUpdateFound = (): void => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // "installed" + an existing controller ⇒ this is an UPDATE, not a first install.
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        setWaiting(installing);
      }
    });
  };
  registration.addEventListener("updatefound", onUpdateFound);

  const check = (): void => {
    registration.update().catch(() => {
      /* offline / transient — the next check retries */
    });
  };
  const onVisible = (): void => {
    if (document.visibilityState === "visible") check();
  };

  const timer = window.setInterval(check, intervalMs);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    registration.removeEventListener("updatefound", onUpdateFound);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}

/**
 * Apply the pending update: tell the waiting worker to take over, then reload once
 * it controls the page. Called only from an explicit user action.
 */
export function applyUpdate(): void {
  const sw = waiting;
  if (!sw) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  sw.postMessage({ type: "SKIP_WAITING" });
}
