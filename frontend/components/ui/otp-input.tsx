"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * 6-digit code input (email OTP, 2FA). Auto-advance, backspace-to-prev,
 * arrow nav, paste-fills. One logical value; each box mirrors a character.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  "aria-label": ariaLabel = "Verification code",
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  invalid?: boolean;
}): React.JSX.Element {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(length).slice(0, length).split("");

  const setChar = (i: number, c: string) => {
    const next = value.split("");
    next[i] = c;
    onChange(next.join("").replace(/\s/g, "").slice(0, length));
    if (c && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
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
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          value={chars[i]?.trim() ?? ""}
          onChange={(e) => setChar(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className={cn(
            "h-12 w-full rounded-[10px] border bg-surface-2 text-center font-money text-lg text-text-1 outline-none transition-colors",
            "focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-accent-400/40",
            invalid ? "border-danger" : "border-border",
          )}
        />
      ))}
    </div>
  );
}
