/**
 * Handoff after a hire — pure logic, safe on client and server.
 *
 * Once an offer is confirmed as a hire, the role stops being a search and
 * becomes a handoff. This module answers three questions and nothing else:
 *
 *  1. What was actually agreed (start date, compensation), read back from the
 *     hire record. Nothing is inferred; a missing field simply does not show.
 *  2. What the replacement guarantee is, DERIVED from the confirmed start date.
 *     A guarantee end date is never typed in by hand.
 *  3. What is left to do, taken from what the plan includes. A step with no
 *     recorded owner is shown as unassigned — it is never hidden.
 *
 * Not in scope: onboarding task management, HRIS fields, post-hire performance.
 */

import { addDays, guaranteeWindow, type GuaranteeWindow } from "./offer-hire";

export { guaranteeWindow, addDays };
export type { GuaranteeWindow };

/** The steps that can appear on a handoff. Nothing outside this list is shown. */
export const HANDOFF_STEP_KEYS = ["references", "background_check", "paperwork"] as const;

export type HandoffStepKey = (typeof HANDOFF_STEP_KEYS)[number];

type StepSpec = {
  key: HandoffStepKey;
  label: string;
  /** One plain line: what finishing this step means. */
  detail: string;
  sequence: number;
  /**
   * True when this step is part of the plan. Only plans that actually store the
   * service get the step — we never show a promise the contract does not carry.
   */
  includedIn: (plan: NormalisedPlan) => boolean;
};

/** A plan reduced to the two facts that decide handoff steps. */
export type NormalisedPlan = {
  label: string | null;
  /** True for the retained subscription tiers (Bronze and above). */
  isSubscription: boolean;
};

export const HANDOFF_STEP_SPECS: readonly StepSpec[] = [
  {
    key: "references",
    label: "Reference checks",
    detail: "Two references contacted and written up.",
    sequence: 1,
    includedIn: () => true,
  },
  {
    key: "background_check",
    label: "Background check",
    detail: "Identity and employment history verified by our provider.",
    sequence: 2,
    includedIn: (plan) => plan.isSubscription,
  },
  {
    key: "paperwork",
    label: "Contract and paperwork",
    detail: "Signed contract and start-day paperwork returned.",
    sequence: 3,
    includedIn: () => true,
  },
];

const SUBSCRIPTION_HINTS = ["bronze", "silver", "gold", "enterprise", "subscription", "retained"];

/** Classifies a stored plan label. Unknown labels are treated as packages. */
export function normalisePlan(
  label: string | null | undefined,
  source?: string | null,
): NormalisedPlan {
  const text = `${label ?? ""} ${source ?? ""}`.toLowerCase();
  return {
    label: label ?? null,
    isSubscription: SUBSCRIPTION_HINTS.some((hint) => text.includes(hint)),
  };
}

/** The steps this plan includes, in order. */
export function planSteps(plan: NormalisedPlan): readonly StepSpec[] {
  return HANDOFF_STEP_SPECS.filter((s) => s.includedIn(plan));
}

/** Shown in place of an owner when nobody is recorded against the step. */
export const UNASSIGNED_OWNER = "Unassigned";

export type HandoffStep = {
  key: HandoffStepKey;
  label: string;
  detail: string;
  sequence: number;
  /** Null when nobody is recorded — the UI shows "Unassigned". */
  owner_name: string | null;
  completed_at: string | null;
};

/** One persisted override row: completion and/or a recorded owner. */
export type HandoffStepRecord = {
  step_key: string;
  owner_name?: string | null;
  completed_at?: string | null;
};

/**
 * Builds the step list from the plan, then overlays what has been recorded.
 * Completion and owners persist; the catalogue itself comes from the plan.
 */
export function buildHandoffSteps(
  plan: NormalisedPlan,
  records: readonly HandoffStepRecord[],
  defaults: { serviceOwnerName?: string | null } = {},
): HandoffStep[] {
  const byKey = new Map(records.map((r) => [r.step_key, r]));
  return planSteps(plan)
    .map((spec) => {
      const rec = byKey.get(spec.key);
      const recordedOwner = rec?.owner_name?.trim() || null;
      const fallbackOwner =
        spec.key === "paperwork" ? null : defaults.serviceOwnerName?.trim() || null;
      return {
        key: spec.key,
        label: spec.label,
        detail: spec.detail,
        sequence: spec.sequence,
        owner_name: recordedOwner ?? fallbackOwner,
        completed_at: rec?.completed_at ?? null,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

export function remainingSteps(steps: readonly HandoffStep[]): HandoffStep[] {
  return steps.filter((s) => !s.completed_at);
}

/** Validation: a start date must be a real date on or after acceptance. */
export function validateStartDate(
  startDate: string,
  acceptedAt: string | null | undefined,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "Use a real date in YYYY-MM-DD form";
  const ms = new Date(`${startDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(ms)) return "That is not a real date";
  if (startDate.slice(0, 10) !== new Date(ms).toISOString().slice(0, 10)) {
    return "That is not a real date";
  }
  if (acceptedAt) {
    const accepted = acceptedAt.slice(0, 10);
    if (startDate < accepted) return `The start date cannot be before acceptance on ${accepted}`;
  }
  return null;
}

export type HandoffCompensation = {
  amount: number | null;
  currency: string | null;
  period: string | null;
  /** Ready-to-read line, or null when nothing was recorded. */
  label: string | null;
};

export function compensationLine(input: {
  salary_amount?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
}): HandoffCompensation {
  const amount = typeof input.salary_amount === "number" ? input.salary_amount : null;
  const currency = input.salary_currency ?? null;
  const period = input.salary_period ?? null;
  if (amount === null) {
    return { amount: null, currency, period, label: null };
  }
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "USD").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
  const suffix =
    period === "hourly"
      ? " per hour"
      : period === "monthly"
        ? " per month"
        : period === "daily"
          ? " per day"
          : " per year";
  return { amount, currency, period, label: `${money}${suffix}` };
}

/** Everything /client/positions/$id needs to render the handoff view. */
export type PositionHandoff = {
  position_id: string;
  position_title: string;
  hire_id: string;
  candidate_name: string;
  /** ISO timestamp the offer was accepted, when recorded. */
  accepted_at: string | null;
  hired_at: string | null;
  start_date: string | null;
  start_date_confirmed: boolean;
  compensation: HandoffCompensation;
  employment_type: string | null;
  location: string | null;
  work_model: string | null;
  /** Derived from the confirmed start date. Null until one exists. */
  guarantee: GuaranteeWindow | null;
  /** The contract wording for the guarantee, when stored. */
  guarantee_terms: string | null;
  guarantee_visible: boolean;
  plan_label: string | null;
  steps: HandoffStep[];
  generated_at: string;
};

export const HANDOFF_NO_START_DATE =
  "The start date has not been confirmed yet. Your guarantee window begins the day they start.";

export const HANDOFF_GUARANTEE_HIDDEN =
  "Your replacement guarantee is set out in your agreement.";
