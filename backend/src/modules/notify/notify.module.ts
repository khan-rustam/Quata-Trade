import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { NotifyController } from "./notify.controller";
import { createSmtpMailer, MAILER } from "./notify.mailer";
import { NotifyService } from "./notify.service";
import { KyselyNotifyStore, NOTIFY_STORE } from "./notify.store";

/**
 * notify — event → in-app + email notifications. Exported NotifyService is
 * consumed by the outbox relay job (worker) and the notifications endpoints.
 */
@Module({
  controllers: [NotifyController],
  providers: [
    NotifyService,
    { provide: NOTIFY_STORE, useClass: KyselyNotifyStore },
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createSmtpMailer({
          host: config.get("SMTP_HOST", { infer: true }),
          port: config.get("SMTP_PORT", { infer: true }),
          secure: config.get("SMTP_SECURE", { infer: true }),
          user: config.get("SMTP_USER", { infer: true }),
          pass: config.get("SMTP_PASS", { infer: true }),
          from: config.get("SMTP_FROM", { infer: true }),
        }),
    },
  ],
  exports: [NotifyService, NOTIFY_STORE, MAILER],
})
export class NotifyModule {}
