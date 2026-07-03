import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { ContentController } from "./content.controller";
import { ContentAdminController } from "./content-admin.controller";

/** Admin-managed site content: company details, FAQ, reviews, contact enquiries. */
@Module({
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
