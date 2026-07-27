import { Gavel, Receipt, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface SignupSegmentIntroProps {
  /** Small label above the headline, e.g. "For traders". */
  eyebrow: string;
  /** Segment headline. */
  title: string;
  /** One-sentence segment pitch. */
  body: string;
}

/**
 * Segment lead-in shown above the registration card on the campaign
 * sign-up URLs.
 *
 * The form below it is the same one at `/register` — this only changes the
 * framing so a "for traders" ad and a "for businesses" ad each land
 * somewhere that speaks to the person who clicked, instead of a generic
 * form. No account-type is implied: QuataTrade has one account type and
 * every user can both buy and sell.
 *
 * Server component so all copy resolves through next-intl (en + fr) at
 * render time and stays out of the client bundle.
 */
export async function SignupSegmentIntro({
  eyebrow,
  title,
  body,
}: SignupSegmentIntroProps): Promise<React.JSX.Element> {
  const t = await getTranslations("authSignup");

  const trust = [
    { icon: ShieldCheck, label: t("trustEscrow") },
    { icon: Gavel, label: t("trustDispute") },
    { icon: Receipt, label: t("trustFees") },
  ];

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-400">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 font-display text-xl font-bold leading-snug tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>

      <ul className="mt-4 space-y-1.5">
        {trust.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2 text-xs text-text-3">
            {/* Icon + label together — colour never carries the meaning on its own. */}
            <Icon size={14} className="shrink-0 text-accent-400" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
