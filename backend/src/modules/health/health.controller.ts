import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { Public } from "../../common/auth/decorators";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { SettingsService } from "../settings/settings.service";

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get("health")
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  @Public()
  @Get("health/ready")
  async readiness(): Promise<Record<string, unknown>> {
    try {
      await sql`SELECT 1`.execute(this.db);
      const killSwitches = await this.settings.killSwitches();
      return {
        status: "ok",
        db: "up",
        killSwitches,
      };
    } catch {
      throw new ServiceUnavailableException({ status: "degraded", db: "down" });
    }
  }
}
