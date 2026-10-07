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

import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH_SHORT } from "@/config/offer-facts";

/**
 * The category name on public pages. Same string as `OFFER_CATEGORY` in
 * `offer-facts.ts`. Only public marketing routes and the root schema read it;
 * the admin dashboard and client workspace do not.
 */
export const PRODUCT_CATEGORY = OFFER_CATEGORY;

/**
 * The canonical brand one-liner, reused verbatim network-wide (title tags,
 * meta descriptions, schema `description`, footer boilerplate, external
 * profiles). Aligns with how Flow Group Ventures describes TaaSFlow while
 * keeping the platform positioning.
 */
export const BRAND_ONE_LINER =
  "A recruiting platform with managed execution: agents source and score candidates, a recruiter reviews, and you decide." as const;

/** Short form of the one-liner, for titles where length is capped. */
export const BRAND_DESCRIPTOR =
  "Recruiting Platform with Managed Execution" as const;

/** The one-line system claim. Same sentence as `WHO_RUNS_THE_SEARCH_SHORT`. */
export const SYSTEM_CLAIM = WHO_RUNS_THE_SEARCH_SHORT;

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
 * Public module directory. `anchor` is the section id used inside the module overview on /how-it-works,
 * so navigation and page content can never drift apart. Descriptions state
 * what the module does — no forward-looking or unverifiable claims.
 */
export const MODULE_SECTIONS = [
  {
    key: "intake",
    name: MODULES.intake,
    anchor: "intake-engine",
    description: "Captures the role, must-haves and constraints as structured data.",
  },
  {
    key: "blueprint",
    name: MODULES.blueprint,
    anchor: "blueprint-compiler",
    description: "Compiles that intake into the versioned rubric agents score against.",
  },
  {
    key: "agents",
    name: MODULES.agents,
    anchor: "agent-layer",
    description: "Runs continuous sourcing, screening and scoring against the blueprint.",
  },
  {
    key: "evidence",
    name: MODULES.evidence,
    anchor: "evidence-graph",
    description: "Links every requirement to the CV line or note that supports it.",
  },
  {
    key: "scoring",
    name: MODULES.scoring,
    anchor: "scoring-engine",
    description: "Produces 0–100 scores from cited evidence under a fixed rubric version.",
  },
  {
    key: "workspace",
    name: MODULES.workspace,
    anchor: "decision-workspace",
    description: "Where you compare, approve, reject and advance candidates.",
  },
  {
    key: "talentGraph",
    name: MODULES.talentGraph,
    anchor: "talent-graph",
    description: "Keeps past candidates and evidence reachable across future roles.",
  },
  {
    key: "governance",
    name: MODULES.governance,
    anchor: "governance-audit",
    description: "Records every state change, override and access event.",
  },
] as const satisfies ReadonlyArray<{
  key: ModuleKey;
  name: string;
  anchor: string;
  description: string;
}>;


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
