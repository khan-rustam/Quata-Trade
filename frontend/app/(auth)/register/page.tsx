"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { zRegisterRequest, type RegisterRequest } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useRegister } from "@/hooks/use-auth";
import { useCountries } from "@/hooks/use-countries";
import { CM_MARKET } from "@/hooks/use-user-market";
import { apiErrorMessage } from "@/lib/api/errors";

/** Fallback so the picker is never empty before /countries resolves (CM is always live). */
const FALLBACK_COUNTRIES = [CM_MARKET];

type FormValues = RegisterRequest & { acceptTerms: true };

// One RHF form, walked one question at a time. Each step validates only its own
// fields via trigger() before advancing; the final step submits the whole form.
const STEPS = [
  {
    key: "you",
    titleKey: "step1Title",
    subtitleKey: "step1Subtitle",
    fields: ["firstName", "lastName"],
  },
  {
    key: "contact",
    titleKey: "step2Title",
    subtitleKey: "step2Subtitle",
    fields: ["email", "country", "phone"],
  },
  {
    key: "secure",
    titleKey: "step3Title",
    subtitleKey: "step3Subtitle",
    fields: ["password", "acceptTerms"],
  },
] as const;
const LAST = STEPS.length - 1;

export default function RegisterPage(): React.JSX.Element {
  const tx = useTranslations("authRegister");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const registerMut = useRegister();
  const { data: countriesData } = useCountries();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(zRegisterRequest),
    mode: "onBlur",
    defaultValues: { country: "CM" },
  });

  // Enabled markets for the picker; the selected one drives the phone dial-code hint.
  // useWatch (subscription) rather than watch() so React Compiler can memoize cleanly.
  const selectedCountry = useWatch({ control, name: "country" });
  const countries = countriesData?.countries.length ? countriesData.countries : FALLBACK_COUNTRIES;
  const countryOptions = countries.map((c) => ({ value: c.code, label: locale === "fr" ? c.nameFr : c.nameEn }));
  const dialCode = countries.find((c) => c.code === selectedCountry)?.dialCode ?? "+237";

  // Optional text fields submit "" when untouched — coerce to undefined so the
  // `.optional()` zod rules accept them instead of failing the format check.
  const emptyToUndefined = { setValueAs: (v: string) => (v.trim() === "" ? undefined : v) };

  const submitForm = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerMut.mutateAsync(values);
      toast.success(tx("toastCreatedTitle"), tx("toastCreatedBody"));
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setFormError(apiErrorMessage(err, tx("errorCreate")));
    }
  });

  const goNext = async () => {
    const ok = await trigger([...STEPS[step].fields], { shouldFocus: true });
    if (ok) {
      setFormError(null);
      setStep((s) => Math.min(s + 1, LAST));
    }
  };

  // Both Enter and the primary button route here: advance until the last step,
  // then submit.
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < LAST) void goNext();
    else void submitForm();
  };

  const current = STEPS[step];

  return (
    <Card className="p-6">
      {/* progress */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs text-text-3">
          <span>{tx("stepOf", { current: step + 1, total: STEPS.length })}</span>
          <span className="flex items-center gap-1">
            <Sparkles size={12} className="text-accent-400" /> {tx("tagline")}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent-400 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* the step animates in on change; key remount also focuses its first field */}
      <div key={current.key} className="qt-animate-fade">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold tracking-tight">{tx(current.titleKey)}</h1>
          <p className="mt-1 text-sm text-text-2">{tx(current.subtitleKey)}</p>
        </div>

        {formError && (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tx("firstNameLabel")} error={errors.firstName?.message}>
                {(p) => <Input autoComplete="given-name" placeholder="Marie" autoFocus {...p} {...register("firstName", emptyToUndefined)} />}
              </Field>
              <Field label={tx("lastNameLabel")} error={errors.lastName?.message}>
                {(p) => <Input autoComplete="family-name" placeholder="Nkeng" {...p} {...register("lastName", emptyToUndefined)} />}
              </Field>
            </div>
          )}

          {step === 1 && (
            <>
              <Field label={tx("emailLabel")} error={errors.email?.message} required>
                {(p) => <Input type="email" autoComplete="email" placeholder={tx("emailPlaceholder")} autoFocus {...p} {...register("email")} />}
              </Field>
              <Field label={tx("countryLabel")} hint={tx("countryHint")} error={errors.country?.message} required>
                {(p) => <Select options={countryOptions} {...p} {...register("country")} />}
              </Field>
              <Field label={tx("phoneLabel")} hint={tx("phoneHint")} error={errors.phone?.message}>
                {(p) => (
                  <Input type="tel" autoComplete="tel" placeholder={`${dialCode} 6XXXXXXXX`} {...p} {...register("phone", emptyToUndefined)} />
                )}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label={tx("passwordLabel")}
                hint={tx("passwordHint")}
                error={errors.password?.message}
                required
              >
                {(p) => <PasswordInput autoComplete="new-password" placeholder="••••••••" autoFocus {...p} {...register("password")} />}
              </Field>
              <label className="flex items-start gap-2.5 text-sm text-text-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border accent-accent-400" {...register("acceptTerms")} />
                <span>
                  {tx("agreePrefix")}{" "}
                  <Link href="/legal/terms" className="text-accent-400 hover:underline">
                    {tx("termsLink")}
                  </Link>{" "}
                  {tx("agreeConnector")}{" "}
                  <Link href="/legal/privacy" className="text-accent-400 hover:underline">
                    {tx("privacyLink")}
                  </Link>
                  {tx("agreeSuffix")}
                </span>
              </label>
              {errors.acceptTerms && (
                <p role="alert" className="text-sm text-danger">
                  {tx("acceptTermsError")}
                </p>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setFormError(null);
                  setStep((s) => s - 1);
                }}
              >
                {tx("back")}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {step < LAST ? tx("continue") : isSubmitting ? <Spinner /> : tx("createAccount")}
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-text-2">
        {tx("alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent-400 hover:underline">
          {tx("login")}
        </Link>
      </p>
    </Card>
  );
}
