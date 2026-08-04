/**
 * Canonical public product language for TaaSFlow.
 *
 * Single source of truth for how the product is named and described on every
 * public marketing surface. Copy that describes what the system is, what it
 * produces, or how work is organised must resolve to the values here.
 *
 * Human involvement is never erased — it is described as configurable expert
 * oversight, an approval gate, an escalation path, or a governance control.
 */

/** The category we compete in. Use verbatim. */
export const PRODUCT_CATEGORY = "AI Hiring Intelligence Platform" as const;

/** The one-line system claim. Use verbatim. */
export const SYSTEM_CLAIM =
  "Agents run the search. Evidence backs every score." as const;

/** Canonical module names. Never rename in copy. */
export const MODULES = {
  intake: "Intake Engine",
  blueprint: "Blueprint Compiler",
  agents: "Agent Layer",
  evidence: "Evidence Graph",
  scoring: "Scoring Engine",
  workspace: "Decision Workspace",
  talentGraph: "Talent Graph",
  intelligence: "Hiring Intelligence",
  governance: "Governance & Audit",
} as const;

export type ModuleKey = keyof typeof MODULES;

export const MODULE_LIST = [
  MODULES.intake,
  MODULES.blueprint,
  MODULES.agents,
  MODULES.evidence,
  MODULES.scoring,
  MODULES.workspace,
  MODULES.talentGraph,
  MODULES.intelligence,
  MODULES.governance,
] as const;

/**
 * Agency-style phrasing and the platform phrasing that replaces it.
 * Left side = do not ship on public marketing surfaces.
 */
export const LANGUAGE_SUBSTITUTIONS: ReadonlyArray<{
  avoid: string;
  use: string;
  note?: string;
}> = [
  { avoid: "our recruiters", use: "the TaaSFlow platform" },
  { avoid: "recruiter delivers", use: "the system produces" },
  { avoid: "recruiting pod", use: "agent capacity" },
  { avoid: "dedicated pod", use: "dedicated agent capacity" },
  { avoid: "delivery cadence", use: "system operating cadence" },
  { avoid: "we source", use: "sourcing agents continuously identify" },
  { avoid: "sourcing channels", use: "talent signals" },
  { avoid: "direct recruiter contact", use: "configurable expert oversight" },
  {
    avoid: "recruiting team",
    use: "expert oversight",
    note: "Humans remain in the loop as an approval gate and escalation path.",
  },
];

/**
 * How human involvement is described. Real, verifiable, and framed as control
 * over the system rather than as the service itself.
 */
export const OVERSIGHT_LANGUAGE = {
  label: "Configurable expert oversight",
  approvalGate: "Human approval gate before any candidate reaches your shortlist",
  escalation: "Escalation path to a named platform expert inside the workspace",
  governance: "Every override recorded in Governance & Audit",
} as const;

/**
 * Terms that must not describe TaaSFlow itself on public marketing surfaces.
 * Comparative use ("unlike a traditional agency…") stays allowed and honest —
 * these are banned as self-description only.
 */
export const BANNED_PUBLIC_TERMS = [
  "recruiter delivers",
  "our recruiters",
  "pod",
  "delivery cadence",
  "sourcing channels",
  "we source",
  "agency",
] as const;

export type BannedPublicTerm = (typeof BANNED_PUBLIC_TERMS)[number];

/** Canonical replacement for a banned term, when one is defined. */
export function replacementFor(term: string): string | undefined {
  return LANGUAGE_SUBSTITUTIONS.find(
    (s) => s.avoid.toLowerCase() === term.toLowerCase(),
  )?.use;
}
