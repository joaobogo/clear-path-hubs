/**
 * First-run onboarding — the guided sequence that configures a hiring
 * operating system rather than filling in a form.
 *
 * Client-safe: pure data, no server imports. The server derives completion
 * from real records (see onboarding.functions.ts); this file only describes
 * what each step is for, how long it usually takes, what the system does while
 * the user is there, and what happens next.
 */

export const ONBOARDING_STEP_IDS = [
  "workspace",
  "role",
  "requirements",
  "blueprint",
  "weights",
  "agents",
  "oversight",
  "systems",
  "run",
  "workspace_entry",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStep = {
  id: OnboardingStepId;
  /** 1-based position in the sequence. */
  index: number;
  title: string;
  /** One line: what this step decides. */
  purpose: string;
  /** Typical time, in minutes, for a prepared user. */
  minutes: number;
  /** Required steps gate the first run. Optional steps can be skipped. */
  required: boolean;
  /** Plain description of the system work attached to this step. */
  systemWork: string;
  /** What the user should expect immediately after finishing this step. */
  whatNext: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "workspace",
    index: 1,
    title: "Create or confirm workspace",
    purpose: "Confirm the company this hiring system belongs to.",
    minutes: 2,
    required: true,
    systemWork:
      "Your workspace scopes every record. Roles, candidates, evidence and audit history are isolated to it at the database level.",
    whatNext: "Next you name the first role we will run.",
  },
  {
    id: "role",
    index: 2,
    title: "Define the first role",
    purpose: "Give the system the role it should hire for.",
    minutes: 4,
    required: true,
    systemWork:
      "The title, location and work model become the role record everything else attaches to — blueprint, rubric, runs and decisions.",
    whatNext: "Next you add the requirements the role is judged against.",
  },
  {
    id: "requirements",
    index: 3,
    title: "Add requirements and success criteria",
    purpose: "Say what a strong hire must prove.",
    minutes: 6,
    required: true,
    systemWork:
      "Must-haves become scored requirements. Nice-to-haves shift ranking without excluding anyone. Dealbreakers become eligibility checks that run before scoring.",
    whatNext: "Next the system compiles these into a role blueprint you review.",
  },
  {
    id: "blueprint",
    index: 4,
    title: "Review the compiled role blueprint",
    purpose: "Check what the system understood before it acts on it.",
    minutes: 5,
    required: true,
    systemWork:
      "Your inputs and the job description compile into a versioned blueprint: requirements, rubric shape and a sourcing plan. Nothing sources until you confirm it.",
    whatNext: "Next you set how much each dimension counts toward a score.",
  },
  {
    id: "weights",
    index: 5,
    title: "Configure scoring weights",
    purpose: "Decide what matters most when candidates are ranked.",
    minutes: 3,
    required: true,
    systemWork:
      "Weights are stored on the role and stamped into every score run, so any past score can be explained by the weights in force at the time.",
    whatNext: "Next you choose how hard the agents work this role.",
  },
  {
    id: "agents",
    index: 6,
    title: "Choose agent operating level",
    purpose: "Set the pace of sourcing, outreach and shortlisting.",
    minutes: 2,
    required: true,
    systemWork:
      "The operating level changes real work: how many people are sourced, how often they are contacted, and how large a shortlist reaches you.",
    whatNext: "Next you set the approvals that must happen before anything reaches a candidate.",
  },
  {
    id: "oversight",
    index: 7,
    title: "Set approval and oversight gates",
    purpose: "Decide where a human must sign off.",
    minutes: 3,
    required: true,
    systemWork:
      "Gates are enforced server-side. Candidate release always requires review; contact release is a separate permission, and neither can be turned off here.",
    whatNext: "Next you can connect the systems you already use.",
  },
  {
    id: "systems",
    index: 8,
    title: "Connect supported systems",
    purpose: "Bring calendar, email and messaging into the loop.",
    minutes: 4,
    required: false,
    systemWork:
      "Connected systems are health-checked on a schedule. Nothing is required to start a run — you can connect them later without losing progress.",
    whatNext: "Next you start the first run.",
  },
  {
    id: "run",
    index: 9,
    title: "Start the first run",
    purpose: "Put the configured system to work.",
    minutes: 1,
    required: true,
    systemWork:
      "The run compiles the blueprint, opens sourcing, and records every step with an actor, a time and a result you can audit.",
    whatNext: "Next you enter the Decision Workspace and wait for the first evidence.",
  },
  {
    id: "workspace_entry",
    index: 10,
    title: "Enter the Decision Workspace",
    purpose: "See where decisions will land.",
    minutes: 1,
    required: true,
    systemWork:
      "The workspace is where evidence-backed candidates queue for your decision. Every decision is reversible for a short window.",
    whatNext: "You are configured. The system will surface the first candidates for review.",
  },
] as const;

export const ONBOARDING_TOTAL_MINUTES = ONBOARDING_STEPS.reduce(
  (sum, s) => sum + s.minutes,
  0,
);

export function stepById(id: OnboardingStepId): OnboardingStep {
  const found = ONBOARDING_STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown onboarding step: ${id}`);
  return found;
}

/** Minutes still expected, given which steps are already complete. */
export function remainingMinutes(complete: readonly OnboardingStepId[]): number {
  return ONBOARDING_STEPS.filter((s) => !complete.includes(s.id)).reduce(
    (sum, s) => sum + s.minutes,
    0,
  );
}

export function formatMinutes(mins: number): string {
  if (mins <= 0) return "no time left";
  if (mins < 60) return `about ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `about ${h} hr ${m} min` : `about ${h} hr`;
}

/** The oversight gates a workspace can choose. Two are fixed by policy. */
export const OVERSIGHT_GATES = [
  {
    key: "candidate_release",
    label: "Approve candidates before they reach your team",
    detail:
      "A person on our side reviews every candidate against your requirements first. This cannot be switched off.",
    locked: true,
  },
  {
    key: "contact_release",
    label: "Approve contact details separately",
    detail:
      "Names and contact details are released only after you shortlist. This is a separate permission and cannot be switched off.",
    locked: true,
  },
  {
    key: "outreach_copy_review",
    label: "Review outreach copy before the first send",
    detail: "The first outreach message for this role waits for your sign-off.",
    locked: false,
  },
  {
    key: "interview_scheduling_review",
    label: "Confirm interview times yourself",
    detail:
      "Scheduling proposals wait for you instead of being confirmed automatically.",
    locked: false,
  },
  {
    key: "offer_review",
    label: "Approve offers before they are sent",
    detail: "Offer terms need a named approver in your workspace.",
    locked: false,
  },
] as const;

export type OversightGateKey = (typeof OVERSIGHT_GATES)[number]["key"];

export const DEFAULT_OPTIONAL_GATES: Record<string, boolean> = {
  outreach_copy_review: true,
  interview_scheduling_review: true,
  offer_review: true,
};
