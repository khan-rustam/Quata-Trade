"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { zLoginRequest, type LoginRequest } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useLogin } from "@/hooks/use-auth";
import { apiErrorMessage } from "@/lib/api/errors";

export default function LoginPage(): React.JSX.Element {
  const t = useTranslations("nav");
  const router = useRouter();
  const login = useLogin();
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(zLoginRequest), mode: "onBlur" });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await login.mutateAsync({
        ...values,
        totpCode: totpRequired ? totpCode : undefined,
      });
      if (res.totpRequired && !res.accessToken) {
        setTotpRequired(true);
        return;
      }
      router.replace("/home");
    } catch (err) {
      setFormError(apiErrorMessage(err, "Invalid email or password"));
    }
  });

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-text-2">Log in to your QuataTrade account.</p>
      </div>

      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset disabled={totpRequired} className="space-y-4">
          <Field label="Email" error={errors.email?.message} required>
            {(p) => (
              <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} {...register("email")} />
            )}
          </Field>
          <Field label="Password" error={errors.password?.message} required>
            {(p) => (
              <PasswordInput autoComplete="current-password" placeholder="••••••••" {...p} {...register("password")} />
            )}
          </Field>
        </fieldset>

        {totpRequired && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-1">Two-factor code</p>
            <OtpInput value={totpCode} onChange={setTotpCode} autoFocus aria-label="Authenticator code" />
            <p className="text-sm text-text-2">Enter the 6-digit code from your authenticator app.</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting || (totpRequired && totpCode.length < 6)}>
          {isSubmitting ? <Spinner /> : totpRequired ? "Verify & log in" : t("login")}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-text-2 underline-offset-2 hover:text-text-1 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium text-accent-400 hover:underline">
          Create account
        </Link>
      </div>
    </Card>
  );
}
