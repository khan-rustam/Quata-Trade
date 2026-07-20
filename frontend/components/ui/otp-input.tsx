"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * 6-digit code input (email OTP, 2FA). Auto-advance, backspace-to-prev,
 * arrow nav, paste-fills, and fires `onComplete` once every box is filled so
 * the caller can auto-verify without a separate button press.
 *
 * Value is the concatenated digits (no spaces); box i renders value[i].
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus,
  disabled,
  "aria-label": ariaLabel = "Verification code",
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fired once with the full code when the last digit lands (auto-verify). */
  onComplete?: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  invalid?: boolean;
}): React.JSX.Element {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.replace(/\D/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, i) => digits[i] ?? "");

  const focusBox = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    el.focus();
    el.select();
    // Belt and braces: if a re-render or a modal focus-trap steals focus in the same
    // tick, re-assert it on the next frame so auto-advance can't silently fail.
    requestAnimationFrame(() => {
      if (document.activeElement !== el) {
        el.focus();
        el.select();
      }
    });
  };

  const emit = (next: string): string => {
    const v = next.replace(/\D/g, "").slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
    return v;
  };

  const setChar = (i: number, raw: string) => {
    const c = raw.replace(/\D/g, "").slice(-1); // keep only the last typed digit
    const arr = chars.slice();
    arr[i] = c;
    emit(arr.join(""));
    if (c && i < length - 1) focusBox(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (chars[i]) {
        // clear the current box in place
        const arr = chars.slice();
        arr[i] = "";
        emit(arr.join(""));
      } else if (i > 0) {
        focusBox(i - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) focusBox(i - 1);
    if (e.key === "ArrowRight" && i < length - 1) focusBox(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const v = emit(pasted);
    focusBox(Math.min(v.length, length - 1));
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          // Lets Dialog hand initial focus here instead of the panel (see dialog.tsx).
          data-autofocus={autoFocus && i === 0 ? "" : undefined}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          value={chars[i] ?? ""}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={onPaste}
          className={cn(
            "h-12 w-full rounded-btn border bg-surface-2 text-center font-money text-lg text-text-1 outline-none transition-colors",
            "focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-accent-400/40",
            "disabled:opacity-50",
            invalid ? "border-danger" : "border-border",
          )}
        />
      ))}
    </div>
  );
}
