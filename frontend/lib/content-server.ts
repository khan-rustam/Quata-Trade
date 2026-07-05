import { zCompanyInfo, zFaqList, zReviewList, type CompanyInfo, type Faq, type Review } from "@quatatrade/shared";
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

async function fetchContent(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/content/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    // Never let a content-service hiccup take down a marketing page.
    return null;
  }
}

// Parse every response with the same shared schema the backend validates against
// (the FE/BE contract) instead of an unchecked `as T` cast — drift falls back to
// defaults rather than rendering undefined fields or crashing the SSR page.
export async function getCompany(): Promise<CompanyInfo> {
  const parsed = zCompanyInfo.safeParse(await fetchContent("company"));
  return parsed.success ? parsed.data : DEFAULT_COMPANY;
}

export async function getFaqs(): Promise<Faq[]> {
  const parsed = zFaqList.safeParse(await fetchContent("faqs"));
  return parsed.success ? parsed.data.items : [];
}

export async function getReviews(): Promise<Review[]> {
  const parsed = zReviewList.safeParse(await fetchContent("reviews"));
  return parsed.success ? parsed.data.items : [];
}
