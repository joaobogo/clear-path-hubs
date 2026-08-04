/**
 * Public agent roster.
 *
 * Every entry maps to functionality that exists in the running system:
 *  - `registryKey` entries are the client-switchable agents defined in
 *    src/lib/agents/registry.ts and surfaced by getAgentPanel().
 *  - `kind: "automation"` entries are always-on server pipelines
 *    (CV pipeline runner, blueprint compiler, scoring engine, audit events).
 *
 * `representative` blocks are illustrative only and MUST be rendered under a
 * visible "Representative data" label. No live status is implied anywhere.
 */

import { AGENT_REGISTRY, type AgentKey } from "@/lib/agents/registry";

/** Statuses a run can be in. Used only for representative activity. */
export const AGENT_STATUSES = [
  "Running",
  "Waiting for approval",
  "Scheduled",
  "Monitoring",
  "Complete",
  "Needs attention",
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type RosterEntry = {
  id: string;
  role: string;
  /** "agent" = switchable per organisation. "automation" = always on. */
  kind: "agent" | "automation";
  /** Which registry agents back this role, when any. */
  registryKeys: readonly AgentKey[];
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  /** Factual operating state — configuration, not live telemetry. */
  operatingState: string;
  controls: readonly string[];
  approval: string;
  events: readonly string[];
  representative: { status: AgentStatus; activity: string };
};

const def = (key: AgentKey) => AGENT_REGISTRY.find((a) => a.key === key)!;

export const ROSTER: readonly RosterEntry[] = [
  {
    id: "intake",
    role: "Intake Agent",
    kind: "automation",
    registryKeys: [],
    purpose:
      "Turns a submitted role brief into a validated requisition, and moves each new application through parse, hydrate and enrich steps.",
    inputs: [
      "Role brief, must-haves and constraints",
      "Job description and CV uploads (PDF only)",
    ],
    outputs: [
      "A validated requisition record",
      "A parsed candidate profile, or a manual-review flag when parsing fails",
    ],
    operatingState:
      "Always on. Runs on submission; each step is idempotent and safe to retry.",
    controls: [
      "Edit any intake field before the role is launched",
      "Set role intensity: steady, standard or aggressive",
    ],
    approval:
      "No approval needed to validate and parse. Nothing is released to a client from this step.",
    events: [
      "A processing job row per step, with attempt count and error code",
      "Audit event for the submission and for every later edit",
    ],
    representative: {
      status: "Complete",
      activity: "Parsed 3 new applications for Senior Engineer; 1 sent to manual review.",
    },
  },
  {
    id: "blueprint",
    role: "Blueprint Agent",
    kind: "automation",
    registryKeys: [],
    purpose:
      "Compiles the validated requisition into a scoreable, versioned rubric with weighted dimensions.",
    inputs: ["The validated requisition", "Your dimension weighting preferences"],
    outputs: [
      "A frozen rubric version",
      "A written blueprint for review before sourcing starts",
    ],
    operatingState: "Always on. Runs once per role, and again on a re-compile.",
    controls: [
      "Adjust weights across role fit, evidence, logistics and signal",
      "Send the blueprint back for changes",
    ],
    approval:
      "Sourcing does not start until the blueprint is approved. Rubric versions are immutable once scored against.",
    events: ["Each rubric version, with who approved it and when"],
    representative: {
      status: "Waiting for approval",
      activity: "Compiled rubric v3 for Finance Manager; awaiting blueprint sign-off.",
    },
  },
  {
    id: "discovery",
    role: "Talent Discovery Agent",
    kind: "agent",
    registryKeys: ["sourcing", "market_research"],
    purpose: def("sourcing").job,
    inputs: def("sourcing").inputs,
    outputs: def("sourcing").outputs,
    operatingState:
      "Switchable per organisation. Off by default; when off, longlists are built by hand.",
    controls: [
      "Switch on, pause or switch off per role",
      "Change role intensity to change volume",
    ],
    approval:
      "Cannot contact anyone, and cannot show a person to a client before an admin approves them.",
    events: [
      "Every longlist entry with its stated reason",
      "A talent-graph record that this person was seen for this role",
    ],
    representative: {
      status: "Running",
      activity: "Added 12 candidates to the Operations Lead longlist this week.",
    },
  },
  {
    id: "evidence",
    role: "Evidence Agent",
    kind: "agent",
    registryKeys: ["screening"],
    purpose:
      "Reads each CV and records evidence for or against each stated requirement, with the source passage attached.",
    inputs: def("screening").inputs,
    outputs: [
      "Evidence items with the source passage they came from",
      "Requirements flagged as unsupported or contradicted",
    ],
    operatingState:
      "Switchable per organisation. When off, applications wait for manual review.",
    controls: [
      "Switch on, pause or switch off",
      "Verify or reject each evidence item during review",
    ],
    approval:
      "Cannot reject a candidate, and cannot release evidence to a client without verification.",
    events: ["Who verified or rejected each item, and when"],
    representative: {
      status: "Needs attention",
      activity: "2 requirements on candidate A-1042 have no supporting evidence.",
    },
  },
  {
    id: "scoring",
    role: "Scoring Agent",
    kind: "agent",
    registryKeys: ["screening"],
    purpose:
      "Turns verified evidence into a 0–100 score under one fixed rubric version, deterministically.",
    inputs: ["Verified evidence set", "The frozen rubric version"],
    outputs: [
      "A score run tied to one exact candidate and one exact role",
      "A per-dimension breakdown with cited evidence",
    ],
    operatingState:
      "Always on once evidence is ready. Same inputs and engine version produce the same score.",
    controls: [
      "Hold a score back or return it in the review queue",
      "Rubric version is fixed for the run",
    ],
    approval:
      "No score reaches a client until an admin approves the release for that client and role.",
    events: [
      "Each score run with its engine version, rubric version and input hash",
    ],
    representative: {
      status: "Complete",
      activity: "Scored 8 candidates against rubric v3; 5 above the release threshold.",
    },
  },
  {
    id: "pipeline",
    role: "Pipeline Agent",
    kind: "agent",
    registryKeys: ["pipeline_watch"],
    purpose: def("pipeline_watch").job,
    inputs: def("pipeline_watch").inputs,
    outputs: def("pipeline_watch").outputs,
    operatingState:
      "Switchable per organisation. When off, stalled roles are only spotted manually.",
    controls: ["Switch on, pause or switch off", "Set the service commitments it watches"],
    approval:
      "Cannot move a candidate to another stage, and cannot chase your team without your say-so.",
    events: ["Each flag raised, and the task queued against it"],
    representative: {
      status: "Monitoring",
      activity: "Flagged 1 offer sitting 52 hours without a response.",
    },
  },
  {
    id: "coordination",
    role: "Coordination Agent",
    kind: "agent",
    registryKeys: ["outreach", "scheduling"],
    purpose:
      "Runs the approved contact sequence and offers interview slots from your availability.",
    inputs: [
      "Approved message templates and channel rules",
      "Opt-outs and existing replies",
      "Your availability windows",
    ],
    outputs: [
      "Sent messages logged per channel, with replies in one conversation",
      "Slot offers and confirmed interviews",
      "A blocked-with-reason record whenever a rule stops a contact",
    ],
    operatingState:
      "Switchable per organisation. When off, no messages leave the platform and sequences stay queued.",
    controls: [
      "Switch on, pause or switch off — pausing stops queued sends",
      "Approve message bodies and set channel windows",
      "Set availability windows",
    ],
    approval:
      "Cannot send an unapproved message body, contact anyone opted out or already in process, or book outside your availability.",
    events: [
      "Every send, reply and block with its reason",
      "Every confirmed or rescheduled interview",
    ],
    representative: {
      status: "Scheduled",
      activity: "4 slot offers queued for tomorrow; 1 contact blocked (opted out).",
    },
  },
  {
    id: "governance",
    role: "Governance Agent",
    kind: "automation",
    registryKeys: [],
    purpose:
      "Records every state change, override, release and access event, and enforces who can see what.",
    inputs: ["Actions taken by agents, staff and client users"],
    outputs: ["An append-only audit history per role, candidate and decision"],
    operatingState: "Always on. Cannot be switched off.",
    controls: ["Team roles and seat permissions", "Data visibility settings"],
    approval:
      "Candidate contact release is a separate permission from candidate visibility.",
    events: ["The audit trail itself — appended, never edited"],
    representative: {
      status: "Monitoring",
      activity: "Logged 46 events across 3 open roles in the last 7 days.",
    },
  },
];

/** How structured work passes between agents. */
export const HANDOFFS: readonly { from: string; payload: string; to: string }[] = [
  { from: "Intake Agent", payload: "Validated requisition", to: "Blueprint Agent" },
  { from: "Blueprint Agent", payload: "Frozen rubric version", to: "Talent Discovery Agent" },
  { from: "Talent Discovery Agent", payload: "Longlist entries", to: "Evidence Agent" },
  { from: "Evidence Agent", payload: "Verified evidence items", to: "Scoring Agent" },
  { from: "Scoring Agent", payload: "Approved score run", to: "Coordination Agent" },
  { from: "Coordination Agent", payload: "Interviews and replies", to: "Pipeline Agent" },
  { from: "Pipeline Agent", payload: "Outcomes and flags", to: "Governance Agent" },
];

/** Hard limits, taken from the registry's neverWithoutHuman lists. */
export const APPROVAL_LIMITS: readonly string[] = Array.from(
  new Set(AGENT_REGISTRY.flatMap((a) => a.neverWithoutHuman)),
);
