/**
 * Plan, seats and onboarding — ONE account state, one vocabulary.
 *
 * The admin Overview, the admin Access tab, the client Setup wizard and the
 * client Account page each used to answer "what plan is this workspace on, how
 * many seats does it hold, how far through setup is it" from a different row.
 * A single record then read "No plan" on Overview, "current plan" on Access and
 * "Step 3 of 10" on the client side.
 *
 * Client-safe: types plus label derivation. The reader lives in
 * `account-state.server.ts`.
 */
import { ONBOARDING_STEP_TOTAL } from "@/lib/onboarding/derive-completion";

export type AccountPlanState = {
  /** Plan name as shown everywhere, or null when the workspace has none. */
  label: string | null;
  /** Where the label came from: subscription, entitlement or workspace record. */
  source: "subscription" | "entitlement" | "workspace" | "none";
  status: string | null;
};

export type AccountSeatState = {
  limit: number;
  used: number;
  remaining: number;
  /** Recruiter seats on the plan, excluding the owner seat. */
  recruiterSeats: number;
};

export type AccountOnboardingState = {
  /** Canonical state: the label is derived from this, never from a raw column. */
  status: "not_started" | "in_progress" | "live";
  stepsComplete: number;
  stepsTotal: number;
  /** Human sentence used on every surface. */
  label: string;
};

export type AccountState = {
  organization_id: string;
  plan: AccountPlanState;
  seats: AccountSeatState;
  onboarding: AccountOnboardingState;
  generated_at: string;
};

/** Wording used wherever a workspace has no plan on record. */
export const NO_PLAN_LABEL = "No plan on record";

export function planDisplayLabel(plan: AccountPlanState): string {
  return plan.label ?? NO_PLAN_LABEL;
}

export function seatsDisplayLabel(seats: AccountSeatState): string {
  return `${seats.used} of ${seats.limit} seats in use`;
}

/**
 * One rule for the onboarding sentence. Step progress wins over the stored
 * column, so a workspace mid-wizard can never read "Not started".
 */
export function deriveOnboardingState(input: {
  storedStatus?: string | null;
  stepsComplete: number;
  stepsTotal?: number;
}): AccountOnboardingState {
  const stepsTotal = input.stepsTotal ?? ONBOARDING_STEP_TOTAL;
  const stepsComplete = Math.max(0, Math.min(stepsTotal, input.stepsComplete));
  const stored = String(input.storedStatus ?? "not_started");
  const finished =
    stepsComplete >= stepsTotal || stored === "live" || stored === "complete";

  if (finished) {
    return {
      status: "live",
      stepsComplete: stepsTotal,
      stepsTotal,
      label: "Setup complete",
    };
  }
  if (stepsComplete > 0 || stored === "in_progress") {
    const at = Math.max(1, Math.min(stepsTotal, stepsComplete + 1));
    return {
      status: "in_progress",
      stepsComplete,
      stepsTotal,
      label: `In setup — step ${at} of ${stepsTotal}`,
    };
  }
  return {
    status: "not_started",
    stepsComplete: 0,
    stepsTotal,
    label: "Setup not started",
  };
}
