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

export type ExecResult = {
  plan_id: string;
  attempted: number;
  succeeded: number;
  failed: number;
  results: Array<{ id: string; label: string; ok: boolean; error?: string }>;
};
