/**
 * Which onboarding steps are done — ONE derivation.
 *
 * The client Setup wizard and the admin client record used to answer this
 * question separately: the wizard counted real records, the admin Overview
 * printed the raw `organizations.onboarding_status` column. The same workspace
 * then read "Step 3 of 10" on one screen and "Not started" on the other.
 *
 * Client-safe: pure functions over already-loaded rows.
 */
import {
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";

/** Blueprint states that mean the search has been handed to the system. */
export const RUNNING_BLUEPRINT_STATES = [
  "ready",
  "confirmed",
  "analyzing_jd",
  "researching_company",
  "drafting_blueprint",
] as const;

export type OnboardingCompletionInput = {
  organizationName?: string | null;
  /** Steps the user explicitly confirmed in the wizard (draft-held). */
  confirmed?: Partial<Record<OnboardingStepId, unknown>>;
  position?: {
    title?: string | null;
    mustHaveCount?: number;
    blueprintConfirmedAt?: string | null;
    weightsSet?: boolean;
    oversightKeys?: number;
    blueprintStatus?: string | null;
    searchLiveAt?: string | null;
  } | null;
};

export function deriveOnboardingCompletion(
  input: OnboardingCompletionInput,
): OnboardingStepId[] {
  const confirmed = input.confirmed ?? {};
  const p = input.position ?? null;
  const done: OnboardingStepId[] = [];

  if (input.organizationName && confirmed.workspace) done.push("workspace");
  if (p && String(p.title ?? "").trim().length > 1) done.push("role");
  if (p && (p.mustHaveCount ?? 0) >= 3) done.push("requirements");
  if (p?.blueprintConfirmedAt) done.push("blueprint");
  if (p?.weightsSet) done.push("weights");
  if (confirmed.agents) done.push("agents");
  if (p && (p.oversightKeys ?? 0) > 0) done.push("oversight");
  if (confirmed.systems) done.push("systems");
  if (
    p &&
    (p.searchLiveAt ||
      (RUNNING_BLUEPRINT_STATES as readonly string[]).includes(
        String(p.blueprintStatus ?? ""),
      ))
  ) {
    done.push("run");
  }
  if (confirmed.workspace_entry) done.push("workspace_entry");

  return done;
}

export function nextIncompleteStep(
  complete: readonly OnboardingStepId[],
): OnboardingStepId {
  return ONBOARDING_STEP_IDS.find((id) => !complete.includes(id)) ?? "workspace_entry";
}

export const ONBOARDING_STEP_TOTAL = ONBOARDING_STEPS.length;
