import { useId, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** render prop receives the id + aria props to spread on the control */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/**
 * Accessible field wrapper: label ↔ control association, hint + inline error
 * with icon, aria-invalid/aria-describedby wired automatically.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps): React.JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = error ? errId : hint ? hintId : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text-1">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={errId} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle size={14} aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
