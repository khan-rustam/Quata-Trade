import { Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { zPagination, zUuid, type Ok, type Pagination } from "@quatatrade/shared";
import { zNotificationsResponse } from "@quatatrade/shared";
import type { z } from "zod";
import { CurrentUserId } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { NotifyService } from "./notify.service";

type NotificationsResponse = z.infer<typeof zNotificationsResponse>;

/** User-facing notification feed. Global JwtAuthGuard applies (no @Public). */
@Controller("notifications")
export class NotifyController {
  constructor(private readonly notify: NotifyService) {}

  /** GET /api/v1/notifications — the caller's in-app feed, newest first. */
  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(zPagination)) query: Pagination,
  ): Promise<NotificationsResponse> {
    const { items, total } = await this.notify.listForUser(userId, query.page, query.pageSize);
    return {
      items: items.map((n) => ({
        id: n.id,
        channel: n.channel,
        template: n.template,
        payload: n.payload,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** POST /api/v1/notifications/:id/read — scoped by user; 404 never leaks others' rows. */
  @Post(":id/read")
  @HttpCode(200)
  async markRead(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) notificationId: string,
  ): Promise<Ok> {
    const updated = await this.notify.markRead(userId, notificationId);
    if (!updated) throw new NotFoundException("Notification not found");
    return { ok: true };
  }
}
