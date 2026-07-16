/**
 * PWA install capture. `beforeinstallprompt` fires once per page load (Chrome/Edge
 * on Android + desktop) and must be captured EARLY — before any UI mounts — or the
 * chance to show a custom "Install app" button is lost. We stash it in a module
 * singleton (initialised from the root layout on every page) and let the download
 * page's button read/subscribe to it.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) cb();
}

/** Register the window listeners once. Safe to call on every page (idempotent). */
export function initInstallCapture(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __qtInstallInit?: boolean };
  if (w.__qtInstallInit) return;
  w.__qtInstallInit = true;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault(); // stop Chrome's default mini-infobar; we show our own button
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** Consume the prompt (single-use per Chrome spec). */
export function clearInstallPrompt(): void {
  deferred = null;
  notify();
}

export function onInstallChange(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
