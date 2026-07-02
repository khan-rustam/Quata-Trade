"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zAdminLoginRequest } from "@quatatrade/shared";

// TOTP is tracked outside RHF (OTP boxes), so the resolver validates only
// email + password; the code is attached at submit.
const zCredentials = zAdminLoginRequest.omit({ totpCode: true });
type Credentials = { email: string; password: string };
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Keyhole } from "@/components/brand/keyhole";
import { useAdminLogin } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const login = useAdminLogin();
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
      await login.mutateAsync({ ...values, totpCode: totp });
      router.replace("/admin");
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid credentials"));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Keyhole size={32} className="text-accent-400" />
          <h1 className="font-display text-xl font-bold">Quata Admin</h1>
          <p className="flex items-center gap-1.5 text-sm text-text-2">
            <ShieldCheck size={14} className="text-accent-400" /> 2FA is mandatory for all admins
          </p>
        </div>
        <Card className="p-6">
          {error && (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email" error={errors.email?.message} required>
              {(p) => <Input type="email" autoComplete="username" placeholder="admin@quatatrade.com" {...p} {...register("email")} />}
            </Field>
            <Field label="Password" error={errors.password?.message} required>
              {(p) => <Input type="password" autoComplete="current-password" placeholder="••••••••" {...p} {...register("password")} />}
            </Field>
            <div className="space-y-2">
              <label className="text-sm font-medium">Authenticator code</label>
              <OtpInput value={totp} onChange={setTotp} aria-label="Authenticator code" invalid={Boolean(error)} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || totp.length < 6}>
              {isSubmitting ? <Spinner /> : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
