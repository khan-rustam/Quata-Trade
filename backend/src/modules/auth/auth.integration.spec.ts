import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { authenticator } from "otplib";
import { z } from "zod";
import type { RegisterRequest } from "@quatatrade/shared";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import type { Env } from "../../config/env";
import { UsersService } from "../users/users.service";
import { SessionNotFoundError } from "../users/users.errors";
import { AuthService, type IssuedTokens, type LoginOutcome, type RequestMeta } from "./auth.service";
import { TotpService } from "./totp.service";
import { PinService } from "./pin.service";
import {
  InvalidCodeError,
  InvalidCredentialsError,
  InvalidPinError,
  InvalidTokenError,
  PinLockedError,
} from "./auth.errors";

/**
 * AUDIT GATE 2 — identity & auth (Documents/05 Phase 2, 08 §E).
 * Real Postgres via Testcontainers; services constructed directly.
 */
describe("Auth (Gate 2)", () => {
  let t: TestDb;
  let auth: AuthService;
  let totp: TotpService;
  let pin: PinService;
  let users: UsersService;
  let jwt: JwtService;

  const PASSWORD = "Sup3rSecurePass!";
  const META: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest", deviceFingerprint: null };

  let emailSeq = 0;
  const nextEmail = (): string => {
    emailSeq += 1;
    return `auth${emailSeq}-${newId().slice(0, 8)}@test.local`;
  };

  const registerDto = (email: string): RegisterRequest => ({
    email,
    password: PASSWORD,
    country: "CM",
    acceptTerms: true,
  });

  /** The OTP reaches the user only through the notify pipeline — read it there. */
  const otpFor = async (userId: string): Promise<string> => {
    const notif = await t.db
      .selectFrom("notifications")
      .select(["payload"])
      .where("user_id", "=", userId)
      .where("template", "=", "email_verify")
      .orderBy("created_at", "desc")
      .executeTakeFirstOrThrow();
    return z.object({ code: z.string() }).parse(notif.payload).code;
  };

  const registerVerified = async (): Promise<{ userId: string; email: string }> => {
    const email = nextEmail();
    const res = await auth.register(registerDto(email), META);
    await auth.verifyEmail(email, await otpFor(res.userId));
    return { userId: res.userId, email };
  };

  const asTokens = (outcome: LoginOutcome): IssuedTokens => {
    if (outcome.totpRequired) throw new Error("expected issued tokens, got totpRequired");
    return outcome;
  };

  const decode = (accessToken: string): Promise<AccessTokenPayload> =>
    jwt.verifyAsync<AccessTokenPayload>(accessToken);

  beforeAll(async () => {
    t = await startTestDb();
    const audit = new AuditService(t.db);
    const config = new ConfigService<Env, true>({
      JWT_ACCESS_TTL_SECONDS: 600,
      REFRESH_TTL_DAYS: 30,
      MASTER_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    });
    jwt = new JwtService({ secret: "integration-test-secret-with-32-chars!", signOptions: { expiresIn: 600 } });
    totp = new TotpService(t.db, config, audit);
    auth = new AuthService(t.db, jwt, config, audit, totp);
    pin = new PinService(t.db, audit);
    users = new UsersService(t.db, audit);
  });

  afterAll(async () => {
    await t.stop();
  });

  it("register creates the user + hashed OTP; duplicate email gets the same shape but persists nothing", async () => {
    const email = nextEmail();
    const first = await auth.register(registerDto(email), META);
    expect(first.emailVerificationRequired).toBe(true);

    const user = await t.db.selectFrom("users").selectAll().where("id", "=", first.userId).executeTakeFirstOrThrow();
    expect(user.email).toBe(email);
    expect(user.email_verified_at).toBeNull();
    expect(user.password_hash).not.toBe(PASSWORD);

    const otp = await otpFor(first.userId);
    const token = await t.db
      .selectFrom("auth_tokens")
      .selectAll()
      .where("user_id", "=", first.userId)
      .where("kind", "=", "email_otp")
      .executeTakeFirstOrThrow();
    expect(token.token_hash).not.toBe(otp); // only the sha256 hash is at rest
    expect(token.expires_at.getTime()).toBeGreaterThan(Date.now());

    // no enumeration: duplicate register looks identical, changes nothing
    const dup = await auth.register(registerDto(email), META);
    expect(dup.emailVerificationRequired).toBe(true);
    expect(dup.userId).not.toBe(first.userId);
    const count = await t.db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
    expect(count.n).toBe(1n);
    const dupRow = await t.db.selectFrom("users").select("id").where("id", "=", dup.userId).executeTakeFirst();
    expect(dupRow).toBeUndefined();
  });

  it("verify-email: wrong code counts an attempt; right code verifies; code is single-use", async () => {
    const email = nextEmail();
    const res = await auth.register(registerDto(email), META);
    const otp = await otpFor(res.userId);
    const wrong = otp === "000000" ? "111111" : "000000";

    await expect(auth.verifyEmail(email, wrong)).rejects.toBeInstanceOf(InvalidCodeError);
    const afterWrong = await t.db
      .selectFrom("auth_tokens")
      .select(["attempts"])
      .where("user_id", "=", res.userId)
      .where("kind", "=", "email_otp")
      .executeTakeFirstOrThrow();
    expect(afterWrong.attempts).toBe(1); // failed attempt committed

    await auth.verifyEmail(email, otp);
    const user = await t.db.selectFrom("users").selectAll().where("id", "=", res.userId).executeTakeFirstOrThrow();
    expect(user.email_verified_at).not.toBeNull();

    // consumed — replaying the same code fails
    await expect(auth.verifyEmail(email, otp)).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it("login → refresh rotation → reuse detection kills the whole chain → logout", async () => {
    const { userId, email } = await registerVerified();

    // login issues an access JWT bound to a session + a hashed refresh token
    const login = asTokens(await auth.login({ email, password: PASSWORD }, META));
    const payload = await decode(login.accessToken);
    expect(payload.sub).toBe(userId);
    expect(payload.typ).toBe("user");
    expect(payload.sid).toBeDefined();
    const session = await t.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", payload.sid ?? "")
      .executeTakeFirstOrThrow();
    expect(session.refresh_hash).not.toBe(login.refreshToken); // hashed at rest

    // ROTATION: new session chained to the old, old revoked
    const rotated = await auth.refresh(login.refreshToken, META);
    const rotatedPayload = await decode(rotated.accessToken);
    const rotatedSession = await t.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", rotatedPayload.sid ?? "")
      .executeTakeFirstOrThrow();
    expect(rotatedSession.rotated_from).toBe(session.id);
    const oldSession = await t.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", session.id)
      .executeTakeFirstOrThrow();
    expect(oldSession.revoked_at).not.toBeNull();

    // REUSE DETECTION: replaying the rotated-away token revokes the entire chain
    await expect(auth.refresh(login.refreshToken, META)).rejects.toBeInstanceOf(InvalidTokenError);
    const liveDescendant = await t.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", rotatedSession.id)
      .executeTakeFirstOrThrow();
    expect(liveDescendant.revoked_at).not.toBeNull(); // the thief's live token died too
    await expect(auth.refresh(rotated.refreshToken, META)).rejects.toBeInstanceOf(InvalidTokenError);
    const reuseAudit = await t.db
      .selectFrom("audit_logs")
      .select(["id"])
      .where("action", "=", "session.reuse_detected")
      .where("target_id", "=", userId)
      .executeTakeFirst();
    expect(reuseAudit).toBeDefined();

    // LOGOUT revokes the current session; its refresh token stops working
    const relogin = asTokens(await auth.login({ email, password: PASSWORD }, META));
    const reloginPayload = await decode(relogin.accessToken);
    await auth.logout(userId, reloginPayload.sid);
    const loggedOut = await t.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", reloginPayload.sid ?? "")
      .executeTakeFirstOrThrow();
    expect(loggedOut.revoked_at).not.toBeNull();
    await expect(auth.refresh(relogin.refreshToken, META)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("locks the account after 5 failed logins; even the correct password is then rejected", async () => {
    const { userId, email } = await registerVerified();

    for (let i = 0; i < 5; i += 1) {
      await expect(auth.login({ email, password: "Wr0ngPassword!" }, META)).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    }
    const locked = await t.db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirstOrThrow();
    expect(locked.locked_until).not.toBeNull();
    expect((locked.locked_until ?? new Date(0)).getTime()).toBeGreaterThan(Date.now());

    // generic failure — the correct password gives no different answer while locked
    await expect(auth.login({ email, password: PASSWORD }, META)).rejects.toBeInstanceOf(InvalidCredentialsError);

    const lockAudit = await t.db
      .selectFrom("audit_logs")
      .select(["id"])
      .where("action", "=", "auth.lockout")
      .where("target_id", "=", userId)
      .executeTakeFirst();
    expect(lockAudit).toBeDefined();
  });

  it("TOTP: setup stores only the encrypted secret; enable needs a valid code; login then requires it", async () => {
    const { userId, email } = await registerVerified();

    const setup = await totp.setup(userId);
    expect(setup.qrDataUrl.startsWith("data:image/")).toBe(true);
    const secret = new URL(setup.otpauthUrl).searchParams.get("secret");
    if (!secret) throw new Error("otpauth url is missing the secret");

    const stored = await t.db
      .selectFrom("users")
      .select(["totp_secret_enc", "totp_enabled"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(stored.totp_enabled).toBe(false);
    expect(stored.totp_secret_enc).not.toBeNull();
    expect(stored.totp_secret_enc?.toString("utf8").includes(secret)).toBe(false); // encrypted, not plaintext

    const good = authenticator.generate(secret);
    const bad = good === "000000" ? "111111" : "000000";
    await expect(totp.enable(userId, bad)).rejects.toBeInstanceOf(InvalidCodeError);
    await totp.enable(userId, authenticator.generate(secret));

    // password valid + code missing → 200-style totpRequired, no tokens
    const challenge = await auth.login({ email, password: PASSWORD }, META);
    expect(challenge.totpRequired).toBe(true);

    await expect(auth.login({ email, password: PASSWORD, totpCode: bad }, META)).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );

    const full = asTokens(await auth.login({ email, password: PASSWORD, totpCode: authenticator.generate(secret) }, META));
    expect(full.accessToken.length).toBeGreaterThan(0);

    await totp.assertCode(userId, authenticator.generate(secret)); // sensitive-flow helper
    await expect(totp.assertCode(userId, bad)).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it("PIN: set requires the password; 5 wrong attempts lock it for 15 minutes", async () => {
    const { userId } = await registerVerified();
    const PIN = "482915";

    await expect(pin.setPin(userId, PIN, "Wr0ngPassword!")).rejects.toBeInstanceOf(InvalidCredentialsError);
    await pin.setPin(userId, PIN, PASSWORD);
    const row = await t.db.selectFrom("users").select(["pin_hash"]).where("id", "=", userId).executeTakeFirstOrThrow();
    expect(row.pin_hash).not.toBeNull();
    expect(row.pin_hash).not.toBe(PIN); // argon2id hash, never the PIN

    await pin.verifyPin(userId, PIN); // correct PIN passes

    for (let i = 0; i < 4; i += 1) {
      await expect(pin.verifyPin(userId, "000000")).rejects.toBeInstanceOf(InvalidPinError);
    }
    await expect(pin.verifyPin(userId, "000000")).rejects.toBeInstanceOf(PinLockedError); // 5th → lock
    const lockedRow = await t.db
      .selectFrom("users")
      .select(["pin_locked_until"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(lockedRow.pin_locked_until).not.toBeNull();

    // locked means locked — even the CORRECT PIN is rejected now
    await expect(pin.verifyPin(userId, PIN)).rejects.toBeInstanceOf(PinLockedError);
  });

  it("IDOR: a user cannot revoke someone else's session", async () => {
    const alice = await registerVerified();
    const mallory = await registerVerified();

    const aliceLogin = asTokens(await auth.login({ email: alice.email, password: PASSWORD }, META));
    const alicePayload = await decode(aliceLogin.accessToken);
    const aliceSid = alicePayload.sid;
    if (!aliceSid) throw new Error("expected session id");

    await expect(users.revokeSession(mallory.userId, aliceSid)).rejects.toBeInstanceOf(SessionNotFoundError);
    const still = await t.db.selectFrom("sessions").selectAll().where("id", "=", aliceSid).executeTakeFirstOrThrow();
    expect(still.revoked_at).toBeNull(); // untouched

    await users.revokeSession(alice.userId, aliceSid); // the owner can
    const gone = await t.db.selectFrom("sessions").selectAll().where("id", "=", aliceSid).executeTakeFirstOrThrow();
    expect(gone.revoked_at).not.toBeNull();
  });
});
