import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { AdminCountry, Country } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

const CACHE_TTL_MS = 10_000;

const COUNTRY_COLS = ["code", "name_en", "name_fr", "dial_code", "currency_code", "enabled", "sort_order"] as const;

type CountryRow = {
  code: string;
  name_en: string;
  name_fr: string;
  dial_code: string;
  currency_code: string;
  enabled: boolean;
  sort_order: number;
};

const toWire = (r: CountryRow): Country => ({
  code: r.code,
  nameEn: r.name_en,
  nameFr: r.name_fr,
  dialCode: r.dial_code,
});

const toAdminWire = (r: CountryRow): AdminCountry => ({
  code: r.code,
  nameEn: r.name_en,
  nameFr: r.name_fr,
  dialCode: r.dial_code,
  currencyCode: r.currency_code,
  enabled: r.enabled,
  sortOrder: r.sort_order,
});

/**
 * countries — the market segmentation gate (migration 0015). Reads the reference
 * table with a short-TTL cache (the sign-up picker and the openTrade enabled-check
 * hit it often); the admin toggle calls invalidate() so a market switch takes
 * effect within the TTL window. Read-only here — the enable/disable WRITE + audit
 * live in the admin module, mirroring how SettingsService is read-only and the
 * admin module owns the kill-switch write.
 */
@Injectable()
export class CountriesService {
  private cache: { rows: CountryRow[]; expires: number } | null = null;

  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  private async all(): Promise<CountryRow[]> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.rows;
    const rows = await this.db.selectFrom("countries").select(COUNTRY_COLS).orderBy("sort_order").execute();
    this.cache = { rows, expires: Date.now() + CACHE_TTL_MS };
    return rows;
  }

  /** Drop the cache so an admin enable/disable applies immediately. */
  invalidate(): void {
    this.cache = null;
  }

  /** Public sign-up picker — ENABLED markets only. */
  async listEnabled(): Promise<Country[]> {
    return (await this.all()).filter((c) => c.enabled).map(toWire);
  }

  /** Admin console — every market, enabled or not. */
  async listAll(): Promise<AdminCountry[]> {
    return (await this.all()).map(toAdminWire);
  }

  /** Raw row lookup (cached) — used by sign-up enforcement (enabled + dial code). */
  async find(code: string): Promise<CountryRow | undefined> {
    return (await this.all()).find((c) => c.code === code);
  }

  /** True only when the market exists AND is currently enabled. */
  async isEnabled(code: string): Promise<boolean> {
    return (await this.find(code))?.enabled === true;
  }
}
