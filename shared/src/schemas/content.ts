import { z } from "zod";
import { zEmail, zUuid } from "./common.js";

/** Admin-managed site content: company/contact details, FAQ, reviews, enquiries. */

export const ENQUIRY_STATUSES = ["new", "read", "replied", "archived"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/**
 * A social link is either empty ("" = not set) or an absolute http(s) URL.
 * Rejecting every other scheme here is what stops a `javascript:`/`data:` URI
 * from being stored and later rendered as an <a href> (stored XSS). Note that
 * `z.url()` alone would ACCEPT `javascript:...` — the explicit scheme check is required.
 */
const zSocialUrl = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), {
    message: "Must be an http(s):// URL",
  });

export const zSocialLinks = z.object({
  facebook: zSocialUrl,
  x: zSocialUrl,
  instagram: zSocialUrl,
  linkedin: zSocialUrl,
  telegram: zSocialUrl,
});

/** Company/contact details — one settings row, reflected across the whole site. */
export const zCompanyInfo = z.object({
  name: z.string(),
  legalName: z.string(),
  tagline: z.string(),
  email: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  addressLine: z.string(),
  city: z.string(),
  country: z.string(),
  registrationNo: z.string(),
  social: zSocialLinks,
});
export type CompanyInfo = z.infer<typeof zCompanyInfo>;

export const zUpdateCompanyRequest = z
  .object({
    name: z.string().trim().max(120),
    legalName: z.string().trim().max(160),
    tagline: z.string().trim().max(160),
    email: z.string().trim().max(320),
    phone: z.string().trim().max(40),
    whatsapp: z.string().trim().max(40),
    addressLine: z.string().trim().max(200),
    city: z.string().trim().max(80),
    country: z.string().trim().max(80),
    registrationNo: z.string().trim().max(80),
    social: zSocialLinks.partial(),
  })
  .partial()
  .strict();
export type UpdateCompanyRequest = z.infer<typeof zUpdateCompanyRequest>;

export const zFaq = z.object({
  id: zUuid,
  category: z.string(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().int(),
  published: z.boolean(),
});
export type Faq = z.infer<typeof zFaq>;
export const zFaqList = z.object({ items: z.array(zFaq) });

export const zUpsertFaqRequest = z
  .object({
    id: zUuid.optional(),
    category: z.string().trim().min(1).max(40),
    question: z.string().trim().min(3).max(300),
    answer: z.string().trim().min(3).max(4000),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict();
export type UpsertFaqRequest = z.infer<typeof zUpsertFaqRequest>;

export const zReview = z.object({
  id: zUuid,
  authorName: z.string(),
  location: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  sortOrder: z.number().int(),
  published: z.boolean(),
});
export type Review = z.infer<typeof zReview>;
export const zReviewList = z.object({ items: z.array(zReview) });

export const zUpsertReviewRequest = z
  .object({
    id: zUuid.optional(),
    authorName: z.string().trim().min(1).max(80),
    location: z.string().trim().max(80).nullable().optional(),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(3).max(1000),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    published: z.boolean().optional(),
  })
  .strict();
export type UpsertReviewRequest = z.infer<typeof zUpsertReviewRequest>;

/** Public contact-form submission → lands in the admin enquiries inbox. */
export const zEnquiryRequest = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: zEmail,
    subject: z.string().trim().max(160).optional(),
    message: z.string().trim().min(5).max(4000),
  })
  .strict();
export type EnquiryRequest = z.infer<typeof zEnquiryRequest>;

export const zEnquiry = z.object({
  id: zUuid,
  name: z.string(),
  email: z.string(),
  subject: z.string().nullable(),
  message: z.string(),
  status: z.enum(ENQUIRY_STATUSES),
  createdAt: z.string(),
});
export type Enquiry = z.infer<typeof zEnquiry>;
export const zEnquiryList = z.object({ items: z.array(zEnquiry), total: z.number().int() });

export const zUpdateEnquiryStatusRequest = z.object({ status: z.enum(ENQUIRY_STATUSES) }).strict();
export type UpdateEnquiryStatusRequest = z.infer<typeof zUpdateEnquiryStatusRequest>;
