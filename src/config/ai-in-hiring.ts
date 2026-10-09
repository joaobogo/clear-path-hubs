/**
 * Content for /ai-in-hiring.
 * ------------------------------------------------------------------
 * Every string on that page is either defined here or comes from a shared
 * constant it imports (offer-facts, trust-center, the agent registry). Each
 * statement notes where it comes from. Do not add a claim that has no source:
 * if it cannot be traced to code or to the published Privacy Notice, it goes to
 * the owner as a question instead.
 *
 * Deliberately NOT stated, because nothing in the codebase verifies it:
 *   - that any personal characteristic or location is excluded from scoring,
 *   - that any bias test or independent audit has been done,
 *   - whether model providers train on candidate data.
 */
import { HUMAN_OVERSIGHT_NOTE, RECORDS_NOTE } from "@/config/offer-facts";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { TRUST_SECTIONS } from "@/config/trust-center";

const agent = (key: "sourcing" | "screening") => {
  const found = AGENT_REGISTRY.find((a) => a.key === key);
  if (!found) throw new Error(`Agent ${key} missing from registry`);
  return found;
};

const retention = TRUST_SECTIONS.find((s) => s.id === "data-retention");

export const AI_PAGE_TITLE = "How AI is used in hiring";
export const AI_PAGE_LEAD = HUMAN_OVERSIGHT_NOTE;
export const AI_PAGE_INTRO =
  "This page explains, in plain language, where TaaSFlow uses AI on candidate data, what a person still decides, and how a candidate can ask for a human to look again. It describes how the product works today.";

export type AiSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const AI_SECTIONS: AiSection[] = [
  {
    id: "what-agents-do",
    title: "What the agents do",
    paragraphs: [
      HUMAN_OVERSIGHT_NOTE,
      `Sourcing agent: ${agent("sourcing").job}`,
      `Screening agent: ${agent("screening").job}`,
    ],
    bullets: [
      ...agent("sourcing").neverWithoutHuman.map((x) => `Sourcing never does this without a person: ${x}`),
      ...agent("screening").neverWithoutHuman.map((x) => `Screening never does this without a person: ${x}`),
    ],
  },
  {
    id: "what-feeds-a-score",
    title: "What feeds a score",
    paragraphs: [
      "A score is calculated against the rubric for one role. The rubric lists the criteria, a weight for each, and whether each is a must-have.",
      "Each criterion is checked against evidence: the passage of the CV it came from is stored with the score. A score run is tied to one candidate and one role, and it is append-only, so a later change creates a new run instead of editing the old one.",
      "A run is produced by rule and term matching, by model-assisted evaluation, or by a reviewer’s adjustments on top of a machine run. The run records which.",
    ],
  },
  {
    id: "human-step",
    title: "Where a person decides",
    paragraphs: [
      "A candidate score is not shown to a client until it has been approved. The platform checks that an approved score run exists, that the integrity checks pass and that every required criterion has valid evidence before a candidate becomes visible to a client.",
      "A reviewer can mark a requirement as met, not met or not applicable, and the score is recalculated and labelled as human adjusted. Every hiring decision is made by you.",
    ],
  },
  {
    id: "bias-testing",
    title: "Bias testing",
    paragraphs: [
      "We do not publish bias test results, and we hold no independent audit report. The security page is our own account of how the system works, not a third-party verification.",
    ],
  },
  {
    id: "human-review",
    title: "How a candidate can ask for human review",
    paragraphs: [
      "Candidates have the right to request a human explanation of any automated assessment, or to contest the result. This is stated in section 10 of the Privacy Notice.",
      "To ask, email privacy@taasflow.com. The Privacy Notice says we respond to requests within 30 days.",
    ],
  },
  {
    id: "retention",
    title: "How long records are kept",
    paragraphs: [
      RECORDS_NOTE,
      "The Privacy Notice also sets retention periods for candidate data, including CVs and profiles. See section 8 of the Privacy Notice.",
      ...(retention?.note ? [retention.note] : []),
    ],
  },
  {
    id: "model-providers",
    title: "Who processes candidate data for AI",
    paragraphs: [
      "The Privacy Notice lists Google LLC as a sub-processor for the AI models used for CV parsing and role-fit scoring. The models are Google Gemini models, called through TaaSFlow’s managed AI gateway.",
      "The Privacy Notice also states that sub-processors are contractually prohibited from using your personal data for any purpose other than providing services to us.",
    ],
  },
];

export const AI_LAWS_HEADING = "Laws that may apply to employers using automated tools";
export const AI_LAWS_INTRO =
  "Some places regulate the use of automated tools in hiring. These are named as a pointer only. This is not legal advice; confirm with counsel which rules apply to you.";
export const AI_LAWS = [
  "New York City Local Law 144",
  "California rules on automated decision systems",
  "Illinois",
  "Colorado",
  "EU AI Act",
] as const;

export const AI_RELATED_LINKS = [
  { label: "Privacy Notice", to: "/privacy" },
  { label: "Security", to: "/security" },
] as const;

/** Every sentence the page may render. The smoke test checks the DOM against this. */
export function allowedAiPageStrings(): string[] {
  return [
    AI_PAGE_TITLE,
    AI_PAGE_LEAD,
    AI_PAGE_INTRO,
    AI_LAWS_HEADING,
    AI_LAWS_INTRO,
    ...AI_LAWS,
    ...AI_RELATED_LINKS.map((l) => l.label),
    ...AI_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
  ];
}
