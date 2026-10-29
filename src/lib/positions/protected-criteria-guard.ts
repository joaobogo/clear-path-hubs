/**
 * Server-side refusals for hiring criteria that state a protected attribute.
 *
 * Each save path calls one of these before it writes anything. They throw (or
 * return a refusal body) with every finding and its suggested rewrite; they
 * never rewrite the text themselves.
 */
import {
  PROTECTED_CRITERIA_ERROR_PREFIX,
  protectedCriteriaErrorMessage,
  findProtectedCriteriaInFields,
  type CriteriaFieldFinding,
} from "@/lib/scoring/protected-attributes";
import {
  intakeCriteriaFields,
  roleFormCriteriaFields,
  storedPositionProtectedCriteria,
  type IntakeCriteriaInput,
  type RoleFormCriteriaInput,
  type StoredPositionCriteria,
} from "./protected-criteria-fields";

export type ProtectedCriteriaRefusal = {
  error: "protected_criteria";
  message: string;
  findings: Array<{
    field: string;
    index: number | null;
    label: string;
    text: string;
    replacement: string;
    reasons: string[];
  }>;
};

function refusal(found: CriteriaFieldFinding[]): ProtectedCriteriaRefusal {
  return {
    error: "protected_criteria",
    message: protectedCriteriaErrorMessage(found).slice(PROTECTED_CRITERIA_ERROR_PREFIX.length),
    findings: found.map((f) => ({
      field: f.field,
      index: f.index ?? null,
      label: f.label,
      text: f.text,
      replacement: f.replacement,
      reasons: [...new Set(f.findings.map((x) => x.message))],
    })),
  };
}

/** Client intake: null when the brief is clean, otherwise the 400 body. */
export function intakeProtectedCriteriaResponse(
  data: IntakeCriteriaInput & { roleTitle?: string | null },
): ProtectedCriteriaRefusal | null {
  const found = findProtectedCriteriaInFields(intakeCriteriaFields(data), { roleTitle: data.roleTitle });
  return found.length > 0 ? refusal(found) : null;
}

/** Role editor save: throws with every finding and its suggested wording. */
export function assertRoleFormCriteriaAllowed(data: RoleFormCriteriaInput & { title?: string | null }): void {
  const found = findProtectedCriteriaInFields(roleFormCriteriaFields(data), { roleTitle: data.title });
  if (found.length > 0) throw new Error(protectedCriteriaErrorMessage(found));
}

/** Publish: the stored criteria, read the same way. */
export function storedCriteriaPublishDetail(
  p: StoredPositionCriteria & { title?: string | null },
): string | null {
  const found = storedPositionProtectedCriteria(p);
  return found.length > 0 ? protectedCriteriaErrorMessage(found).slice(PROTECTED_CRITERIA_ERROR_PREFIX.length) : null;
}
