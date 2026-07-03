"use client";

import { Shuffle } from "lucide-react";
import { AVATAR_STYLES, type AvatarStyle } from "@quatatrade/shared";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Pick a DiceBear avatar: choose a style, and "shuffle" for a new face (seed).
 * No photo uploads (avoids the image-safety pipeline) — deterministic + safe.
 * `seed` null → falls back to the user id, so an untouched avatar stays stable.
 */
export function AvatarPicker({
  userId,
  style,
  seed,
  onChange,
}: {
  userId: string;
  style: AvatarStyle | null;
  seed: string | null;
  onChange: (next: { style: AvatarStyle | null; seed: string | null }) => void;
}): React.JSX.Element {
  const effectiveSeed = seed ?? userId;
  const shuffle = () => {
    // Frontend-only randomness (allowed; only workflow scripts ban Math.random).
    const next = Math.random().toString(36).slice(2, 10);
    onChange({ style, seed: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar seed={effectiveSeed} style={style} size={64} />
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 rounded-btn border border-border px-3 py-1.5 text-sm font-medium text-text-1 transition-colors hover:bg-surface-2"
        >
          <Shuffle size={14} aria-hidden /> Shuffle face
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {AVATAR_STYLES.map((st) => {
          const selected = style === st || (style === null && st === "notionists");
          return (
            <button
              key={st}
              type="button"
              onClick={() => onChange({ style: st, seed })}
              aria-label={`Avatar style ${st}`}
              aria-pressed={selected}
              className={cn(
                "rounded-lg border p-1 transition-colors",
                selected ? "border-accent-400 bg-accent-400/10" : "border-border hover:border-accent-400/50",
              )}
            >
              <Avatar seed={effectiveSeed} style={st} size={44} className="mx-auto" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
