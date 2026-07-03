"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

/**
 * Public contact form. Posts to the content enquiries endpoint, which lands the
 * message in the admin enquiries inbox (the operator replies from their own
 * email). No payment or account data is ever collected here.
 */
export function ContactForm(): React.JSX.Element {
  const t = useTranslations("contact");
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.submitEnquiry({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
      }),
    onSuccess: () => {
      setDone(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      toast.success(t("successTitle"), t("successBody"));
    },
    onError: (err) => toast.error(t("errorTitle"), apiErrorMessage(err)),
  });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-8 text-center">
        <CheckCircle2 size={32} className="text-success" aria-hidden />
        <p className="font-display text-lg font-semibold">{t("successTitle")}</p>
        <p className="max-w-sm text-sm text-text-2">{t("successBody")}</p>
        <Button variant="secondary" size="sm" onClick={() => setDone(false)}>
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface-1 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <div>
        <h2 className="font-display text-lg font-semibold">{t("formTitle")}</h2>
        <p className="mt-0.5 text-sm text-text-2">{t("formSubtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("nameLabel")} required>
          {(p) => (
            <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          )}
        </Field>
        <Field label={t("emailLabel")} required>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          )}
        </Field>
      </div>
      <Field label={t("subjectLabel")}>
        {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />}
      </Field>
      <Field label={t("messageLabel")} required>
        {(p) => (
          <Textarea
            {...p}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={5}
            maxLength={4000}
            required
          />
        )}
      </Field>
      <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
        {submit.isPending ? t("sending") : t("submit")}
        {!submit.isPending && <Send size={15} aria-hidden />}
      </Button>
    </form>
  );
}
