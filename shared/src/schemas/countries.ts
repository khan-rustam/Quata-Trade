import { z } from "zod";
import { PAYMENT_METHODS } from "../constants.js";
import { zTotpCode } from "./common.js";

/**
 * Country market segmentation. The public shape lists only ENABLED markets a
 * user may sign up under, and now carries the market's currency + available
 * payment rails so the app can localise fiat display and offer creation. The
 * admin shape adds disabled markets + the configure/enable action. Enablement +
 * rails authority is server-side (the DB), never a static list here — launching
 * or reconfiguring a market must not require a contract redeploy.
 */
export const zCountry = z.object({
  code: z.string().length(2),
  nameEn: z.string(),
  nameFr: z.string(),
  dialCode: z.string(),
  currencyCode: z.string(),
  fiatDecimals: z.number().int(),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)),
});
export type Country = z.infer<typeof zCountry>;

export const zCountriesResponse = z.object({ countries: z.array(zCountry) });
export type CountriesResponse = z.infer<typeof zCountriesResponse>;

/** Admin view — every market, enabled or not, with its full rail configuration. */
export const zAdminCountry = z.object({
  code: z.string().length(2),
  nameEn: z.string(),
  nameFr: z.string(),
  dialCode: z.string(),
  currencyCode: z.string(),
  fiatDecimals: z.number().int(),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
});
export type AdminCountry = z.infer<typeof zAdminCountry>;

export const zAdminCountriesResponse = z.object({ countries: z.array(zAdminCountry) });
export type AdminCountriesResponse = z.infer<typeof zAdminCountriesResponse>;

/**
 * Configure a market: set its enabled state AND its available payment rails in one
 * TOTP-verified, audited action. An enabled market must offer at least one rail
 * (otherwise no one there could create an offer).
 */
export const zUpdateCountryRequest = z
  .object({
    enabled: z.boolean(),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)),
    totpCode: zTotpCode.optional(),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict()
  .refine((v) => !v.enabled || v.paymentMethods.length > 0, {
    message: "An enabled market needs at least one payment rail",
    path: ["paymentMethods"],
  });
export type UpdateCountryRequest = z.infer<typeof zUpdateCountryRequest>;
