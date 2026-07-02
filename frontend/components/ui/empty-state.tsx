import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Empty state — invites the next action instead of showing a void
 * (Documents/11 §11.9: "No offers yet for Orange Money — create the first one").
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-2">
        <Icon size={22} aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-display text-base font-medium text-text-1">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-text-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}
