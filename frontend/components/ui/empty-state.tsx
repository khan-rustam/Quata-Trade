import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import Image from "next/image";

/**
 * Empty state — invites the next action instead of showing a void
 * (Documents/11 §11.9: "No offers yet for Orange Money — create the first one").
 *
 * Pass `image` for an illustrated empty state (offers, wallet, notifications);
 * otherwise a small `icon` chip is used.
 */
export function EmptyState({
  icon: Icon,
  image,
  title,
  description,
  action,
}: {
  icon?: ComponentType<LucideProps>;
  image?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {image ? (
        <Image src={image} alt="" width={128} height={128} className="h-28 w-28 opacity-90" />
      ) : Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-2">
          <Icon size={22} aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-base font-medium text-text-1">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-text-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}
