// Client-safe types shared by the bulk-action UI and the server engine.
export type FieldChange = { field: string; from: string; to: string };

export type PlanRow = {
  id: string;
  label: string;
  context: string;
  eligible: boolean;
  reason?: string;
  changes: FieldChange[];
};

export const BULK_KINDS = [
  "candidate_stage",
  "candidate_assign",
  "candidate_update_message",
  "position_pause",
] as const;
export type BulkKind = (typeof BULK_KINDS)[number];

export type BulkPreview = {
  plan_id: string;
  kind: BulkKind;
  summary: string;
  selected: number;
  eligible: number;
  skipped: number;
  rows: PlanRow[];
};

export type ExecItemResult = { id: string; label: string; ok: boolean; error?: string };

/**
 * One batch of a bulk execution. `cursor`/`next_cursor` are positions in the
 * plan's ordered eligible rows, so a run is resumable: hand `next_cursor` back
 * to continue, or re-send the same `cursor` to retry a batch that failed
 * outright (a transport error, a timeout) without redoing committed work.
 */
export type ExecResult = {
  plan_id: string;
  /** Where this batch started. */
  cursor: number;
  /** Where the next batch should start, or null when the run is complete. */
  next_cursor: number | null;
  /** Total eligible rows targeted by this run. */
  total: number;
  /** Rows completed so far across every batch of this run. */
  processed: number;
  done: boolean;
  /** Counts for this batch. */
  attempted: number;
  succeeded: number;
  failed: number;
  results: ExecItemResult[];
  /** Every failure recorded so far in this run, across batches. */
  failures_so_far: ExecItemResult[];
};

/** Rows per execute call, and the explicit ceiling on one bulk selection. */
export const BULK_EXEC_BATCH = 50;
export const BULK_SELECTION_CAP = 2000;
