/**
 * Agent Activity rail — pure layer.
 *
 * Rules held here, so the UI cannot break them:
 *  1. Every rail item corresponds to a record that already exists. Nothing in
 *     this file invents an event, a status or a result.
 *  2. An action is only ever offered when a real server function can carry it
 *     out for that item. `ACTION_BACKING` documents which one.
 *  3. Repetition is collapsed, not deleted: five evidence extractions on one
 *     role read as one line with a count, and the count is truthful.
 *  4. Nothing here formats internal machinery — no job ids, no trace ids, no
 *     model names, no raw error strings. Those stay server-side.
 */

export const RAIL_KINDS = [
  "blueprint_compiled",
  "blueprint_failed",
  "discovery_run",
  "candidates_identified",
  "evidence_extracted",
  "scores_updated",
  "approval_requested",
  "risk_detected",
  "candidate_moved",
  "message_prepared",
  "message_sent",
  "human_review_completed",
  "coordination",
  "market_check",
] as const;
export type RailKind = (typeof RAIL_KINDS)[number];

/** Plain-language status. Never a database enum, never a job state. */
export const RAIL_STATUSES = [
  "done",
  "in_progress",
  "needs_you",
  "blocked",
  "failed",
  "stopped",
] as const;
export type RailStatus = (typeof RAIL_STATUSES)[number];

export const RAIL_ACTIONS = [
  "review",
  "approve",
  "reject",
  "inspect_evidence",
  "retry",
  "pause",
  "open_candidate",
  "open_role",
] as const;
export type RailActionKey = (typeof RAIL_ACTIONS)[number];

/**
 * The server function that actually performs each action. If an action is not
 * in this map it must not appear in the rail.
 */
export const ACTION_BACKING: Record<RailActionKey, string> = {
  review: "navigation to the surface that owns the decision",
  approve: "clientAction({ action: 'shortlist' })",
  reject: "clientAction({ action: 'not_moving_forward', reasonCode })",
  inspect_evidence: "navigation to the candidate evidence view",
  retry: "retryBlueprintAnalysis({ positionId })",
  pause: "setAgentPaused({ agent_key, paused: true })",
  open_candidate: "navigation to the candidate record",
  open_role: "navigation to the role record",
};

export const KIND_LABEL: Record<RailKind, string> = {
  blueprint_compiled: "Role blueprint compiled",
  blueprint_failed: "Role blueprint could not be compiled",
  discovery_run: "Talent discovery run",
  candidates_identified: "Candidates identified",
  evidence_extracted: "Evidence extracted",
  scores_updated: "Candidate assessment updated",
  approval_requested: "Approval requested",
  risk_detected: "Pipeline risk detected",
  candidate_moved: "Candidate moved",
  message_prepared: "Message prepared",
  message_sent: "Message sent",
  human_review_completed: "Human review completed",
  coordination: "Interview coordination",
  market_check: "Market check",
};

export const STATUS_LABEL: Record<RailStatus, string> = {
  done: "Done",
  in_progress: "Running",
  needs_you: "Needs you",
  blocked: "Waiting on us",
  failed: "Failed",
  stopped: "Stopped",
};

/** Statuses that mean a person has to do something. */
export const ATTENTION_STATUSES: readonly RailStatus[] = [
  "needs_you",
  "blocked",
  "failed",
];

export type RailActor = {
  /** Agent registry key, or a system source key. Never a user id. */
  key: string;
  name: string;
  kind: "agent" | "system" | "person";
};

export type RailRoleRef = { id: string; title: string };

export type RailCandidateRef = {
  match_id: string;
  /**
   * The candidate's name when this workspace is allowed to see this candidate,
   * otherwise a neutral placeholder. Identity is never inferred client-side.
   */
  label: string;
  identified: boolean;
  /**
   * Whether "Not yet released" is a meaningful state for this event.
   * False for messages, role updates, etc. where release status doesn't apply.
   */
  releaseMeaningful: boolean;
  /**
   * True when the event itself IS the release (e.g. candidate_published,
   * contact_released). In that case the "Not yet released" tag must be
   * suppressed because the item already describes the completed release.
   */
  isReleaseEvent?: boolean;
};


export type RailItem = {
  id: string;
  kind: RailKind;
  /** What happened, in one line, written for the reader. */
  action: string;
  /** What came out of it, or why nothing did. */
  result: string;
  status: RailStatus;
  actor: RailActor;
  role: RailRoleRef | null;
  candidate: RailCandidateRef | null;
  occurred_at: string;
  /** How many identical events this line stands for. Always >= 1. */
  count: number;
  /** Only actions with a real backend effect for this caller. */
  actions: RailActionKey[];
};

export type RailGroup = {
  key: string;
  role: RailRoleRef | null;
  /** e.g. "Senior Nurse" or "Not tied to one role". */
  heading: string;
  items: RailItem[];
  attention_count: number;
  latest_at: string;
};

export type RailPermission = {
  /** Can read the rail at all (active membership or platform staff). */
  can_read: boolean;
  /** Can approve, decline and retry (editor or admin seat). */
  can_decide: boolean;
  /** Can pause an agent (workspace admin or platform staff). */
  can_manage_agents: boolean;
};

export type AgentRail = {
  organization_id: string;
  permission: RailPermission;
  groups: RailGroup[];
  /** Every role that appears, for the role filter. */
  roles: RailRoleRef[];
  /** Every actor that appears, for the agent filter. */
  actors: RailActor[];
  attention_total: number;
  window_days: number;
  fetched_at: string;
};

export const SYSTEM_ACTORS: Record<string, RailActor> = {
  blueprint: { key: "blueprint", name: "Blueprint Compiler", kind: "system" },
  evidence: { key: "evidence", name: "Evidence Engine", kind: "system" },
  scoring: { key: "scoring", name: "Scoring Engine", kind: "system" },
  delivery: { key: "delivery", name: "Delivery", kind: "system" },
  pipeline: { key: "pipeline", name: "Pipeline", kind: "system" },
  review: { key: "review", name: "TaaSFlow review team", kind: "person" },
  messaging: { key: "messaging", name: "Messaging", kind: "system" },
};

/** agent_activity.outcome is the only source of an agent item's status. */
export function statusFromOutcome(
  outcome: "acted" | "blocked" | "skipped" | "failed" | string,
): RailStatus {
  switch (outcome) {
    case "acted":
      return "done";
    case "blocked":
      return "blocked";
    case "skipped":
      return "stopped";
    case "failed":
      return "failed";
    default:
      return "done";
  }
}

/** Which rail kind an agent's recorded action belongs to. */
export function kindFromAgentKey(agentKey: string): RailKind {
  switch (agentKey) {
    case "sourcing":
      return "discovery_run";
    case "screening":
      return "evidence_extracted";
    case "outreach":
      return "message_prepared";
    case "scheduling":
      return "coordination";
    case "market_research":
      return "market_check";
    case "pipeline_watch":
      return "risk_detected";
    default:
      return "discovery_run";
  }
}

export function needsAttention(item: RailItem): boolean {
  return ATTENTION_STATUSES.includes(item.status);
}

/**
 * Collapse repetition so the rail reads as a record of work, not a raw log.
 * Two items merge only when they are the same kind, same actor, same status,
 * same role and same candidate, and fall inside the same time bucket.
 */
export const COLLAPSE_WINDOW_MS = 6 * 60 * 60 * 1000;

export function collapseItems(
  items: readonly RailItem[],
  windowMs = COLLAPSE_WINDOW_MS,
): RailItem[] {
  const sorted = [...items].sort((a, b) =>
    a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0,
  );
  const out: RailItem[] = [];
  for (const item of sorted) {
    const bucketKey = [
      item.kind,
      item.actor.key,
      item.status,
      item.role?.id ?? "-",
      item.candidate?.match_id ?? "-",
    ].join("|");
    const open = out.find((o) => {
      const oKey = [
        o.kind,
        o.actor.key,
        o.status,
        o.role?.id ?? "-",
        o.candidate?.match_id ?? "-",
      ].join("|");
      if (oKey !== bucketKey) return false;
      return (
        new Date(o.occurred_at).getTime() - new Date(item.occurred_at).getTime() <
        windowMs
      );
    });
    // Never merge anything a person has to act on — each one keeps its own row
    // and its own buttons.
    if (open && !needsAttention(item)) {
      open.count += item.count;
      continue;
    }
    out.push({ ...item });
  }
  return out;
}

/** Group by role, most recently active role first, attention roles ahead. */
export function groupItems(items: readonly RailItem[]): RailGroup[] {
  const map = new Map<string, RailGroup>();
  for (const item of items) {
    const key = item.role?.id ?? "unassigned";
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        role: item.role,
        heading: item.role?.title ?? "Not tied to one role",
        items: [],
        attention_count: 0,
        latest_at: item.occurred_at,
      };
      map.set(key, group);
    }
    group.items.push(item);
    if (needsAttention(item)) group.attention_count += 1;
    if (item.occurred_at > group.latest_at) group.latest_at = item.occurred_at;
  }
  return [...map.values()].sort((a, b) => {
    if (!!a.attention_count !== !!b.attention_count) {
      return a.attention_count ? -1 : 1;
    }
    return a.latest_at < b.latest_at ? 1 : -1;
  });
}

export type RailFilters = {
  roleId: string | "all";
  actorKey: string | "all";
  status: RailStatus | "all";
  attentionOnly: boolean;
};

export const EMPTY_FILTERS: RailFilters = {
  roleId: "all",
  actorKey: "all",
  status: "all",
  attentionOnly: false,
};

export function filterGroups(
  groups: readonly RailGroup[],
  filters: RailFilters,
): RailGroup[] {
  const out: RailGroup[] = [];
  for (const group of groups) {
    if (filters.roleId !== "all" && (group.role?.id ?? "unassigned") !== filters.roleId) {
      continue;
    }
    const items = group.items.filter((item) => {
      if (filters.actorKey !== "all" && item.actor.key !== filters.actorKey) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.attentionOnly && !needsAttention(item)) return false;
      return true;
    });
    if (items.length === 0) continue;
    out.push({
      ...group,
      items,
      attention_count: items.filter(needsAttention).length,
    });
  }
  return out;
}

export function relTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function absTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
