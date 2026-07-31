"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { KeyRound, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type {
  AiCredentialStatus,
  AiDraftKind,
  AiLocale,
} from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

/**
 * Admin → Content → AI.
 *
 * Two things live here: the OpenAI key, and a drafting playground that uses
 * it.
 *
 * ## The key field is write-only, and that is a deliberate UX cost
 *
 * There is no "show key" toggle, no masked preview, and no prefill — because
 * the API has no route that returns the key, so there is nothing to prefill
 * from. What an admin gets instead is a **fingerprint**: the first 8 hex
 * characters of its SHA-256. That answers the only question anyone actually
 * has ("is the key in there the one I think it is?") without the value ever
 * leaving the server.
 *
 * The alternative — showing `sk-...abcd` — feels more helpful and is worse:
 * it puts real key material into a screenshot, a screen share, and a browser
 * cache, in exchange for information a fingerprint already provides.
 *
 * ## Drafting is separate from the key
 *
 * Anyone with content-editing rights can draft. Only a SUPER_ADMIN can set
 * the key, because holding the credential that bills the OpenAI account is a
 * different job from writing an FAQ. The server enforces both; this component
 * simply renders what it is told.
 */

const DRAFT_KINDS: { value: AiDraftKind; key: string }[] = [
  { value: "faq_answer", key: "aiKindFaq" },
  { value: "company_blurb", key: "aiKindBlurb" },
  { value: "review_reply", key: "aiKindReviewReply" },
];

export function AiSettingsSection(): React.JSX.Element {
  return (
    <div className="space-y-5">
      <CredentialCard />
      <DraftingCard />
    </div>
  );
}

function CredentialCard(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const { success: toastOk, error: toastErr } = useToast();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");

  const status = useQuery({
    queryKey: ["admin-ai-credentials"],
    queryFn: () => adminApi.adminAiCredentials(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => adminApi.adminSetAiCredentials({ apiKey: apiKey.trim() }),
    onSuccess: (next: AiCredentialStatus) => {
      // Cleared immediately on success: a key sitting in a React state field
      // survives every re-render and ends up in a devtools snapshot.
      setApiKey("");
      toastOk(tx("aiKeySaved", { fingerprint: next.fingerprint ?? "?" }));
      void qc.invalidateQueries({ queryKey: ["admin-ai-credentials"] });
      void qc.invalidateQueries({ queryKey: ["admin-ai-status"] });
    },
    onError: (e: unknown) =>
      toastErr(apiErrorMessage(e)),
  });

  const clear = useMutation({
    mutationFn: () => adminApi.adminClearAiCredentials(),
    onSuccess: () => {
      toastOk(tx("aiKeyRemoved"));
      void qc.invalidateQueries({ queryKey: ["admin-ai-credentials"] });
      void qc.invalidateQueries({ queryKey: ["admin-ai-status"] });
    },
    onError: (e: unknown) =>
      toastErr(apiErrorMessage(e)),
  });

  if (status.isLoading) {
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  // 403 here means "you are an admin, but not a SUPER_ADMIN". Say so plainly
  // rather than rendering a form whose submit will always fail.
  if (status.isError) {
    return (
      <Card className="space-y-2 p-5">
        <h3 className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4" /> {tx("aiKeyTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
{tx("aiKeyNoPermission")}
        </p>
      </Card>
    );
  }

  const s = status.data;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4" /> OpenAI key
        </h3>
        {s?.configured ? (
          <Badge tone="success">
            {s.source === "env" ? tx("aiKeyFromEnv") : tx("aiKeyConfigured")}
          </Badge>
        ) : (
          <Badge tone="neutral">{tx("aiKeyMissing")}</Badge>
        )}
      </div>

      {s?.configured && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{tx("aiKeyFingerprint")}</dt>
            <dd className="font-mono">{s.fingerprint}</dd>
          </div>
          {s.updatedAt && (
            <div>
              <dt className="text-muted-foreground">{tx("aiKeyLastSet")}</dt>
              <dd>{new Date(s.updatedAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
<span>{tx("aiKeyNotice")}</span>
      </p>

      <Field label={tx("aiKeyNewLabel")} hint={tx("aiKeyNewHint")}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => save.mutate()}
          disabled={apiKey.trim().length < 20 || save.isPending}
        >
          {save.isPending ? tx("aiKeySaving") : tx("aiKeySave")}
        </Button>
        {s?.source === "admin" && (
          <Button
            variant="ghost"
            onClick={() => clear.mutate()}
            disabled={clear.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {tx("aiKeyRemove")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function DraftingCard(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const { error: toastErr } = useToast();
  const [kind, setKind] = useState<AiDraftKind>("faq_answer");
  const [locale, setLocale] = useState<AiLocale>("en");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");

  const status = useQuery({
    queryKey: ["admin-ai-status"],
    queryFn: () => adminApi.adminAiStatus(),
    retry: false,
  });

  const draft = useMutation({
    mutationFn: () => adminApi.adminAiDraft({ kind, prompt: prompt.trim(), locale }),
    onSuccess: (r) => setOutput(r.text),
    onError: (e: unknown) =>
      toastErr(apiErrorMessage(e)),
  });

  const translate = useMutation({
    mutationFn: () =>
      adminApi.adminAiTranslate({
        text: output,
        from: locale,
        to: locale === "en" ? "fr" : "en",
      }),
    onSuccess: (r) => setOutput(r.text),
    onError: (e: unknown) =>
      toastErr(apiErrorMessage(e)),
  });

  const enabled = status.data?.enabled ?? false;

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4" /> {tx("aiDraftTitle")}
      </h3>

      {!enabled && (
        <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {status.data?.reason ?? tx("aiDraftUnavailable")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tx("aiDraftType")}>
          {(p) => (
            <select
              {...p}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as AiDraftKind)}
            >
              {DRAFT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {tx(k.key)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={tx("aiDraftLanguage")}>
          {(p) => (
            <select
              {...p}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={locale}
              onChange={(e) => setLocale(e.target.value as AiLocale)}
            >
              <option value="en">{tx("aiLangEn")}</option>
              <option value="fr">{tx("aiLangFr")}</option>
            </select>
          )}
        </Field>
      </div>

      <Field label={tx("aiDraftPromptLabel")}>
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={tx("aiDraftPromptPlaceholder")}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => draft.mutate()}
          disabled={!enabled || prompt.trim().length < 3 || draft.isPending}
        >
          {draft.isPending ? tx("aiDrafting") : tx("aiDraftGo")}
        </Button>
        {output && (
          <Button
            variant="ghost"
            onClick={() => translate.mutate()}
            disabled={!enabled || translate.isPending}
          >
            {translate.isPending
              ? tx("aiTranslating")
              : tx("aiTranslateTo", {
                  language: locale === "en" ? tx("aiLangFr") : tx("aiLangEn"),
                })}
          </Button>
        )}
      </div>

      {output && (
        <Field
          label={tx("aiDraftOutputLabel")}
          hint={tx("aiDraftOutputHint")}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={7}
              value={output}
              onChange={(e) => setOutput(e.target.value)}
            />
          )}
        </Field>
      )}
    </Card>
  );
}
