"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

function VerifyForm(): React.JSX.Element {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const tx = useTranslations("authVerify");
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.verifyEmail({ email, code });
      toast.success(tx("verifiedTitle"), tx("verifiedBody"));
      router.replace("/login");
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCode")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-400/15 text-accent-400">
          <MailCheck size={22} />
        </div>
        <h1 className="font-display text-2xl font-bold">{tx("title")}</h1>
        <p className="mt-1 text-sm text-text-2">
          {tx("codeSentTo")}{" "}
          <span className="font-medium text-text-1">{email || tx("yourInbox")}</span>.
        </p>
      </div>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        <OtpInput value={code} onChange={setCode} autoFocus invalid={Boolean(error)} />
        <Button className="w-full" onClick={verify} disabled={busy || code.length < 6}>
          {busy ? <Spinner /> : tx("submit")}
        </Button>
      </div>

      <p className="mt-4 text-center text-sm text-text-2">
        {tx("wrongAddress")}{" "}
        <Link href="/register" className="font-medium text-accent-400 hover:underline">
          {tx("startOver")}
        </Link>
      </p>
    </Card>
  );
}

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Card className="flex h-64 items-center justify-center p-6"><Spinner size={24} /></Card>}>
      <VerifyForm />
    </Suspense>
  );
}
