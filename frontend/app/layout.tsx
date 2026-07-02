import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { inter, plexMono, spaceGrotesk } from "@/lib/fonts";
import { Providers } from "./providers";
import "./globals.css";

const SITE_DESCRIPTION =
  "P2P USDT marketplace with escrow protection for Cameroon. Trade with MTN MoMo, Orange Money, or QuataPay.";

export const metadata: Metadata = {
  title: {
    default: "QuataTrade — Crypto to cash. Protected.",
    template: "%s · QuataTrade",
  },
  description: SITE_DESCRIPTION,
  applicationName: "QuataTrade",
  openGraph: {
    type: "website",
    siteName: "QuataTrade",
    title: "QuataTrade — Crypto to cash. Protected.",
    description: SITE_DESCRIPTION,
    images: [{ url: "/assets/og-image.png", width: 1734, height: 907, alt: "QuataTrade — Crypto to cash. Protected." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuataTrade — Crypto to cash. Protected.",
    description: SITE_DESCRIPTION,
    images: ["/assets/twitter-card.png"],
  },
};

// Locale comes from a cookie (next-intl without route-based i18n), so rendering
// is request-dependent — render dynamically rather than prerendering statically.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const theme = cookieStore.get("qt_theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang={locale}
      data-theme={theme}
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
