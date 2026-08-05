// Browser-safe catalogue of structured reasons for client decisions.
// Used by both the client UI and the server validator so a recorded decision
// always carries a meaning admins can act on.

// ─── Rejection / decline vocabulary ─────────────────────────────────────────
// One catalogue, shared by the client decline dialog and every admin reject
// action, so reason counts across surfaces are comparable. `surfaces` says
// where a code may be picked; the labels never diverge between surfaces.
export const REJECTION_REASONS = [
  { code: "experience_depth", label: "Not enough depth in the core experience", surfaces: ["client", "admin"] },
  { code: "missing_critical", label: "Missing a critical requirement", surfaces: ["client", "admin"] },
  { code: "seniority_mismatch", label: "Seniority level does not match the role", surfaces: ["client", "admin"] },
  { code: "compensation", label: "Compensation expectations do not align", surfaces: ["client", "admin"] },
  { code: "location_or_work_setup", label: "Location or work setup does not work", surfaces: ["client", "admin"] },
  { code: "availability", label: "Availability does not fit our timeline", surfaces: ["client", "admin"] },
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

/** Client-facing decline list (subset of the shared catalogue). */
export const DECLINE_REASONS = rejectionReasonsFor("client");

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
  ...DECLINE_REASONS.map((r) => r.code),
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
  const all = [...DECLINE_REASONS, ...HOLD_REASONS, ...INFO_REQUEST_TOPICS];
  return all.find((r) => r.code === code)?.label ?? code;
}
