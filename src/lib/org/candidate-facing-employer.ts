/**
 * The employer name a candidate may see for a role.
 *
 * A confidential posting (positions.intake_context.posting.confidentiality =
 * 'confidential') hides the client from candidates. The job board, the job
 * page and the closed-role page already print "Confidential employer" through
 * the public_position_* definer functions; every surface a candidate reaches
 * after applying (emails, the receipt and status pages, the candidate portal)
 * reads the name through this helper, so the rule still holds once someone
 * has applied.
 *
 * Callers select only the one value, never the rest of intake_context (which
 * also carries internal hiring notes):
 *   positions( …, posting_confidentiality:intake_context->posting->>confidentiality )
 *
 * Client and admin surfaces keep the real name and do not call this.
 */
import { publicOrgName } from "./public-org-name";

export const CONFIDENTIAL_EMPLOYER_NAME = "Confidential employer";

/** True for the posting.confidentiality value that hides the employer. */
export function isConfidentialPosting(confidentiality: unknown): boolean {
  return (
    typeof confidentiality === "string" && confidentiality.trim().toLowerCase() === "confidential"
  );
}

/**
 * "Confidential employer" for a confidential posting; otherwise the
 * organisation's public name (internal "(Demo)"-style markers stripped), or
 * null when there is no usable name.
 */
export function candidateFacingEmployerName(
  orgName: string | null | undefined,
  confidentiality: unknown,
): string | null {
  if (isConfidentialPosting(confidentiality)) return CONFIDENTIAL_EMPLOYER_NAME;
  return publicOrgName(orgName) || null;
}
