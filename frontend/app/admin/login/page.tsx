"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zAdminLoginRequest } from "@quatatrade/shared";

// TOTP is tracked outside RHF (OTP boxes) and only appears once the backend
// asks for it, so the resolver validates just email + password.
const zCredentials = zAdminLoginRequest.omit({ totpCode: true });
type Credentials = { email: string; password: string };
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { BrandMark } from "@/components/brand/logo";
import { useAdminLogin } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const tx = useTranslations("adminLogin");
  const login = useAdminLogin();
  const [totpRequired, setTotpRequired] = useState(false);
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(zCredentials), mode: "onBlur" });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await login.mutateAsync({
        ...values,
        totpCode: totpRequired ? totp : undefined,
      });
      // Admin has 2FA on → the backend returns totpRequired with no token yet.
      if (res.totpRequired && !res.accessToken) {
        setTotpRequired(true);
        return;
      }
      router.replace("/admin");
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCredentials")));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandMark size={40} />
          <h1 className="font-display text-xl font-bold">{tx("title")}</h1>
          <p className="text-sm text-text-2">{tx("subtitle")}</p>
        </div>
        <Card className="p-6">
          {error && (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <fieldset disabled={totpRequired} className="space-y-4">
              <Field label={tx("emailLabel")} error={errors.email?.message} required>
                {(p) => <Input type="email" autoComplete="username" placeholder="admin@quatatrade.com" {...p} {...register("email")} />}
              </Field>
              <Field label={tx("passwordLabel")} error={errors.password?.message} required>
                {(p) => <PasswordInput autoComplete="current-password" placeholder="••••••••" {...p} {...register("password")} />}
              </Field>
            </fieldset>

            {totpRequired && (
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck size={14} className="text-accent-400" /> {tx("authenticatorCode")}
                </label>
                <OtpInput value={totp} onChange={setTotp} autoFocus aria-label={tx("authenticatorCode")} invalid={Boolean(error)} />
                <p className="text-sm text-text-2">{tx("authenticatorHint")}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || (totpRequired && totp.length < 6)}>
              {isSubmitting ? <Spinner /> : totpRequired ? tx("verifyAndSignIn") : tx("signIn")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
