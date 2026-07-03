import type { CompanyInfo, Faq, Review } from "@quatatrade/shared";
import { API_BASE_URL } from "./env";

/**
 * Server-side readers for admin-managed public content (company details, FAQ,
 * reviews). Rendered in server components so the footer / legal / help pages
 * carry the operator's real details with no client loading flash and good SEO.
 * Cached with `revalidate` so editing in the admin panel reflects site-wide
 * within a minute without hammering the API on every page view.
 */

const REVALIDATE_SECONDS = 60;

/** Safety net only — the API merges these defaults and returns full data. */
export const DEFAULT_COMPANY: CompanyInfo = {
  name: "QuataTrade",
  legalName: "",
  tagline: "",
  email: "",
  phone: "",
  whatsapp: "",
  addressLine: "",
  city: "",
  country: "Cameroon",
  registrationNo: "",
  social: { facebook: "", x: "", instagram: "", linkedin: "", telegram: "" },
};

async function getContent<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/content/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Never let a content-service hiccup take down a marketing page.
    return null;
  }
}

export async function getCompany(): Promise<CompanyInfo> {
  return (await getContent<CompanyInfo>("company")) ?? DEFAULT_COMPANY;
}

export async function getFaqs(): Promise<Faq[]> {
  const res = await getContent<{ items: Faq[] }>("faqs");
  return res?.items ?? [];
}

export async function getReviews(): Promise<Review[]> {
  const res = await getContent<{ items: Review[] }>("reviews");
  return res?.items ?? [];
}
