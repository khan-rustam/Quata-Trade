"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zPassword } from "@quatatrade/shared";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

const schema = z.object({ password: zPassword });
type Values = z.infer<typeof schema>;

function ResetForm(): React.JSX.Element {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur" });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.resetPassword({ token, password: values.password });
      toast.success("Password updated", "Log in with your new password.");
      router.replace("/login");
    } catch (err) {
      setError(apiErrorMessage(err, "This reset link is invalid or expired"));
    }
  });

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <p className="mt-1 text-sm text-text-2">Choose a strong password you don&rsquo;t use elsewhere.</p>
      </div>

      {!token && (
        <Alert tone="warning" className="mb-4">
          This link is missing its token. Request a new reset email.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password?.message} required>
          {(p) => (
            <PasswordInput autoComplete="new-password" placeholder="••••••••" {...p} {...register("password")} />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
          {isSubmitting ? <Spinner /> : "Update password"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-2">
        <Link href="/login" className="font-medium text-accent-400 hover:underline">
          Back to login
        </Link>
      </p>
    </Card>
  );
}

export default function ResetPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Card className="flex h-64 items-center justify-center p-6"><Spinner size={24} /></Card>}>
      <ResetForm />
    </Suspense>
  );
}
