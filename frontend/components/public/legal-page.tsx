import { Fragment } from "react";
import { AlertTriangle } from "lucide-react";
import type { LegalDoc } from "@/lib/legal-content";

/**
 * Renders a legal document scaffold. `[[...]]` markers in text and `placeholder`
 * blocks are highlighted so the client/lawyer can see exactly what must be
 * supplied before launch. Content is plain-language and NON-BINDING until a
 * Cameroon-qualified lawyer reviews it (Documents/14 §13.B).
 */
export function LegalPage({ doc }: { doc: LegalDoc }): React.JSX.Element {
  const isFinal = doc.status === "final";
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      {!isFinal && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            <strong>Draft — pending legal review.</strong> This page describes how QuataTrade works and
            marks (in mint) every detail the operator and a Cameroon-qualified lawyer must confirm. It is
            not yet legally binding and must not ship to production until reviewed and localized (EN + FR).
          </p>
        </div>
      )}

      <h1 className="font-display text-3xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-sm text-text-3">
        {isFinal ? "Effective" : "Last updated"}:{" "}
        <span className="font-medium">{doc.lastUpdated}</span> · Version {doc.version}
        {isFinal ? "" : " (draft)"}
      </p>
      {doc.summary && <p className="mt-4 text-text-2">{doc.summary}</p>}

      <div className="mt-8 space-y-8">
        {doc.sections.map((section, i) => (
          <section key={i}>
            <h2 className="font-display text-xl font-semibold">
              {i + 1}. {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, j) => {
                if (block.type === "p") return <p key={j} className="leading-relaxed text-text-2">{withMarks(block.text)}</p>;
                if (block.type === "subheading")
                  return (
                    <h3 key={j} className="pt-1 font-display text-base font-semibold text-text-1">
                      {withMarks(block.text)}
                    </h3>
                  );
                if (block.type === "list")
                  return (
                    <ul key={j} className="ml-1 space-y-1.5">
                      {block.items.map((item, k) => (
                        <li key={k} className="flex gap-2 text-text-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-400" aria-hidden />
                          <span className="leading-relaxed">{withMarks(item)}</span>
                        </li>
                      ))}
                    </ul>
                  );
                return (
                  <div key={j} className="rounded-lg border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm">
                    <span className="font-semibold text-accent-400">To supply: </span>
                    <span className="text-text-2">{block.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-text-3">
        Questions about this policy? Contact us via the{" "}
        <a href="/contact" className="text-accent-400 hover:underline">
          support page
        </a>
        .
      </p>
    </article>
  );
}

/** Highlight `[[placeholder]]` spans inline. */
function withMarks(text: string): React.ReactNode {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const m = /^\[\[(.+)\]\]$/.exec(part);
    if (m) {
      return (
        <mark key={i} className="rounded bg-accent-400/20 px-1 py-0.5 text-accent-400" title="Operator/lawyer to confirm">
          {m[1]}
        </mark>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
