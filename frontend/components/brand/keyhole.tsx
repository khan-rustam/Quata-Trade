/**
 * The Q-key / keyhole glyph — the brand signature (Documents/11 §11.5).
 * The counter of the Q reads as a keyhole. Used as the app mark and the
 * "escrow locked" state icon so brand and product tell one story.
 */
export function Keyhole({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2.5" />
      {/* keyhole: circle counter + tail */}
      <circle cx="16" cy="13.5" r="3.5" fill="currentColor" />
      <path
        d="M16 16.5 L16 22 L20 26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
