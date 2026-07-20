"use client";

import { useEffect, useState } from "react";

/**
 * Trailing-edge debounce for a value used in a query key.
 *
 * Keying a request directly on a text input fires one authenticated call per
 * keystroke — typing "1000.50" is seven. This settles first.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return settled;
}
