/**
 * Eligibility resolution.
 *
 * Rules (Prompt 4):
 *  - A confirmed hard disqualifier -> not_eligible, regardless of fit score.
 *  - An unknown hard qualifier -> needs_validation (NOT zero, NOT eligible).
 *  - An active exception on a failed check -> excepted (traceable via
 *    eligibility_exceptions).
 *  - If no qualifiers exist, eligibility resolves to eligible by default —
 *    absence of gates is not a blocker.
 */

import type {
  EligibilityStatus,
  QualifierCheckStatus,
  QualifierKind,
} from "./status-taxonomy";

export type EligibilityCheckInput = {
  qualifier_key: string;
  qualifier_kind: QualifierKind;
  status: QualifierCheckStatus;
  /** True when an eligibility_exception row is active and not expired/revoked. */
  has_active_exception?: boolean;
};

export type EligibilityResolution = {
  status: EligibilityStatus;
  blocking_checks: EligibilityCheckInput[]; // failed w/o exception
  unknown_checks: EligibilityCheckInput[];
  excepted_checks: EligibilityCheckInput[];
};

export function resolveEligibility(
  checks: EligibilityCheckInput[],
): EligibilityResolution {
  if (!checks || checks.length === 0) {
    return {
      status: "eligible",
      blocking_checks: [],
      unknown_checks: [],
      excepted_checks: [],
    };
  }

  const blocking: EligibilityCheckInput[] = [];
  const unknown: EligibilityCheckInput[] = [];
  const excepted: EligibilityCheckInput[] = [];

  for (const c of checks) {
    if (c.status === "excepted" || (c.status === "failed" && c.has_active_exception)) {
      excepted.push(c);
      continue;
    }
    if (c.status === "failed") {
      blocking.push(c);
      continue;
    }
    if (c.status === "unknown") {
      unknown.push(c);
      continue;
    }
  }

  let status: EligibilityStatus;
  if (blocking.length > 0) status = "not_eligible";
  else if (unknown.length > 0) status = "needs_validation";
  else if (excepted.length > 0 && blocking.length === 0 && unknown.length === 0)
    status = "excepted";
  else status = "eligible";

  return {
    status,
    blocking_checks: blocking,
    unknown_checks: unknown,
    excepted_checks: excepted,
  };
}
