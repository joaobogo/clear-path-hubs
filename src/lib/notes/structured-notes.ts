// Structured recruiter notes — shared shape used by admin note panels.
// Note type is mandatory. Client-shareable notes are the only ones eligible to
// feed a client update draft; everything else stays staff-internal.

export const NOTE_TYPES = [
  { value: "screening", label: "Screening" },
  { value: "client_feedback", label: "Client feedback" },
  { value: "risk", label: "Risk" },
  { value: "logistics", label: "Logistics" },
] as const;

export type NoteType = (typeof NOTE_TYPES)[number]["value"];

export const NOTE_TYPE_VALUES = NOTE_TYPES.map((t) => t.value) as NoteType[];

export function noteTypeLabel(value: string): string {
  return NOTE_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Edits land in place inside this window; after it, a new revision is written. */
export const NOTE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export type NoteTargetKind = "candidate_match" | "position";

export type StructuredNote = {
  id: string;
  source: "candidate_notes" | "internal_notes";
  body: string;
  note_type: NoteType;
  client_shareable: boolean;
  author_user_id: string | null;
  author_name: string;
  is_mine: boolean;
  created_at: string;
  edited_at: string | null;
  revision_group_id: string;
  revision_number: number;
  /** True while the author can still edit in place (own note, inside window). */
  editable: boolean;
};

export function withinEditWindow(createdAt: string, now = Date.now()): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t <= NOTE_EDIT_WINDOW_MS;
}
