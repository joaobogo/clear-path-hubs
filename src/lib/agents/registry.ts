/**
 * Prompt 8 — the canonical agent roster.
 *
 * This file is the single source of truth for which recruiting agents exist,
 * what each one does, what it reads, what it produces, what it will never do
 * without a human, and who is allowed to switch it on.
 *
 * Nothing else in the product may invent an agent. If it is not in this
 * registry, it does not exist.
 */

export type AgentKey =
  | "sourcing"
  | "screening"
  | "outreach"
  | "scheduling"
  | "market_research"
  | "pipeline_watch";

/** Which membership roles may switch an agent on. */
export type SwitchPermission = "client_admin" | "platform_staff";

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  /** One sentence, in the client's language, describing the exact job. */
  job: string;
  /** What the agent reads before it acts. */
  inputs: string[];
  /** What the agent produces. Concrete artefacts, not "insight". */
  outputs: string[];
  /** Hard limits. The agent will never do these without a human. */
  neverWithoutHuman: string[];
  /** Who can switch it on. */
  switchPermission: SwitchPermission;
  /** What the client sees when it is off. */
  offConsequence: string;
};

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    key: "sourcing",
    name: "Sourcing",
    job: "Finds people who match an open role and adds them to the role's longlist.",
    inputs: [
      "The role requirements and location rules",
      "The talent graph: people already known to the platform",
      "Talent memory: silver medallists kept from earlier searches",
    ],
    outputs: [
      "Longlist entries with a stated reason for each person",
      "A record in the talent graph that this person was seen for this role",
    ],
    neverWithoutHuman: [
      "Contact anyone — that is the Outreach agent, and it needs its own switch",
      "Show a person to the client before an admin approves them",
    ],
    switchPermission: "client_admin",
    offConsequence: "Longlists are built by a recruiter by hand.",
  },
  {
    key: "screening",
    name: "Screening",
    job: "Reads each CV and records evidence against your stated requirements.",
    inputs: [
      "The CV on file, PDF only",
      "The role's requirement list and rubric version",
    ],
    outputs: [
      "Evidence items with the source passage they came from",
      "A score run tied to one exact candidate and one exact role",
    ],
    neverWithoutHuman: [
      "Reject a candidate",
      "Publish a score to the client — an admin approves every published score",
    ],
    switchPermission: "client_admin",
    offConsequence: "Applications wait for a recruiter to review them manually.",
  },
  {
    key: "outreach",
    name: "Outreach",
    job: "Runs the approved contact sequence across email, LinkedIn, SMS and phone tasks.",
    inputs: [
      "The role's outreach campaign and message templates",
      "Your channel rules and the platform contact guard",
      "Opt-outs and existing replies",
    ],
    outputs: [
      "Sent messages, logged per channel",
      "Replies captured into the candidate's single conversation",
      "A blocked-with-reason record whenever a rule stops a contact",
    ],
    neverWithoutHuman: [
      "Send a message body you have not approved",
      "Contact anyone already in process, opted out, or who has replied",
      "Contact the same person twice on one channel inside your window",
    ],
    switchPermission: "client_admin",
    offConsequence: "No messages leave the platform. Sequences stay queued.",
  },
  {
    key: "scheduling",
    name: "Scheduling",
    job: "Offers interview slots from your availability and confirms the booking.",
    inputs: [
      "Your availability windows and scheduling settings",
      "Candidate stage and interview requests",
    ],
    outputs: [
      "Slot offers sent to the candidate",
      "Confirmed interviews with times on both calendars",
    ],
    neverWithoutHuman: [
      "Cancel a confirmed interview",
      "Book outside the availability you set",
    ],
    switchPermission: "client_admin",
    offConsequence: "Interview times are agreed by message instead.",
  },
  {
    key: "market_research",
    name: "Market Research",
    job: "Compares your role against closed searches to flag unrealistic requirements or pay.",
    inputs: [
      "Signals written back from closed searches",
      "Your role's requirements, package and location",
    ],
    outputs: [
      "A realism note on the role, with the sample size behind it",
      "Compensation alignment against evidence, never against a guess",
    ],
    neverWithoutHuman: [
      "Change your requirements or your advertised package",
      "Publish a benchmark that rests on fewer than five closed searches",
    ],
    switchPermission: "client_admin",
    offConsequence: "You get no realism check on new roles.",
  },
  {
    key: "pipeline_watch",
    name: "Pipeline Watch",
    job: "Watches for roles and candidates that have gone quiet and raises them.",
    inputs: [
      "Stage history and time in stage",
      "Your service commitments and open decisions",
    ],
    outputs: [
      "A flagged role or candidate with what is stalling it",
      "A task on the right person's queue",
    ],
    neverWithoutHuman: [
      "Move a candidate to another stage",
      "Chase your team on your behalf without your say-so",
    ],
    switchPermission: "client_admin",
    offConsequence: "Stalled roles are only spotted when someone looks.",
  },
] as const;

export const AGENT_KEYS = AGENT_REGISTRY.map((a) => a.key);

export function getAgent(key: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.key === key);
}

export function agentName(key: string): string {
  return getAgent(key)?.name ?? key;
}

/** Plain-language state line for a card. Never a status code. */
export function agentStateLine(opts: {
  enabled: boolean;
  pausedAt: string | null;
  offConsequence: string;
}): string {
  if (opts.pausedAt) return "Paused. It is not doing any work right now.";
  if (!opts.enabled) return `Off. ${opts.offConsequence}`;
  return "On and working.";
}
