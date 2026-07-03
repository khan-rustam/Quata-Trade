"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zForgotPasswordRequest } from "@quatatrade/shared";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/client";

type Values = z.infer<typeof zForgotPasswordRequest>;

export default function ForgotPage(): React.JSX.Element {
  const tx = useTranslations("authForgot");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(zForgotPasswordRequest), mode: "onBlur" });

  const submit = handleSubmit(async (values) => {
    // Always show success — no account enumeration (§08 E).
    await api.forgotPassword(values).catch(() => undefined);
    setSent(true);
  });

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">{tx("title")}</h1>
        <p className="mt-1 text-sm text-text-2">{tx("subtitle")}</p>
      </div>

      {sent ? (
        <Alert tone="success" title={tx("sentTitle")}>
          {tx("sentBody")}
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={tx("emailLabel")} error={errors.email?.message} required>
            {(p) => <Input type="email" autoComplete="email" placeholder={tx("emailPlaceholder")} {...p} {...register("email")} />}
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : tx("submit")}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-text-2">
        <Link href="/login" className="font-medium text-accent-400 hover:underline">
          {tx("backToLogin")}
        </Link>
      </p>
    </Card>
  );
}
