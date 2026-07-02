export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  document.cookie = `qt_theme=${next};path=/;max-age=31536000;samesite=lax`;
  for (const l of listeners) l();
}

export function toggleTheme(): void {
  setTheme(readTheme() === "dark" ? "light" : "dark");
}

/** useSyncExternalStore wiring — reads the DOM/cookie without setState-in-effect. */
export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getThemeSnapshot(): Theme {
  return readTheme();
}
export function getThemeServerSnapshot(): Theme {
  return "dark";
}
