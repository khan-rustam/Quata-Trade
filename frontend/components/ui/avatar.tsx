import Image from "next/image";
import type { AvatarStyle } from "@quatatrade/shared";
import { cn } from "@/lib/utils";

/**
 * User/trader avatar via DiceBear (SVG). Deterministic from `seed` so a user
 * looks consistent everywhere; `style` lets the user pick a look (AVATAR_STYLES).
 * Rendered `unoptimized` — the host is allow-listed in next.config remotePatterns.
 */
const DEFAULT_STYLE: AvatarStyle = "notionists";
// Brand-cool pastels; DiceBear picks one per seed so the disc always has contrast on dark + light.
const BACKGROUNDS = "b6e3d4,c0f0e0,d9f2ec,cfe8ff,ffe7c2,f5d9e6";

export function avatarUrl(seed: string | null | undefined, style?: AvatarStyle | null): string {
  const s = encodeURIComponent((seed ?? "anon").toString().trim() || "anon");
  return `https://api.dicebear.com/9.x/${style ?? DEFAULT_STYLE}/svg?seed=${s}&radius=50&backgroundColor=${BACKGROUNDS}`;
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
  return (
    <Image
      src={avatarUrl(seed, style)}
      alt={name ?? ""}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 rounded-full bg-surface-2 ring-1 ring-border/60", className)}
      style={{ width: size, height: size }}
    />
  );
}
