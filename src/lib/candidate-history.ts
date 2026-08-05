/**
 * Candidate audit history — pure helpers.
 *
 * Every event on the candidate history timeline comes from a persisted row in
 * one of five tables. Nothing here derives, guesses or merges events: one row
 * in, one event out. The event id is `<source>:<row id>` so a permalink keeps
 * resolving after reload as long as the row exists.
 */

export const HISTORY_SOURCES = [
  "audit_event",
  "stage_history",
  "score_decision",
  "evidence_override",
  "client_decision",
] as const;

export type HistorySource = (typeof HISTORY_SOURCES)[number];

export const SOURCE_LABEL: Record<HistorySource, string> = {
  audit_event: "Audit event",
  stage_history: "Stage move",
  score_decision: "Score decision",
  evidence_override: "Evidence override",
  client_decision: "Client decision",
};

export const SOURCE_TABLE: Record<HistorySource, string> = {
  audit_event: "audit_events",
  stage_history: "candidate_stage_history",
  score_decision: "score_decisions",
  evidence_override: "evidence_overrides",
  client_decision: "client_decisions",
};

export type HistoryFieldChange = {
  field: string;
  before: string | null;
  after: string | null;
};

export type HistoryEvent = {
  /** `<source>:<row id>` — stable, used for permalinks. */
  id: string;
  source: HistorySource;
  /** ISO timestamp of the recorded row. */
  at: string;
  /** Action key as recorded (e.g. `match.approved`, `to_stage`). */
  action: string;
  /** Human label for the action. */
  action_label: string;
  actor_user_id: string | null;
  /** Resolved name, or null when the row records no actor (system/automated). */
  actor_name: string | null;
  actor_role: string | null;
  /** Reason / feedback text exactly as recorded. */
  reason: string | null;
  changes: HistoryFieldChange[];
  trace_id: string | null;
  /** Extra recorded context, already flattened to display strings. */
  context: HistoryFieldChange[];
};

export const HISTORY_PAGE_SIZE = 25;

/** Hard ceiling on rows pulled per source; keeps one candidate's read bounded. */
export const HISTORY_SOURCE_LIMIT = 300;

export function systemActorLabel(source: HistorySource): string {
  return source === "client_decision" ? "Client (unattributed)" : "System";
}

export function actorLabel(event: HistoryEvent): string {
  return event.actor_name ?? systemActorLabel(event.source);
}

/** Sort newest first; ties broken by id so ordering is deterministic. */
export function sortHistory(events: HistoryEvent[]): HistoryEvent[] {
  return [...events].sort((a, b) => {
    const delta = new Date(b.at).valueOf() - new Date(a.at).valueOf();
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

export type HistoryFilter = {
  actor: string; // "all" | actor_user_id | "system"
  action: string; // "all" | `${source}` | `${source}:${action}`
};

export function matchesFilter(event: HistoryEvent, filter: HistoryFilter): boolean {
  if (filter.actor !== "all") {
    if (filter.actor === "system") {
      if (event.actor_user_id) return false;
    } else if (event.actor_user_id !== filter.actor) {
      return false;
    }
  }
  if (filter.action !== "all") {
    const [source, action] = filter.action.split(":");
    if (event.source !== source) return false;
    if (action && event.action !== action) return false;
  }
  return true;
}

/** Distinct actors present in the timeline, for the filter control. */
export function actorOptions(events: HistoryEvent[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  let hasSystem = false;
  for (const e of events) {
    if (e.actor_user_id) seen.set(e.actor_user_id, actorLabel(e));
    else hasSystem = true;
  }
  const out = Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  if (hasSystem) out.push({ value: "system", label: "System / unattributed" });
  return out;
}

/** Distinct action types, grouped by source. */
export function actionOptions(events: HistoryEvent[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const e of events) {
    seen.set(`${e.source}:${e.action}`, `${SOURCE_LABEL[e.source]} · ${e.action_label}`);
  }
  return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function permalinkFor(candidateMatchId: string, eventId: string, origin: string): string {
  return `${origin}/admin/candidates/${candidateMatchId}?event=${encodeURIComponent(eventId)}`;
}
