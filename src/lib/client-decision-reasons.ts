// Browser-safe catalogue of structured reasons for client decisions.
// Used by both the client UI and the server validator so a recorded decision
// always carries a meaning admins can act on.

// ─── Rejection / decline vocabulary ─────────────────────────────────────────
// One catalogue, shared by the client decline dialog and every admin reject
// action, so reason counts across surfaces are comparable. `surfaces` says
// where a code may be picked; the labels never diverge between surfaces.
export const REJECTION_REASONS = [
  { code: "experience_depth", label: "Not enough depth in the core experience", surfaces: ["admin"] },
  { code: "missing_critical", label: "Missing a must-have", surfaces: ["client", "admin"] },
  { code: "seniority_mismatch", label: "Seniority level does not match the role", surfaces: ["admin"] },
  { code: "too_junior", label: "Too junior for the role", surfaces: ["client", "admin"] },
  { code: "too_senior", label: "Too senior for the role", surfaces: ["client", "admin"] },
  { code: "compensation", label: "Compensation mismatch", surfaces: ["client", "admin"] },
  { code: "location_or_work_setup", label: "Location or work authorisation", surfaces: ["client", "admin"] },
  { code: "availability", label: "Timing does not work", surfaces: ["client", "admin"] },
  { code: "language", label: "Language requirements not met", surfaces: ["client", "admin"] },
  { code: "role_filled_or_paused", label: "Role is filled, paused, or changed", surfaces: ["client", "admin"] },
  { code: "evidence_insufficient", label: "Evidence in the CV does not support the claims", surfaces: ["admin"] },
  { code: "eligibility_failed", label: "Fails an eligibility requirement", surfaces: ["admin"] },
  { code: "duplicate_application", label: "Duplicate of another application", surfaces: ["admin"] },
  { code: "candidate_withdrew", label: "Candidate withdrew or lost interest", surfaces: ["admin"] },
  { code: "candidate_unreachable", label: "Candidate unreachable after follow-up", surfaces: ["admin"] },
  { code: "other", label: "Other (explain below)", surfaces: ["client", "admin"] },
] as const;

export type RejectionSurface = "client" | "admin";

export function rejectionReasonsFor(
  surface: RejectionSurface,
): Array<{ code: string; label: string }> {
  return REJECTION_REASONS.filter((r) =>
    (r.surfaces as readonly string[]).includes(surface),
  ).map((r) => ({ code: r.code, label: r.label }));
}

export const REJECTION_REASON_CODES: string[] = REJECTION_REASONS.map((r) => r.code);

/**
 * Client-facing "Not a fit" list — fixed, short, and ordered the way clients
 * think. These codes drive the recruiting team's next search, so the list stays
 * closed: no free-text-only rejections.
 */
export const DECLINE_REASONS = rejectionReasonsFor("client");
export const NOT_A_FIT_REASONS = DECLINE_REASONS;

/** Note limits shared by the client decision UI and the server validator. */
export const DECISION_NOTE_MAX = 500;
export const OTHER_NOTE_MIN = 10;

/**
 * One validator for the whole decision bar, used on both sides of the wire.
 * Returns a human message when the decision may not be submitted yet.
 */
export function decisionReasonError(input: {
  reasonRequired: boolean;
  reasonCode?: string | null;
  note?: string | null;
}): string | null {
  const note = (input.note ?? "").trim();
  if (input.reasonRequired && !input.reasonCode) return "Pick a reason so we can act on it.";
  if (input.reasonCode === "other" && note.length < OTHER_NOTE_MIN)
    return `Add at least ${OTHER_NOTE_MIN} characters explaining why.`;
  if (note.length > DECISION_NOTE_MAX)
    return `Keep the note under ${DECISION_NOTE_MAX} characters.`;
  return null;
}

/** Admin-facing reject list (subset of the shared catalogue). */
export const ADMIN_REJECTION_REASONS = rejectionReasonsFor("admin");

export const HOLD_REASONS = [
  { code: "awaiting_internal_review", label: "Awaiting internal review" },
  { code: "comparing_candidates", label: "Comparing against other candidates" },
  { code: "role_on_pause", label: "Role is temporarily on pause" },
  { code: "budget_pending", label: "Budget or approval pending" },
  { code: "other", label: "Other (explain below)" },
] as const;

export const INFO_REQUEST_TOPICS = [
  { code: "work_history", label: "Clarify work history or dates" },
  { code: "specific_skill", label: "Evidence for a specific skill" },
  { code: "availability", label: "Notice period and availability" },
  { code: "compensation", label: "Compensation expectations" },
  { code: "work_authorisation", label: "Work authorisation or relocation" },
  { code: "language", label: "Language proficiency" },
  { code: "other", label: "Something else" },
] as const;

export const REASON_CODES = [
  ...REJECTION_REASON_CODES,
  ...HOLD_REASONS.map((r) => r.code),
  ...INFO_REQUEST_TOPICS.map((r) => r.code),
] as string[];

export const FEEDBACK_SIGNALS = [
  { code: "strong_evidence", label: "Strong, well-evidenced experience" },
  { code: "good_communication", label: "Clear communicator" },
  { code: "domain_fit", label: "Good industry or domain fit" },
  { code: "needs_validation", label: "Some claims need validating" },
  { code: "concern_stability", label: "Concern about tenure or stability" },
  { code: "concern_fit", label: "Concern about team or role fit" },
] as const;

export function reasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const all = [
    ...REJECTION_REASONS.map((r) => ({ code: r.code as string, label: r.label as string })),
    ...HOLD_REASONS,
    ...INFO_REQUEST_TOPICS,
  ];
  return all.find((r) => r.code === code)?.label ?? code;
}
