import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";
import {
  zChangeEmailRequest,
  zSessionsResponse,
  zUpdatePaymentAccountsRequest,
  zUpdateProfileRequest,
  zUuid,
  zVerifyEmailChangeRequest,
  type ChangeEmailRequest,
  type Ok,
  type UpdatePaymentAccountsRequest,
  type UpdateProfileRequest,
  type UserProfile,
  type VerifyEmailChangeRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAuth, CurrentUserId } from "../../common/auth/decorators";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { UsersService } from "./users.service";
import {
  EmailUnavailableError,
  InvalidEmailCodeError,
  SessionNotFoundError,
  UserNotFoundError,
  WrongPasswordError,
} from "./users.errors";

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

  @Patch("me/payment-accounts")
  async updatePaymentAccounts(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zUpdatePaymentAccountsRequest)) dto: UpdatePaymentAccountsRequest,
  ): Promise<UserProfile> {
    try {
      return await this.users.updatePaymentAccounts(userId, dto);
    } catch (err) {
      rethrowUsers(err);
    }
  }

  @Post("me/email")
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zChangeEmailRequest)) dto: ChangeEmailRequest,
  ): Promise<UserProfile> {
    try {
      return await this.users.requestEmailChange(userId, dto.newEmail, dto.password);
    } catch (err) {
      if (err instanceof WrongPasswordError) throw new UnauthorizedException("Incorrect password");
      if (err instanceof EmailUnavailableError) throw new ConflictException("That email is not available");
      rethrowUsers(err);
    }
  }

  @Post("me/email/verify")
  @HttpCode(HttpStatus.OK)
  async verifyEmailChange(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zVerifyEmailChangeRequest)) dto: VerifyEmailChangeRequest,
  ): Promise<UserProfile> {
    try {
      return await this.users.verifyEmailChange(userId, dto.code);
    } catch (err) {
      if (err instanceof EmailUnavailableError) throw new ConflictException("That email is not available");
      if (err instanceof InvalidEmailCodeError) throw new BadRequestException("Invalid or expired code");
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
