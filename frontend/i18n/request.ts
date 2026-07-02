import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Locale from the `qt_locale` cookie (set by the language toggle), defaulting
 * to English. French is a first-class citizen (Documents/11 §11.9), not an
 * afterthought — both message catalogs ship from day one.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("qt_locale")?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
