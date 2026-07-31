import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Controller, Delete, Get, Module, Patch, Put } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Regression test for the CORS preflight contract.
 *
 * ## Why this test exists
 *
 * This app runs on Fastify. `@fastify/cors` defaults `methods` to
 * `GET,HEAD,POST` — not the Express-style list that Nest's `enableCors`
 * examples imply. That default silently broke every PATCH/PUT/DELETE route
 * *in the browser only*: the preflight answered "GET,HEAD,POST", the real
 * request was never sent, and the UI showed a bare "Failed to fetch".
 *
 * Nothing caught it, because nothing that ran in CI sends a preflight. curl
 * doesn't. Supertest doesn't. The integration suite calls handlers directly.
 * A browser is the only client that performs this check, and there was no
 * browser in the loop — so a whole class of admin write went out broken and
 * stayed broken until someone clicked the button.
 *
 * This test is that missing browser. It asserts the preflight ANSWER, which
 * is the thing the browser actually reads, rather than asserting that a
 * handler exists.
 */

@Controller("probe")
class ProbeController {
  @Get() get(): string {
    return "ok";
  }
  @Put() put(): string {
    return "ok";
  }
  @Patch() patch(): string {
    return "ok";
  }
  @Delete() delete(): string {
    return "ok";
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

const ORIGIN = "https://quatatrade.test";

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(
    ProbeModule,
    new FastifyAdapter(),
    { logger: false },
  );
  // The exact call from main.ts. If that one changes and this does not, the
  // test is measuring the wrong thing — keep them identical.
  app.enableCors({
    origin: ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app?.close();
});

async function preflight(method: string) {
  return app.getHttpAdapter().getInstance().inject({
    method: "OPTIONS",
    url: "/probe",
    headers: {
      origin: ORIGIN,
      "access-control-request-method": method,
      "access-control-request-headers": "content-type,authorization",
    },
  });
}

describe("CORS preflight", () => {
  // PUT, PATCH and DELETE are the ones the Fastify default drops. GET and
  // POST are included so a future change that breaks them fails here too.
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    "permits %s from the configured web origin",
    async (method) => {
      const res = await preflight(method);
      expect(res.statusCode).toBeLessThan(300);

      const allowed = String(res.headers["access-control-allow-methods"] ?? "")
        .split(",")
        .map((m) => m.trim().toUpperCase());
      expect(allowed).toContain(method);
      expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    },
  );

  it("still refuses an unknown origin", async () => {
    // The fix widens METHODS, not origins. Assert the origin gate is intact,
    // so "make CORS work" never quietly becomes "allow everyone".
    const res = await app.getHttpAdapter().getInstance().inject({
      method: "OPTIONS",
      url: "/probe",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "PUT",
      },
    });
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example",
    );
  });
});
