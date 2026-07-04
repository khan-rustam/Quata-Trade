"use client";

import type { Country } from "@quatatrade/shared";
import { useMe } from "@/hooks/use-auth";
import { useCountries } from "@/hooks/use-countries";

/**
 * Cameroon fallback used before /me + /countries resolve (and on public/pre-auth
 * surfaces, which stay CM/XAF). CM is always the launch market.
 */
export const CM_MARKET: Country = {
  code: "CM",
  nameEn: "Cameroon",
  nameFr: "Cameroun",
  dialCode: "+237",
  currencyCode: "XAF",
  fiatDecimals: 0,
  paymentMethods: ["QUATAPAY", "MTN_MOMO", "ORANGE_MONEY"],
};

/**
 * The signed-in user's market — its currency (for fiat display) and its available
 * payment rails (for offer creation). Falls back to Cameroon when unknown.
 */
export function useUserMarket(): Country {
  const { data: me } = useMe();
  const { data } = useCountries();
  return data?.countries.find((c) => c.code === me?.country) ?? CM_MARKET;
}
