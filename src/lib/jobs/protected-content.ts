/**
 * Role-level protected-attribute check (B1). One function every outbound path
 * calls — publish, job board, JSON-LD, ad outreach — so a role whose text
 * screens on nationality, age, gender etc. never leaves the building.
 */
import { findProtectedInFields, type FieldFinding } from "@/lib/scoring/protected-attributes";

export type RoleText = {
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
  description?: string | null;
  jd_text?: string | null;
  intake_context?: unknown;
  screening_questions?: Array<{ question?: string | null }> | null;
};

const FIELD_LABEL: Record<string, string> = {
  requirements: "Must-haves",
  preferred_requirements: "Nice-to-haves",
  dealbreakers: "Dealbreakers",
  description: "Description",
  jd_text: "Job description",
  posting: "Job posting",
  screening_questions: "Screening questions",
};

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : [];
}

export function roleProtectedFindings(role: RoleText): FieldFinding[] {
  const ctx = role.intake_context && typeof role.intake_context === "object" ? (role.intake_context as Record<string, unknown>) : {};
  return findProtectedInFields({
    requirements: arr(role.requirements),
    preferred_requirements: arr(role.preferred_requirements),
    dealbreakers: arr(role.dealbreakers),
    description: role.description ?? "",
    jd_text: role.jd_text ?? "",
    posting: typeof ctx.posting === "string" ? ctx.posting : "",
    screening_questions: (role.screening_questions ?? []).map((q) => q.question ?? ""),
  });
}

export function roleFailsProtectedCheck(role: RoleText): boolean {
  return roleProtectedFindings(role).length > 0;
}

/** One plain-English sentence for an error toast / inline message. */
export function protectedFindingsMessage(findings: FieldFinding[]): string {
  if (findings.length === 0) return "";
  const f = findings[0];
  const label = FIELD_LABEL[f.field] ?? "This field";
  const more = findings.length > 1 ? ` (${findings.length - 1} more to fix)` : "";
  return `${label}: "${f.text.slice(0, 90)}" — ${f.findings[0].message}${more}`;
}
