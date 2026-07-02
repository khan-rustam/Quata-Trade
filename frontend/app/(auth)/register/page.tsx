"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zRegisterRequest, type RegisterRequest } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useRegister } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api/errors";

type FormValues = RegisterRequest & { acceptTerms: true };

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const registerMut = useRegister();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(zRegisterRequest),
    mode: "onBlur",
    defaultValues: { country: "CM" },
  });

  // Optional text fields submit "" when untouched — coerce to undefined so the
  // `.optional()` zod rules accept them instead of failing the format check.
  const emptyToUndefined = { setValueAs: (v: string) => (v.trim() === "" ? undefined : v) };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerMut.mutateAsync(values);
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not create your account"));
    }
  });

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-text-2">Crypto to cash. Protected.</p>
      </div>

      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            {(p) => <Input autoComplete="given-name" placeholder="Marie" {...p} {...register("firstName", emptyToUndefined)} />}
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            {(p) => <Input autoComplete="family-name" placeholder="Nkeng" {...p} {...register("lastName", emptyToUndefined)} />}
          </Field>
        </div>
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} {...register("email")} />}
        </Field>
        <Field label="Phone" hint="Optional — E.164, e.g. +2376XXXXXXXX" error={errors.phone?.message}>
          {(p) => <Input type="tel" autoComplete="tel" placeholder="+2376XXXXXXXX" {...p} {...register("phone", emptyToUndefined)} />}
        </Field>
        <Field
          label="Password"
          hint="At least 10 characters, with upper, lower, and a number."
          error={errors.password?.message}
          required
        >
          {(p) => (
            <Input type="password" autoComplete="new-password" placeholder="••••••••" {...p} {...register("password")} />
          )}
        </Field>

        <label className="flex items-start gap-2.5 text-sm text-text-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border accent-accent-400"
            {...register("acceptTerms")}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-accent-400 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent-400 hover:underline">
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-400 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
