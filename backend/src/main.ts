import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Trust ONLY the loopback proxy (Nginx runs on 127.0.0.1 on the same host).
      // `true` would trust the attacker-controlled leftmost X-Forwarded-For, which
      // defeats per-IP rate limiting and forges the source IP in the audit log/risk
      // engine. "loopback" makes req.ip the real client IP that Nginx set.
      trustProxy: "loopback",
      bodyLimit: 8_388_608, // 8 MiB — POST /kyc/upload carries ≤7 MiB base64 JSON; Nginx caps other routes tighter at the edge
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<Env, true>);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  });
  await app.register(cookie);

  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  // Health/ops probes + Prometheus scrape live at the ROOT (no /api/v1 prefix) so
  // uptime monitors and Prometheus hit conventional paths.
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/ready", "live", "ready", "status", "metrics"],
  });
  app.enableShutdownHooks();

  if (config.get("SWAGGER_ENABLED", { infer: true }) && config.get("NODE_ENV", { infer: true }) !== "production") {
    const doc = new DocumentBuilder()
      .setTitle("QuataTrade API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get("PORT", { infer: true });
  // In production Nginx is the only intended client (127.0.0.1 upstream), so bind
  // to loopback — binding 0.0.0.0 on a shared VPS exposes the API off-Nginx,
  // bypassing TLS/HSTS/edge rate limits. Non-prod keeps 0.0.0.0 for LAN/dev access.
  const host = config.get("NODE_ENV", { infer: true }) === "production" ? "127.0.0.1" : "0.0.0.0";
  await app.listen({ port, host });
}

void bootstrap();
