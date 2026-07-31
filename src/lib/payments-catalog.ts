/**
 * What a client is buying when they publish a role.
 * Amounts mirror src/config/pricing-core.ts — the price actually charged is
 * always resolved server-side from Stripe, never from the browser.
 */
import { PRICE_PILOT_USD, TURNAROUND_LABEL } from "@/config/pricing-core";

export const POSITION_PUBLISH_PRICE_ID = "pilot_onetime";

export const POSITION_PUBLISH_OFFER = {
  priceId: POSITION_PUBLISH_PRICE_ID,
  name: "Pilot — 1 active role",
  amountUsd: PRICE_PILOT_USD,
  display: `$${PRICE_PILOT_USD}`,
  turnaround: TURNAROUND_LABEL,
  includes: [
    "One active role published to the job board and our sourcing network",
    "Sourcing, outreach and application handling by our team",
    "Evidence-backed shortlist in your workspace — no CV dumps",
    "Full ATS: pipeline, interviews, scorecards and offers",
  ],
  nextSteps: [
    "Your role goes live the moment payment clears — no extra step from you.",
    "We confirm the brief and start sourcing the same working day.",
    "First shortlisted candidates land in your workspace within 5 working days.",
  ],
} as const;
