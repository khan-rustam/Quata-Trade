import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/public/legal-page";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/lib/legal-content";

export function generateStaticParams(): { slug: string }[] {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) return { title: "Legal — QuataTrade" };
  return {
    title: `${doc.title} — QuataTrade`,
    description: doc.summary,
  };
}

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) notFound();
  return <LegalPage doc={doc} />;
}
