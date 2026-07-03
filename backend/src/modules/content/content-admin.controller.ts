import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import {
  zPagination,
  zUpdateCompanyRequest,
  zUpdateEnquiryStatusRequest,
  zUpsertFaqRequest,
  zUpsertReviewRequest,
  zUuid,
  type CompanyInfo,
  type Enquiry,
  type Faq,
  type Pagination,
  type Review,
  type UpdateCompanyRequest,
  type UpdateEnquiryStatusRequest,
  type UpsertFaqRequest,
  type UpsertReviewRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Roles } from "../../common/auth/decorators";
import { RBAC } from "../admin/admin.rbac";
import { ContentService } from "./content.service";

/** Admin management of site content (SUPER + FINANCE, per editSettings RBAC). */
@Controller("admin/content")
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Roles(...RBAC.editSettings)
  @Patch("company")
  updateCompany(@Body(new ZodPipe(zUpdateCompanyRequest)) dto: UpdateCompanyRequest): Promise<CompanyInfo> {
    return this.content.updateCompany(dto);
  }

  @Roles(...RBAC.editSettings)
  @Get("faqs")
  async faqs(): Promise<{ items: Faq[] }> {
    return { items: await this.content.listFaqs(false) };
  }

  @Roles(...RBAC.editSettings)
  @Post("faqs")
  upsertFaq(@Body(new ZodPipe(zUpsertFaqRequest)) dto: UpsertFaqRequest): Promise<Faq> {
    return this.content.upsertFaq(dto);
  }

  @Roles(...RBAC.editSettings)
  @Delete("faqs/:id")
  @HttpCode(HttpStatus.OK)
  async deleteFaq(@Param("id", new ZodPipe(zUuid)) id: string): Promise<{ ok: true }> {
    await this.content.deleteFaq(id);
    return { ok: true };
  }

  @Roles(...RBAC.editSettings)
  @Get("reviews")
  async reviews(): Promise<{ items: Review[] }> {
    return { items: await this.content.listReviews(false) };
  }

  @Roles(...RBAC.editSettings)
  @Post("reviews")
  upsertReview(@Body(new ZodPipe(zUpsertReviewRequest)) dto: UpsertReviewRequest): Promise<Review> {
    return this.content.upsertReview(dto);
  }

  @Roles(...RBAC.editSettings)
  @Delete("reviews/:id")
  @HttpCode(HttpStatus.OK)
  async deleteReview(@Param("id", new ZodPipe(zUuid)) id: string): Promise<{ ok: true }> {
    await this.content.deleteReview(id);
    return { ok: true };
  }

  @Roles(...RBAC.editSettings)
  @Get("enquiries")
  async enquiries(@Query(new ZodPipe(zPagination)) q: Pagination): Promise<{ items: Enquiry[]; total: number }> {
    return this.content.listEnquiries(q.page, q.pageSize);
  }

  @Roles(...RBAC.editSettings)
  @Patch("enquiries/:id")
  @HttpCode(HttpStatus.OK)
  async setEnquiryStatus(
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zUpdateEnquiryStatusRequest)) dto: UpdateEnquiryStatusRequest,
  ): Promise<{ ok: true }> {
    await this.content.updateEnquiryStatus(id, dto.status);
    return { ok: true };
  }
}
