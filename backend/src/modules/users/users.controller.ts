import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import { z } from "zod";
import {
  zSessionsResponse,
  zUpdateProfileRequest,
  zUuid,
  type Ok,
  type UpdateProfileRequest,
  type UserProfile,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAuth, CurrentUserId } from "../../common/auth/decorators";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { UsersService } from "./users.service";
import { SessionNotFoundError, UserNotFoundError } from "./users.errors";

type SessionsResponse = z.infer<typeof zSessionsResponse>;

function rethrowUsers(err: unknown): never {
  if (err instanceof UserNotFoundError || err instanceof SessionNotFoundError) {
    throw new NotFoundException("Not found"); // same face for "not yours" and "doesn't exist"
  }
  throw err;
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  async me(@CurrentUserId() userId: string): Promise<UserProfile> {
    try {
      return await this.users.getProfile(userId);
    } catch (err) {
      rethrowUsers(err);
    }
  }

  @Patch("me")
  async updateMe(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zUpdateProfileRequest)) dto: UpdateProfileRequest,
  ): Promise<UserProfile> {
    try {
      return await this.users.updateProfile(userId, dto);
    } catch (err) {
      rethrowUsers(err);
    }
  }

  @Get("me/sessions")
  async sessions(@CurrentAuth() auth: AccessTokenPayload): Promise<SessionsResponse> {
    return { sessions: await this.users.listSessions(auth.sub, auth.sid) };
  }

  @Delete("me/sessions/:id")
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) sessionId: string,
  ): Promise<Ok> {
    try {
      await this.users.revokeSession(userId, sessionId);
      return { ok: true };
    } catch (err) {
      rethrowUsers(err);
    }
  }
}
