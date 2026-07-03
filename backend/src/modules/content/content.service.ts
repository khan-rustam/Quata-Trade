import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Kysely } from "kysely";
import type {
  CompanyInfo,
  Enquiry,
  EnquiryRequest,
  EnquiryStatus,
  Faq,
  Review,
  UpdateCompanyRequest,
  UpsertFaqRequest,
  UpsertReviewRequest,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";

const DEFAULT_COMPANY: CompanyInfo = {
  name: "QuataTrade",
  legalName: "",
  tagline: "Crypto to cash. Protected.",
  email: "",
  phone: "",
  whatsapp: "",
  addressLine: "",
  city: "",
  country: "Cameroon",
  registrationNo: "",
  social: { facebook: "", x: "", instagram: "", linkedin: "", telegram: "" },
};

const FAQ_COLS = ["id", "category", "question", "answer", "sort_order", "published"] as const;
const REVIEW_COLS = ["id", "author_name", "location", "rating", "body", "sort_order", "published"] as const;
const ENQUIRY_COLS = ["id", "name", "email", "subject", "message", "status", "created_at"] as const;

type FaqRow = { id: string; category: string; question: string; answer: string; sort_order: number; published: boolean };
type ReviewRow = {
  id: string;
  author_name: string;
  location: string | null;
  rating: number;
  body: string;
  sort_order: number;
  published: boolean;
};
type EnquiryRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: Date;
};

const faqToWire = (r: FaqRow): Faq => ({
  id: r.id,
  category: r.category,
  question: r.question,
  answer: r.answer,
  sortOrder: r.sort_order,
  published: r.published,
});
const reviewToWire = (r: ReviewRow): Review => ({
  id: r.id,
  authorName: r.author_name,
  location: r.location,
  rating: r.rating,
  body: r.body,
  sortOrder: r.sort_order,
  published: r.published,
});
const enquiryToWire = (r: EnquiryRow): Enquiry => ({
  id: r.id,
  name: r.name,
  email: r.email,
  subject: r.subject,
  message: r.message,
  status: r.status as EnquiryStatus,
  createdAt: r.created_at.toISOString(),
});

/**
 * content — admin-managed public content: company/contact details (a `company`
 * settings row), FAQ, reviews/testimonials, and contact-form enquiries.
 */
@Injectable()
export class ContentService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  // ── company / contact details ───────────────────────────────────────────
  async getCompany(): Promise<CompanyInfo> {
    const row = await this.db.selectFrom("settings").select("value").where("key", "=", "company").executeTakeFirst();
    const stored = (row?.value ?? {}) as Partial<CompanyInfo>;
    return { ...DEFAULT_COMPANY, ...stored, social: { ...DEFAULT_COMPANY.social, ...(stored.social ?? {}) } };
  }

  async updateCompany(patch: UpdateCompanyRequest): Promise<CompanyInfo> {
    const current = await this.getCompany();
    const next: CompanyInfo = { ...current, ...patch, social: { ...current.social, ...(patch.social ?? {}) } };
    await this.db
      .insertInto("settings")
      .values({ key: "company", value: JSON.stringify(next) })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: JSON.stringify(next), updated_at: new Date() }))
      .execute();
    return next;
  }

  // ── FAQ ─────────────────────────────────────────────────────────────────
  async listFaqs(publishedOnly: boolean): Promise<Faq[]> {
    let q = this.db.selectFrom("faqs").select(FAQ_COLS).orderBy("sort_order").orderBy("created_at");
    if (publishedOnly) q = q.where("published", "=", true);
    return (await q.execute()).map(faqToWire);
  }

  async upsertFaq(dto: UpsertFaqRequest): Promise<Faq> {
    const id = dto.id ?? newId();
    if (dto.id) {
      const res = await this.db
        .updateTable("faqs")
        .set({
          category: dto.category,
          question: dto.question,
          answer: dto.answer,
          ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
          ...(dto.published !== undefined ? { published: dto.published } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", dto.id)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) throw new NotFoundException("faq not found");
    } else {
      await this.db
        .insertInto("faqs")
        .values({
          id,
          category: dto.category,
          question: dto.question,
          answer: dto.answer,
          sort_order: dto.sortOrder ?? 0,
          published: dto.published ?? true,
        })
        .execute();
    }
    const row = await this.db.selectFrom("faqs").select(FAQ_COLS).where("id", "=", id).executeTakeFirstOrThrow();
    return faqToWire(row);
  }

  async deleteFaq(id: string): Promise<void> {
    await this.db.deleteFrom("faqs").where("id", "=", id).execute();
  }

  // ── reviews ─────────────────────────────────────────────────────────────
  async listReviews(publishedOnly: boolean): Promise<Review[]> {
    let q = this.db.selectFrom("reviews").select(REVIEW_COLS).orderBy("sort_order").orderBy("created_at", "desc");
    if (publishedOnly) q = q.where("published", "=", true);
    return (await q.execute()).map(reviewToWire);
  }

  async upsertReview(dto: UpsertReviewRequest): Promise<Review> {
    const id = dto.id ?? newId();
    if (dto.id) {
      const res = await this.db
        .updateTable("reviews")
        .set({
          author_name: dto.authorName,
          location: dto.location ?? null,
          rating: dto.rating,
          body: dto.body,
          ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
          ...(dto.published !== undefined ? { published: dto.published } : {}),
        })
        .where("id", "=", dto.id)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) throw new NotFoundException("review not found");
    } else {
      await this.db
        .insertInto("reviews")
        .values({
          id,
          author_name: dto.authorName,
          location: dto.location ?? null,
          rating: dto.rating,
          body: dto.body,
          sort_order: dto.sortOrder ?? 0,
          published: dto.published ?? true,
        })
        .execute();
    }
    const row = await this.db.selectFrom("reviews").select(REVIEW_COLS).where("id", "=", id).executeTakeFirstOrThrow();
    return reviewToWire(row);
  }

  async deleteReview(id: string): Promise<void> {
    await this.db.deleteFrom("reviews").where("id", "=", id).execute();
  }

  // ── enquiries (contact inbox) ───────────────────────────────────────────
  async createEnquiry(dto: EnquiryRequest): Promise<void> {
    await this.db
      .insertInto("enquiries")
      .values({ id: newId(), name: dto.name, email: dto.email, subject: dto.subject ?? null, message: dto.message })
      .execute();
  }

  async listEnquiries(page: number, pageSize: number): Promise<{ items: Enquiry[]; total: number }> {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("enquiries")
        .select(ENQUIRY_COLS)
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.db
        .selectFrom("enquiries")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .executeTakeFirstOrThrow(),
    ]);
    return { items: rows.map(enquiryToWire), total: Number(count.n) };
  }

  async updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
    const res = await this.db.updateTable("enquiries").set({ status }).where("id", "=", id).executeTakeFirst();
    if (res.numUpdatedRows === 0n) throw new NotFoundException("enquiry not found");
  }
}
