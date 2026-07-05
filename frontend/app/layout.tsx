import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { inter, plexMono, spaceGrotesk } from "@/lib/fonts";
import { Providers } from "./providers";
import "./globals.css";

const SITE_DESCRIPTION =
  "P2P USDT marketplace with escrow protection for Cameroon. Trade with MTN MoMo, Orange Money, or QuataPay.";

// Absolute base so relative OG/Twitter image URLs resolve to the real origin
// instead of Next's default http://localhost:3000 on a self-hosted deploy.
function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    return new URL(raw && raw.length > 0 ? raw : "https://quatatrade.com");
  } catch {
    return new URL("https://quatatrade.com");
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
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
    images: [{ url: "/assets/og-image.png", width: 1200, height: 627, alt: "QuataTrade — Crypto to cash. Protected." }],
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
  const t = await getTranslations("common");
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
          {/* Keyboard/SR users can jump past the header nav straight to the page
              body; hidden until focused (WCAG 2.4.1). Each shell's <main> carries
              id="main-content". */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-btn focus:bg-accent-400 focus:px-4 focus:py-2 focus:font-medium focus:text-bg"
          >
            {t("skipToContent")}
          </a>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
