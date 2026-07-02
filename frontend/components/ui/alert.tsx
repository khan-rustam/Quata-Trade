import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const config: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  success: { cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning/10 text-warning", Icon: AlertTriangle },
  danger: { cls: "border-danger/30 bg-danger/10 text-danger", Icon: ShieldAlert },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}): React.JSX.Element {
  const { cls, Icon } = config[tone];
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-text-1/90">{children}</div>}
      </div>
    </div>
  );
}
