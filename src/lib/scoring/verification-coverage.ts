/**
 * Verification coverage — Finding 18.
 *
 * A fit score is built from evidence items, each carrying a `reviewer_status`
 * (`pending` | `accepted` | `edited` | `rejected`, or absent/null for rows the
 * pipeline has not touched at all). This module answers one question in plain
 * language: how much of the evidence behind a shown score has a human actually
 * looked at?
 *
 * We never invent verification: a null/undefined status is "none", not
 * "pending" and not "accepted".
 */

export type ReviewerStatus = "pending" | "accepted" | "rejected" | "edited";

export type VerifiableItem = {
  reviewer_status?: ReviewerStatus | string | null;
};

export type VerificationCoverage = {
  total: number;
  /** Human has looked at it and recorded a verdict: accepted, edited or rejected. */
  verified: number;
  accepted: number;
  edited: number;
  rejected: number;
  /** Queued for review but no verdict yet. */
  pending: number;
  /** No reviewer_status at all — never entered the review workflow. */
  none: number;
  /** 0..1, 0 when there is no evidence. */
  verifiedShare: number;
  /** Plain-language line, safe to show to staff or a client. */
  line: string;
};

export function computeVerificationCoverage(
  items: readonly VerifiableItem[] | null | undefined,
): VerificationCoverage {
  const rows = items ?? [];
  let accepted = 0;
  let edited = 0;
  let rejected = 0;
  let pending = 0;
  let none = 0;

  for (const row of rows) {
    const status = row?.reviewer_status;
    switch (status) {
      case "accepted":
        accepted += 1;
        break;
      case "edited":
        edited += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "pending":
        pending += 1;
        break;
      default:
        // null, undefined, or any unrecognised value — no verification claim.
        none += 1;
    }
  }

  const total = rows.length;
  const verified = accepted + edited + rejected;
  const verifiedShare = total > 0 ? verified / total : 0;

  const line =
    total === 0
      ? "No evidence recorded for this score."
      : `${verified} of ${total} evidence item${total === 1 ? "" : "s"} reviewed by a person`;

  return { total, verified, accepted, edited, rejected, pending, none, verifiedShare, line };
}
