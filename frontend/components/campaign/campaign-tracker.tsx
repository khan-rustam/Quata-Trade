"use client";

import { useEffect } from "react";

import { captureCampaign, pushCampaignEvent } from "@/lib/campaign";

interface CampaignTrackerProps {
  /**
   * Which sign-up funnel this page opens — `general`, `trader`, `business`.
   *
   * QuataTrade has one account type; every user can both buy and sell. The
   * segment is therefore a *reporting* dimension, not an account attribute:
   * it records which ad framing brought the visitor in, so conversions can
   * be split by campaign without inventing an account distinction the
   * product does not have.
   */
  segment: string;
}

/**
 * Drop-in campaign capture for a sign-up landing page.
 *
 * Renders nothing. On mount it reads the ad parameters off the landing URL,
 * persists them so they survive the three-step form and the email
 * verification round-trip, and fires a `signup_landing_view` event.
 */
export function CampaignTracker({ segment }: CampaignTrackerProps): null {
  useEffect(() => {
    captureCampaign({ segment });
    pushCampaignEvent("signup_landing_view", { signup_segment: segment });
  }, [segment]);

  return null;
}
