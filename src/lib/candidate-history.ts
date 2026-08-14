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

/**
 * Repairs one raw timeline entry so a single malformed row can never crash the
 * record page. Returns null only when the entry is not an object at all.
 * `malformed` is set when required fields were missing, so the UI can flag the
 * entry instead of silently hiding recorded history.
 */
export function normalizeHistoryEvent(
  raw: unknown,
  index = 0,
): (HistoryEvent & { malformed: boolean }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<HistoryEvent> & Record<string, unknown>;
  const known = HISTORY_SOURCES.includes(r.source as HistorySource);
  const source = (known ? r.source : "audit_event") as HistorySource;
  const action = typeof r.action === "string" && r.action ? r.action : "";
  const malformed = !r.id || !action || !known;
  return {
    id: typeof r.id === "string" && r.id ? r.id : `unknown:${index}`,
    source,
    at: typeof r.at === "string" ? r.at : "",
    action: action || "unknown",
    action_label:
      typeof r.action_label === "string" && r.action_label
        ? r.action_label
        : action || "Unrecognised entry",
    actor_user_id: (r.actor_user_id as string | null) ?? null,
    actor_name: (r.actor_name as string | null) ?? null,
    actor_role: (r.actor_role as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    changes: Array.isArray(r.changes) ? (r.changes as HistoryFieldChange[]) : [],
    trace_id: (r.trace_id as string | null) ?? null,
    context: Array.isArray(r.context) ? (r.context as HistoryFieldChange[]) : [],
    malformed,
  };
}

/** Repairs a whole timeline payload; unusable entries are dropped. */
export function normalizeHistoryEvents(
  raw: unknown,
): Array<HistoryEvent & { malformed: boolean }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e, i) => normalizeHistoryEvent(e, i))
    .filter((e): e is HistoryEvent & { malformed: boolean } => e !== null);
}

/** Trims the `?event=` permalink param; empty/blank means "no focus". */
export function normalizeFocusEventId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function matchesFilter(
  event: HistoryEvent | undefined | null,
  filter: Partial<HistoryFilter> | undefined | null,
): boolean {
  if (!event) return false;
  const actorFilter = filter?.actor ?? "all";
  const actionFilter = filter?.action ?? "all";
  if (actorFilter !== "all") {
    if (actorFilter === "system") {
      if (event.actor_user_id) return false;
    } else if (event.actor_user_id !== actorFilter) {
      return false;
    }
  }
  if (actionFilter !== "all") {
    const [source, action] = actionFilter.split(":");
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
