"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Pencil, Star, Trash2 } from "lucide-react";
import type { CompanyInfo, Faq, Review, UpsertFaqRequest, UpsertReviewRequest } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type Tab = "company" | "faq" | "reviews";
const SOCIALS = ["facebook", "x", "instagram", "linkedin", "telegram"] as const;

export default function AdminContentPage(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const [tab, setTab] = useState<Tab>("company");
  return (
    <div className="space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />
      <Segmented
        value={tab}
        onChange={setTab}
        aria-label={tx("pageTitle")}
        options={[
          { value: "company", label: tx("tabCompany") },
          { value: "faq", label: tx("tabFaq") },
          { value: "reviews", label: tx("tabReviews") },
        ]}
      />
      {tab === "company" && <CompanySection />}
      {tab === "faq" && <FaqSection />}
      {tab === "reviews" && <ReviewSection />}
    </div>
  );
}

function CompanySection(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "company"], queryFn: () => adminApi.company() });
  const [form, setForm] = useState<CompanyInfo | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Seed the form once the query resolves ("adjust state during render", no effect).
  if (data && loadedFor !== data.email + data.name) {
    setForm(data);
    setLoadedFor(data.email + data.name);
  }

  const save = useMutation({
    mutationFn: () => adminApi.adminUpdateCompany(form ?? {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "company"] });
      void qc.invalidateQueries({ queryKey: ["company"] });
      toast.success(tx("companySaved"));
    },
    onError: (err) => toast.error(tx("saveError"), apiErrorMessage(err)),
  });

  if (isLoading || !form) return <Skeleton className="h-96 w-full rounded-xl" />;
  const set = (k: keyof Omit<CompanyInfo, "social">, v: string) => setForm({ ...form, [k]: v });

  const fields: { key: keyof Omit<CompanyInfo, "social">; label: string; type?: string; placeholder?: string }[] = [
    { key: "name", label: tx("cName") },
    { key: "legalName", label: tx("cLegalName") },
    { key: "email", label: tx("cEmail"), type: "email" },
    { key: "phone", label: tx("cPhone") },
    { key: "whatsapp", label: tx("cWhatsapp") },
    { key: "registrationNo", label: tx("cRegistration") },
    { key: "addressLine", label: tx("cAddress") },
    { key: "city", label: tx("cCity") },
    { key: "country", label: tx("cCountry") },
    { key: "tagline", label: tx("cTagline") },
  ];

  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {(p) => (
              <Input {...p} type={f.type} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
      <p className="pt-1 text-xs font-medium uppercase tracking-wide text-text-3">{tx("socialTitle")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIALS.map((s) => (
          <Field key={s} label={tx(`social_${s}`)}>
            {(p) => (
              <Input
                {...p}
                value={form.social[s]}
                onChange={(e) => setForm({ ...form, social: { ...form.social, [s]: e.target.value } })}
                placeholder="https://…"
              />
            )}
          </Field>
        ))}
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {tx("saveCompany")}
      </Button>
    </Card>
  );
}

const EMPTY_FAQ: UpsertFaqRequest = { category: "general", question: "", answer: "", published: true };

function FaqSection(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "faqs"], queryFn: () => adminApi.adminFaqs() });
  const [draft, setDraft] = useState<UpsertFaqRequest>(EMPTY_FAQ);
  const editing = Boolean(draft.id);

  const reset = () => setDraft(EMPTY_FAQ);
  const save = useMutation({
    mutationFn: () => adminApi.adminUpsertFaq(draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "faqs"] });
      toast.success(tx("faqSaved"));
      reset();
    },
    onError: (err) => toast.error(tx("saveError"), apiErrorMessage(err)),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.adminDeleteFaq(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "faqs"] });
      toast.success(tx("faqDeleted"));
    },
    onError: (err) => toast.error(tx("saveError"), apiErrorMessage(err)),
  });
  const startEdit = (f: Faq) =>
    setDraft({ id: f.id, category: f.category, question: f.question, answer: f.answer, sortOrder: f.sortOrder, published: f.published });

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="font-medium">{editing ? tx("faqEditTitle") : tx("faqNewTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("faqCategory")}>
            {(p) => <Input {...p} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />}
          </Field>
          <Field label={tx("faqQuestion")}>
            {(p) => <Input {...p} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />}
          </Field>
        </div>
        <Field label={tx("faqAnswer")}>
          {(p) => (
            <Textarea {...p} value={draft.answer} rows={3} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
          )}
        </Field>
        {/* published/sortOrder were only ever carried through from the loaded row,
            so a published item could never be taken down and ordering could not be
            changed from the console at all. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("visibility")}>
            {() => (
              <Segmented
                value={draft.published ? "published" : "draft"}
                onChange={(v) => setDraft({ ...draft, published: v === "published" })}
                aria-label={tx("visibility")}
                className="w-full"
                options={[
                  { value: "published", label: tx("visiblePublished"), tone: "success" },
                  { value: "draft", label: tx("visibleDraft") },
                ]}
              />
            )}
          </Field>
          <Field label={tx("sortOrder")} hint={tx("sortOrderHint")}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={String(draft.sortOrder ?? 0)}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value.replace(/\D/g, "") || 0) })}
              />
            )}
          </Field>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || draft.question.length < 3 || draft.answer.length < 3}>
            {editing ? tx("save") : tx("addFaq")}
          </Button>
          {editing && (
            <Button size="sm" variant="ghost" onClick={reset}>
              {tx("cancel")}
            </Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="space-y-2">
          {(data?.items ?? []).map((f) => (
            <Card key={f.id} className={cn("flex items-start justify-between gap-3", draft.id === f.id && "border-accent-400/50")}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{f.category}</Badge>
                  {!f.published && <Badge tone="warning">{tx("draft")}</Badge>}
                </div>
                <p className="mt-1 font-medium">{f.question}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-text-2">{f.answer}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-label={tx("edit")} onClick={() => startEdit(f)}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="ghost" aria-label={tx("delete")} onClick={() => del.mutate(f.id)}>
                  <Trash2 size={14} className="text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_REVIEW: UpsertReviewRequest = { authorName: "", location: "", rating: 5, body: "", published: true };

function ReviewSection(): React.JSX.Element {
  const tx = useTranslations("adminContent");
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "reviews"], queryFn: () => adminApi.adminReviews() });
  const [draft, setDraft] = useState<UpsertReviewRequest>(EMPTY_REVIEW);
  const editing = Boolean(draft.id);

  const reset = () => setDraft(EMPTY_REVIEW);
  const save = useMutation({
    mutationFn: () => adminApi.adminUpsertReview(draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(tx("reviewSaved"));
      reset();
    },
    onError: (err) => toast.error(tx("saveError"), apiErrorMessage(err)),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.adminDeleteReview(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(tx("reviewDeleted"));
    },
    onError: (err) => toast.error(tx("saveError"), apiErrorMessage(err)),
  });
  const startEdit = (r: Review) =>
    setDraft({ id: r.id, authorName: r.authorName, location: r.location, rating: r.rating, body: r.body, sortOrder: r.sortOrder, published: r.published });

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="font-medium">{editing ? tx("reviewEditTitle") : tx("reviewNewTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("reviewAuthor")}>
            {(p) => <Input {...p} value={draft.authorName} onChange={(e) => setDraft({ ...draft, authorName: e.target.value })} />}
          </Field>
          <Field label={tx("reviewLocation")}>
            {(p) => <Input {...p} value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />}
          </Field>
        </div>
        <Field label={tx("reviewRating")}>
          {() => (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n}`} onClick={() => setDraft({ ...draft, rating: n })}>
                  <Star size={22} className={n <= draft.rating ? "fill-warning text-warning" : "text-text-3"} />
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label={tx("reviewBody")}>
          {(p) => <Textarea {...p} value={draft.body} rows={3} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />}
        </Field>
        {/* published/sortOrder were only ever carried through from the loaded row,
            so a published item could never be taken down and ordering could not be
            changed from the console at all. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("visibility")}>
            {() => (
              <Segmented
                value={draft.published ? "published" : "draft"}
                onChange={(v) => setDraft({ ...draft, published: v === "published" })}
                aria-label={tx("visibility")}
                className="w-full"
                options={[
                  { value: "published", label: tx("visiblePublished"), tone: "success" },
                  { value: "draft", label: tx("visibleDraft") },
                ]}
              />
            )}
          </Field>
          <Field label={tx("sortOrder")} hint={tx("sortOrderHint")}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={String(draft.sortOrder ?? 0)}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value.replace(/\D/g, "") || 0) })}
              />
            )}
          </Field>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || draft.authorName.length < 1 || draft.body.length < 3}>
            {editing ? tx("save") : tx("addReview")}
          </Button>
          {editing && (
            <Button size="sm" variant="ghost" onClick={reset}>
              {tx("cancel")}
            </Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (data?.items ?? []).length === 0 ? (
        <Card className="text-center text-sm text-text-3">{tx("reviewsEmpty")}</Card>
      ) : (
        <div className="space-y-2">
          {(data?.items ?? []).map((r) => (
            <Card key={r.id} className={cn("flex items-start justify-between gap-3", draft.id === r.id && "border-accent-400/50")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.authorName}</span>
                  {r.location && <span className="text-xs text-text-3">{r.location}</span>}
                  {!r.published && <Badge tone="warning">{tx("draft")}</Badge>}
                </div>
                <div className="mt-0.5 flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} className={n <= r.rating ? "fill-warning text-warning" : "text-text-3"} />
                  ))}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-text-2">{r.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-label={tx("edit")} onClick={() => startEdit(r)}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="ghost" aria-label={tx("delete")} onClick={() => del.mutate(r.id)}>
                  <Trash2 size={14} className="text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
