"use client";

import { useState } from "react";
import type { AvatarStyle } from "@quatatrade/shared";
import { cn } from "@/lib/utils";

/**
 * User/trader avatar via DiceBear (SVG). Deterministic from `seed` so a user
 * looks consistent everywhere; `style` lets the user pick a look (AVATAR_STYLES).
 * A plain <img> (not next/image): the source is a tiny remote SVG that needs no
 * optimization, which also avoids next/image's fixed-dimension warnings.
 *
 * If DiceBear is unreachable (down, blocked, offline) the <img> would otherwise
 * render as a broken icon, so we fall back to a locally-drawn initials disc —
 * same seeded palette, no network — and the UI never shows a broken avatar.
 */
const DEFAULT_STYLE: AvatarStyle = "notionists";
// Brand-cool pastels; DiceBear picks one per seed so the disc always has contrast on dark + light.
const BACKGROUNDS = "b6e3d4,c0f0e0,d9f2ec,cfe8ff,ffe7c2,f5d9e6";
const FALLBACK_BG = ["#b6e3d4", "#c0f0e0", "#d9f2ec", "#cfe8ff", "#ffe7c2", "#f5d9e6"];

export function avatarUrl(seed: string | null | undefined, style?: AvatarStyle | null): string {
  const s = encodeURIComponent((seed ?? "anon").toString().trim() || "anon");
  return `https://api.dicebear.com/9.x/${style ?? DEFAULT_STYLE}/svg?seed=${s}&radius=50&backgroundColor=${BACKGROUNDS}`;
}

/** Stable hash so the same seed always lands on the same fallback colour. */
function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Up to two initials from a display name / seed for the offline fallback. */
function initialsOf(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  seed,
  name,
  style,
  size = 40,
  className,
}: {
  /** Stable identity: user id, chosen seed, email, or display name. */
  seed: string | null | undefined;
  /** Optional display name for the alt text; omit for decorative use next to a visible label. */
  name?: string;
  /** DiceBear style the user picked; falls back to the app default. */
  style?: AvatarStyle | null;
  size?: number;
  className?: string;
}): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const key = (seed ?? name ?? "anon").toString();

  if (failed) {
    const bg = FALLBACK_BG[seedHash(key) % FALLBACK_BG.length];
    return (
      <span
        role="img"
        aria-label={name || undefined}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-medium ring-1 ring-border/60",
          className,
        )}
        // Dark ink fixed regardless of theme — the fallback disc is always a light pastel.
        style={{ width: size, height: size, background: bg, color: "#0e1416", fontSize: Math.max(10, Math.round(size * 0.4)) }}
      >
        {initialsOf(name ?? key)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote DiceBear SVG; no optimization needed
    <img
      src={avatarUrl(seed, style)}
      alt={name ?? ""}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full bg-surface-2 object-cover ring-1 ring-border/60", className)}
      style={{ width: size, height: size }}
    />
  );
}
