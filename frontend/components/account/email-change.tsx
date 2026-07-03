"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";

type Stage = "idle" | "form" | "code";

/**
 * Change account email: enter new address + password → a 6-digit code is sent to
 * the NEW address → confirm the code to swap it in. Backed by
 * POST /users/me/email and /users/me/email/verify.
 */
export function EmailChange({
  currentEmail,
  pendingEmail,
}: {
  currentEmail: string;
  pendingEmail: string | null;
}): React.JSX.Element {
  const qc = useQueryClient();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>(pendingEmail ? "code" : "idle");
  const [newEmail, setNewEmail] = useState(pendingEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.changeEmail({ newEmail: newEmail.trim(), password });
      await qc.invalidateQueries({ queryKey: qk.me });
      setPassword("");
      setStage("code");
      toast.success("Code sent", `Check ${newEmail.trim()} for a confirmation code.`);
    } catch (err) {
      toast.error("Could not start email change", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.verifyEmailChange({ code });
      await qc.invalidateQueries({ queryKey: qk.me });
      setStage("idle");
      setCode("");
      setNewEmail("");
      toast.success("Email updated");
    } catch (err) {
      toast.error("Could not confirm", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (stage === "idle") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-text-3">Email</p>
          <p className="truncate text-sm text-text-1">{currentEmail}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setStage("form")}>
          Change
        </Button>
      </div>
    );
  }

  if (stage === "form") {
    return (
      <form onSubmit={request} className="space-y-3" noValidate>
        <Field label="New email">
          {(p) => (
            <Input
              {...p}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          )}
        </Field>
        <Field label="Current password">
          {(p) => (
            <Input
              {...p}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !newEmail.trim() || !password}>
            {busy ? <Spinner /> : "Send code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStage("idle");
              setPassword("");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-3" noValidate>
      <p className="text-sm text-text-2">
        Enter the 6-digit code we sent to <span className="text-text-1">{pendingEmail ?? newEmail}</span>.
      </p>
      <Field label="Confirmation code">
        {(p) => (
          <Input
            {...p}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="font-money tracking-[0.3em]"
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
          {busy ? <Spinner /> : "Confirm email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setStage("idle");
            setCode("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
