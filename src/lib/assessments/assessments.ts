/**
 * Psychometric assessments — the shared vocabulary.
 *
 * An assessment is a PARALLEL signal. It is shown beside the Fit score, never
 * inside it: it does not enter the 0–100 composite, does not change the band,
 * does not gate publishing, and is never rendered as a pass/fail decision. The
 * evidence in §5 of the 15 Sep audit is that assessments add signal on top of a
 * structured CV-and-screening score rather than replacing it, and the legal
 * exposure of letting one drive a rejection (Title VII, NYC LL144, GDPR Art.
 * 22) is the reason a person always reviews a result before an employer sees
 * it.
 *
 * Pure module: no browser globals, no server imports, nothing from the scoring
 * engine. If this file ever needs to import from `@/lib/scoring/*`, the design
 * has gone wrong.
 */

/** Where an invitation has got to. */
export const ASSESSMENT_STATUSES = [
  "pending",
  "sent",
  "started",
  "completed",
  "expired",
  "declined",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  pending: "Not invited yet",
  sent: "Invitation sent",
  started: "Started",
  completed: "Completed",
  expired: "Expired",
  declined: "Declined",
};

/**
 * Vendors on the approved list. Each publishes validation and bias-audit
 * material, which is what makes an assessment defensible; an instrument
 * without that documentation does not belong here.
 */
export const ASSESSMENT_VENDORS = [
  { value: "criteria_corp", label: "Criteria Corp" },
  { value: "testgorilla", label: "TestGorilla" },
] as const;
export type AssessmentVendor = (typeof ASSESSMENT_VENDORS)[number]["value"];

export const ASSESSMENT_CONSENT_VERSION = "2026-09-15";

/**
 * What the candidate is asked, verbatim.
 *
 * Says what it is for, that a person reviews it, that it cannot reject them on
 * its own, and that an adjustment can be requested. Final wording is subject
 * to legal review (§5.6) — this is the draft the flow ships with, and changing
 * it should bump ASSESSMENT_CONSENT_VERSION so existing records stay
 * attributable to the text that was actually shown.
 */
export function assessmentConsentText(args: {
  roleTitle: string;
  minutes?: number;
}): string {
  const mins = args.minutes && args.minutes > 0 ? `about ${args.minutes} minutes` : "a short time";
  return (
    `This employer has asked you to complete a short assessment (${mins}) as part of hiring ` +
    `for ${args.roleTitle}. Your results are shared with the employer and a person always ` +
    `reviews them — they are never used to automatically reject you. You can request an ` +
    `adjustment, for example extra time or a screen-reader-compatible version.`
  );
}

/** One assessment result, as any surface reads it. */
export type AssessmentResultView = {
  band: string | null;
  percentile: number | null;
  vendorReportUrl: string | null;
  reviewed: boolean;
};

/**
 * The plain-language line shown beside a result.
 *
 * Deliberately not a verdict. The audit's risk register puts "assessment
 * result read as a decision" alongside contaminating the score, so the copy
 * frames it as something to discuss rather than something to act on.
 */
export function assessmentInterpretation(result: AssessmentResultView): string {
  if (!result.reviewed) return "Not released yet — a reviewer is looking at this.";
  if (!result.band) return "Completed. No band was returned for this instrument.";
  const pct =
    typeof result.percentile === "number" && Number.isFinite(result.percentile)
      ? ` (${Math.round(result.percentile)}th percentile)`
      : "";
  return (
    `Assessment band ${result.band}${pct}. An additional signal to discuss in interview — ` +
    `it does not form part of the Fit score.`
  );
}

/**
 * True when this organisation may see anything about assessments at all.
 *
 * Every assessment surface asks this first. With the flag off nothing renders,
 * no endpoint does work, and the product is the product that exists today.
 */
export function assessmentsEnabled(org: { assessments_enabled?: boolean | null } | null | undefined): boolean {
  return org?.assessments_enabled === true;
}

/**
 * A result is the client's to see only after a person has released it.
 *
 * The database enforces this too (see the RLS policy on assessment_results);
 * this is the same rule stated where the UI can read it, so a surface cannot
 * render something the policy would have refused.
 */
export function clientMaySeeResult(result: { reviewed_by?: string | null } | null | undefined): boolean {
  return Boolean(result?.reviewed_by);
}
