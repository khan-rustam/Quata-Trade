"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { zRegisterRequest, type RegisterRequest } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useRegister } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api/errors";

type FormValues = RegisterRequest & { acceptTerms: true };

// One RHF form, walked one question at a time. Each step validates only its own
// fields via trigger() before advancing; the final step submits the whole form.
const STEPS = [
  {
    key: "you",
    title: "What should we call you?",
    subtitle: "First things first — the name other traders will see.",
    fields: ["firstName", "lastName"],
  },
  {
    key: "contact",
    title: "How do we reach you?",
    subtitle: "We send your verification link and trade alerts here.",
    fields: ["email", "phone"],
  },
  {
    key: "secure",
    title: "Lock it down",
    subtitle: "One strong password and your account is ready.",
    fields: ["password", "acceptTerms"],
  },
] as const;
const LAST = STEPS.length - 1;

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const registerMut = useRegister();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(zRegisterRequest),
    mode: "onBlur",
    defaultValues: { country: "CM" },
  });

  // Optional text fields submit "" when untouched — coerce to undefined so the
  // `.optional()` zod rules accept them instead of failing the format check.
  const emptyToUndefined = { setValueAs: (v: string) => (v.trim() === "" ? undefined : v) };

  const submitForm = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerMut.mutateAsync(values);
      toast.success("Account created", "Check your email to verify your address.");
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not create your account"));
    }
  });

  const goNext = async () => {
    const ok = await trigger([...STEPS[step].fields], { shouldFocus: true });
    if (ok) {
      setFormError(null);
      setStep((s) => Math.min(s + 1, LAST));
    }
  };

  // Both Enter and the primary button route here: advance until the last step,
  // then submit.
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < LAST) void goNext();
    else void submitForm();
  };

  const current = STEPS[step];

  return (
    <Card className="p-6">
      {/* progress */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs text-text-3">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="flex items-center gap-1">
            <Sparkles size={12} className="text-accent-400" /> Crypto to cash. Protected.
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent-400 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* the step animates in on change; key remount also focuses its first field */}
      <div key={current.key} className="qt-animate-fade">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold tracking-tight">{current.title}</h1>
          <p className="mt-1 text-sm text-text-2">{current.subtitle}</p>
        </div>

        {formError && (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={errors.firstName?.message}>
                {(p) => <Input autoComplete="given-name" placeholder="Marie" autoFocus {...p} {...register("firstName", emptyToUndefined)} />}
              </Field>
              <Field label="Last name" error={errors.lastName?.message}>
                {(p) => <Input autoComplete="family-name" placeholder="Nkeng" {...p} {...register("lastName", emptyToUndefined)} />}
              </Field>
            </div>
          )}

          {step === 1 && (
            <>
              <Field label="Email" error={errors.email?.message} required>
                {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" autoFocus {...p} {...register("email")} />}
              </Field>
              <Field label="Phone" hint="Optional — E.164, e.g. +2376XXXXXXXX" error={errors.phone?.message}>
                {(p) => <Input type="tel" autoComplete="tel" placeholder="+2376XXXXXXXX" {...p} {...register("phone", emptyToUndefined)} />}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="Password"
                hint="At least 10 characters, with upper, lower, and a number."
                error={errors.password?.message}
                required
              >
                {(p) => <PasswordInput autoComplete="new-password" placeholder="••••••••" autoFocus {...p} {...register("password")} />}
              </Field>
              <label className="flex items-start gap-2.5 text-sm text-text-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border accent-accent-400" {...register("acceptTerms")} />
                <span>
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-accent-400 hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/privacy" className="text-accent-400 hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errors.acceptTerms && (
                <p role="alert" className="text-sm text-danger">
                  You must accept the terms to continue.
                </p>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setFormError(null);
                  setStep((s) => s - 1);
                }}
              >
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {step < LAST ? "Continue" : isSubmitting ? <Spinner /> : "Create account"}
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-text-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-400 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
