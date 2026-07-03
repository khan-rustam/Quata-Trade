import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { zEnquiryRequest, type CompanyInfo, type EnquiryRequest, type Faq, type Review } from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Public } from "../../common/auth/decorators";
import { ContentService } from "./content.service";

/** Public site content — browsable without auth (footer/contact/legal/help read this). */
@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get("company")
  company(): Promise<CompanyInfo> {
    return this.content.getCompany();
  }

  @Public()
  @Get("faqs")
  async faqs(): Promise<{ items: Faq[] }> {
    return { items: await this.content.listFaqs(true) };
  }

  @Public()
  @Get("reviews")
  async reviews(): Promise<{ items: Review[] }> {
    return { items: await this.content.listReviews(true) };
  }

  @Public()
  @Post("enquiries")
  @HttpCode(HttpStatus.OK)
  async submitEnquiry(@Body(new ZodPipe(zEnquiryRequest)) dto: EnquiryRequest): Promise<{ ok: true }> {
    await this.content.createEnquiry(dto);
    return { ok: true };
  }
}
