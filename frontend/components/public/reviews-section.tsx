import { Star } from "lucide-react";
import type { Review } from "@quatatrade/shared";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";

/**
 * Testimonials band on the landing page. Reviews are admin-managed — nothing is
 * fabricated, so the section renders only once the operator has published at
 * least one review.
 */
export function ReviewsSection({
  reviews,
  eyebrow,
  title,
}: {
  reviews: Review[];
  eyebrow: string;
  title: string;
}): React.JSX.Element | null {
  if (reviews.length === 0) return null;

  return (
    <div className="border-t border-border bg-surface-1/40">
      <Section>
        <SectionHeading eyebrow={eyebrow} title={title} center />
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.06}>
              <figure className="flex h-full flex-col rounded-xl border border-border bg-surface-1 p-5">
                <div className="flex gap-0.5" aria-label={`${r.rating} / 5`}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      size={15}
                      className={s < r.rating ? "fill-accent-400 text-accent-400" : "text-text-3"}
                      aria-hidden
                    />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-text-2">
                  &ldquo;{r.body}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-medium text-text-1">{r.authorName}</span>
                  {r.location && <span className="text-text-3"> · {r.location}</span>}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Section>
    </div>
  );
}
