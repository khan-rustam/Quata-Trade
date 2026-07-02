import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * User/trader avatar generated deterministically from a seed via DiceBear.
 * Same seed → same face, so a user looks consistent everywhere. Swap
 * AVATAR_STYLE to restyle every avatar in the app at once.
 *
 * SVG is served remotely (see next.config images.remotePatterns) and rendered
 * `unoptimized` — no need to enable dangerouslyAllowSVG on the image optimizer.
 */
const AVATAR_STYLE = "notionists";
// Brand-cool pastels; DiceBear picks one per seed so the disc always has contrast on dark + light.
const BACKGROUNDS = "b6e3d4,c0f0e0,d9f2ec,cfe8ff,ffe7c2,f5d9e6";

export function Avatar({
  seed,
  name,
  size = 40,
  className,
}: {
  /** Stable identity: user id, email, or display name. */
  seed: string | null | undefined;
  /** Optional display name for the alt text; omit for decorative use next to a visible label. */
  name?: string;
  size?: number;
  className?: string;
}): React.JSX.Element {
  const s = encodeURIComponent((seed ?? name ?? "anon").toString().trim() || "anon");
  const src = `https://api.dicebear.com/9.x/${AVATAR_STYLE}/svg?seed=${s}&radius=50&backgroundColor=${BACKGROUNDS}`;
  return (
    <Image
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 rounded-full bg-surface-2 ring-1 ring-border/60", className)}
      style={{ width: size, height: size }}
    />
  );
}
