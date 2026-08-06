/**
 * Channel agent coverage — public, deliberately non-revealing.
 *
 * TaaSFlow runs a dedicated agent for every sourcing channel in the
 * ecosystem map (src/components/marketing/how-it-works-deep.tsx).
 * This config states coverage by family and what each agent is responsible
 * for. It intentionally does NOT publish query logic, targeting rules,
 * message templates, vendor names or per-channel yield — those live in the
 * workspace, per role, behind approval gates.
 *
 * Keep CHANNEL_FAMILIES counts in sync with SourcingEcosystemMap groups.
 */

export type ChannelFamily = {
  /** Family name, mirrors the sourcing ecosystem map headings. */
  name: string;
  /** How many channels in this family have a dedicated agent. */
  agents: number;
  /** What the agents in this family are responsible for — capability, not method. */
  responsibility: string;
};

export const CHANNEL_FAMILIES: readonly ChannelFamily[] = [
  {
    name: "Digital & professional networks",
    agents: 4,
    responsibility:
      "Keeps role queries tuned as the market moves, and hands every profile to the same evidence step.",
  },
  {
    name: "Direct & proprietary reach",
    agents: 4,
    responsibility:
      "Works your named targets and our own network first, so warm reach is used before paid reach.",
  },
  {
    name: "AI & intent intelligence",
    agents: 3,
    responsibility:
      "Watches public signals for people who just became reachable, and benchmarks the offer against live market data.",
  },
  {
    name: "Inbound & employer brand",
    agents: 4,
    responsibility:
      "Keeps the role visible to people who come to you, and scores inbound on the same rubric as outbound.",
  },
  {
    name: "Partnerships & offline",
    agents: 8,
    responsibility:
      "Covers the reach software usually skips — partners, campuses, events, phone, press — with attribution on every candidate.",
  },
] as const;

export const CHANNEL_AGENT_COUNT = CHANNEL_FAMILIES.reduce(
  (n, f) => n + f.agents,
  0,
);

/** What is the same across all channel agents — the honest, publishable part. */
export const CHANNEL_AGENT_INVARIANTS: readonly string[] = [
  "One rubric. A candidate from any channel is scored against the same frozen rubric version.",
  "One evidence bar. No channel can put a candidate in front of you without cited evidence.",
  "One log. Every channel agent's actions are recorded with actor, time and result.",
  "One gate. Nothing is sent and no candidate is released until a person approves it.",
];

/**
 * Deliberately withheld on public pages. Shown as a "what we don't publish"
 * note so the reticence reads as discipline, not vagueness.
 */
export const CHANNEL_AGENT_WITHHELD: readonly string[] = [
  "Per-channel query and targeting logic",
  "Message templates and sequence timing",
  "Partner, vendor and community names",
  "Per-channel yield and cost benchmarks",
];
