import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { inter, plexMono, spaceGrotesk } from "@/lib/fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuataTrade — Crypto to cash. Protected.",
  description:
    "P2P USDT marketplace with escrow protection for Cameroon. Trade with MTN MoMo, Orange Money, or QuataPay.",
};

// Locale comes from a cookie (next-intl without route-based i18n), so rendering
// is request-dependent — render dynamically rather than prerendering statically.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-theme="dark"
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
