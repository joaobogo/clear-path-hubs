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
    /** Lifecycle status of the role (`active`, `filled`, `draft`, …). */
    status?: string | null;
    /** Candidates already shared with the workspace for this role. */
    deliveredCandidates?: number;
  } | null;
};

/** Statuses that mean the role is past setup and out in the market. */
const LIVE_POSITION_STATUSES = ["active", "paused", "filled", "closed"];

/**
 * A role that is producing has, by definition, been set up.
 *
 * Setup completion used to be inferred only from the wizard's own artefacts, so
 * a role that went live through intake or staff onboarding — search running,
 * candidates delivered, an offer out — still read "Step 4 of 10: nothing sources
 * until you confirm it". Real activity is the stronger evidence, so it wins.
 */
export function isPositionLive(
  p: NonNullable<OnboardingCompletionInput["position"]>,
): boolean {
  if (p.searchLiveAt) return true;
  if ((p.deliveredCandidates ?? 0) > 0) return true;
  return LIVE_POSITION_STATUSES.includes(String(p.status ?? ""));
}

export function deriveOnboardingCompletion(
  input: OnboardingCompletionInput,
): OnboardingStepId[] {
  const confirmed = input.confirmed ?? {};
  const p = input.position ?? null;
  const done: OnboardingStepId[] = [];

  // A live role means every configuration step behind it happened, whichever
  // route it took. The wizard then reads as complete instead of asking the user
  // to confirm a summary for a search that is already delivering candidates.
  if (p && isPositionLive(p)) {
    return [...ONBOARDING_STEP_IDS];
  }

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
