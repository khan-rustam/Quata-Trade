import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketsView } from "@/components/markets/markets-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("markets");
  return { title: t("title"), description: t("subtitle") };
}

/**
 * Markets — public, informational market data (Phase A: global overview,
 * featured cards, live searchable/sortable table). Independent of the P2P
 * engine; visible to logged-out visitors and logged-in users alike.
 */
export default function MarketsPage(): React.JSX.Element {
  return <MarketsView />;
}
