"use client";

import { useEffect } from "react";

/**
 * Snap back to page 1 when the current page has gone empty.
 *
 * Admin queues shrink under the admin's own action — approve the last pending
 * KYC doc, acknowledge the last alerts, resolve the last dispute — and the page
 * number lives in useState, not the URL. Land on an empty page 2 and the list
 * renders "nothing here" while the queue still has items on page 1, with a full
 * browser reload as the only way back. Recovering automatically beats expecting
 * the operator to notice a pagination control that most empty states hide.
 */
export function usePageClamp(page: number, itemCount: number | undefined, setPage: (p: number) => void): void {
  useEffect(() => {
    if (page > 1 && itemCount === 0) setPage(1);
  }, [page, itemCount, setPage]);
}
