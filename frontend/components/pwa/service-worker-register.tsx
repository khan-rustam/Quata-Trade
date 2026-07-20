"use client";

import { useEffect } from "react";
import { initInstallCapture } from "@/lib/pwa-install";
import { watchForUpdates } from "@/lib/pwa-update";

/**
 * Registers the service worker (production only, so dev HMR is untouched), starts
 * capturing `beforeinstallprompt`, and watches for new deploys. Mounted once in the
 * root layout, so both install capture and update detection are armed on every page.
 * Renders nothing.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    initInstallCapture();

    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let stopWatching: (() => void) | undefined;

    const register = (): void => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          stopWatching = watchForUpdates(registration);
        })
        .catch(() => {
          /* registration failure must never break the app */
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => stopWatching?.();
  }, []);

  return null;
}
