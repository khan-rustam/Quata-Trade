"use client";

import { useEffect } from "react";
import { initInstallCapture } from "@/lib/pwa-install";

/**
 * Registers the service worker (production only, so dev HMR is untouched) and starts
 * capturing the `beforeinstallprompt` event as early as possible. Mounted once in the
 * root layout, so install capture is armed on every page. Renders nothing.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    initInstallCapture();

    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = (): void => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failure must never break the app */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
