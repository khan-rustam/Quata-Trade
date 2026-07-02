import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { WorkerModule } from "./worker.module";

/**
 * Worker entry point (Documents/03-architecture.md `apps/worker`):
 * BullMQ processors — deposit scanner, withdrawal pipeline, trade timeouts,
 * reconciliation, notification dispatch, outbox relay. No HTTP surface.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
