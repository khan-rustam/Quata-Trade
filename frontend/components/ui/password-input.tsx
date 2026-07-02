"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide eye toggle. Forwards ref + all input props to
 * <Input>, so it drops into react-hook-form (`{...register("password")}`) and
 * <Field> render-props unchanged. The toggle is tabIndex={-1} so keyboard users
 * tab straight from the field to the next control, not onto the reveal button.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-11", className)} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={-1}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-text-3 transition-colors hover:text-text-1 focus-visible:text-accent-400 focus-visible:outline-none"
        >
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
