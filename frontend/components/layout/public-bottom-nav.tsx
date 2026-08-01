"use client";

import { MobileBottomNav } from "./mobile-bottom-nav";
import { useAuthBootstrap, useMe } from "@/hooks/use-auth";

/**
 * The app's bottom nav, shown on PUBLIC pages to signed-in users only.
 *
 * `/markets` is deliberately public — informational and indexed — but it is
 * also a tab in the bottom bar. A signed-in user tapping it left the `(app)`
 * layout, the bar disappeared, and the marketing header offered "Log in",
 * which reads as being signed out mid-session. This keeps the bar with them.
 *
 * Renders nothing for logged-out visitors: the marketing pages must stay
 * marketing pages, and an unauthenticated visitor tapping "Wallet" would only
 * bounce off the auth guard.
 */
export function PublicBottomNav(): React.JSX.Element | null {
  const ready = useAuthBootstrap();
  const { data: me } = useMe(ready);
  if (!me || me.status !== "active") return null;
  return (
    <>
      <MobileBottomNav />
      {/* The bar is fixed, so without this the footer's last rows sit under
          it — on a phone that hides the legal links entirely. */}
      <div aria-hidden className="h-14 md:hidden" />
    </>
  );
}
