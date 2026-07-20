"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight accessible modal: focus moves in on open, Escape + backdrop close,
 * body scroll locked, role=dialog/aria-modal. Used for confirms + 2FA/PIN steps.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Remember what had focus so we can hand it back when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab / Shift+Tab cycling inside the modal (WCAG 2.4.3 /
      // 2.1.2) instead of leaking to the page behind the backdrop.
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Prefer an element that asked for focus (e.g. the first OTP box) — focusing the
    // panel unconditionally stole it, forcing the user to click into the field.
    const autoTarget = panel?.querySelector<HTMLElement>("[data-autofocus]");
    (autoTarget ?? panel)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger so keyboard/SR context isn't lost on close.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? "qt-dialog-desc" : undefined}
        tabIndex={-1}
        className={cn(
          "w-full max-w-md rounded-t-2xl border border-border bg-surface-1 p-5 outline-none sm:rounded-2xl",
          "qt-animate-dialog motion-reduce:animate-none",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-medium text-text-1">{title}</h2>
            {description && (
              <p id="qt-dialog-desc" className="text-sm text-text-2">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text-1"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
