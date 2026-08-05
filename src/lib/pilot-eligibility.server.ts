/**
 * Pilot eligibility — enforcement.
 *
 * A pilot claim is recorded against the company itself (normalized name,
 * corporate website host, work-email domain), not against the account. That is
 * what makes "sign up again with a new email" fail: the second attempt matches
 * the first company fingerprint and is refused, and platform staff are told.
 */

import {
  blockReasonLine,
  pilotFingerprint,
  type PilotBlockReason,
  type PilotEligibility,
  type PilotFingerprint,
} from "@/lib/pilot-eligibility";

/** Loosely typed service-role client — the callers already hold a real one. */
type Admin = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
};

type ClaimRow = {
  id: string;
  organization_id: string | null;
  company_name: string;
  company_name_normalized: string;
  company_domain: string | null;
  email_domain: string | null;
  status: string;
  blocked: boolean;
  exception_granted: boolean;
  created_at: string;
};

/**
 * Find an earlier pilot claim for the same company.
 *
 * Matching order is strongest-signal first so the reason we show staff is the
 * one that actually fired. Refused attempts (blocked) and voided claims never
 * count as "the pilot was used".
 */
async function findPriorClaim(
  admin: Admin,
  fp: PilotFingerprint,
  opts: { excludeOrganizationId?: string | null } = {},
): Promise<{ claim: ClaimRow; reason: PilotBlockReason } | null> {
  const attempts: { reason: PilotBlockReason; column: string; value: string | null }[] = [
    { reason: "same_company_domain", column: "company_domain", value: fp.companyDomain },
    { reason: "same_contact_domain", column: "email_domain", value: fp.emailDomain },
    {
      reason: "same_company_name",
      column: "company_name_normalized",
      value: fp.companyNameNormalized || null,
    },
  ];

  for (const attempt of attempts) {
    if (!attempt.value) continue;
    let q = admin
      .from("pilot_claims")
      .select(
        "id, organization_id, company_name, company_name_normalized, company_domain, email_domain, status, blocked, exception_granted, created_at",
      )
      .eq(attempt.column, attempt.value)
      .eq("blocked", false)
      .neq("status", "void")
      .order("created_at", { ascending: true })
      .limit(1);
    if (opts.excludeOrganizationId) q = q.neq("organization_id", opts.excludeOrganizationId);
    const { data } = await q.maybeSingle();
    if (data) return { claim: data as ClaimRow, reason: attempt.reason };
  }
  return null;
}

export type PilotDecision = PilotEligibility & {
  /** The claim row written for this attempt — granted or refused, always recorded. */
  claimId: string | null;
  /** Plain line for staff and for the audit trail. */
  line: string;
};

/**
 * Decide whether this intake may use the introductory pilot, record the
 * decision, and warn platform staff when a repeat attempt is refused.
 *
 * Never throws: a company that is not eligible still gets its workspace, role
 * and blueprint — it simply does not get a second pilot.
 */
export async function claimPilot(
  admin: Admin,
  input: {
    companyName: string;
    companyWebsite?: string | null;
    workEmail?: string | null;
    organizationId: string;
    positionId: string | null;
    intakeSubmissionId?: string | null;
    traceId?: string | null;
  },
): Promise<PilotDecision> {
  const fp = pilotFingerprint(input);

  try {
    // 1. This workspace's own history.
    const { data: org } = await admin
      .from("organizations")
      .select("pilot_status, pilot_used, pilot_admin_override, pilot_position_id, name, website")
      .eq("id", input.organizationId)
      .maybeSingle();

    const override = Boolean(org?.pilot_admin_override);
    const selfUsed =
      Boolean(org?.pilot_used) ||
      Boolean(org?.pilot_status && org.pilot_status !== "none" && org.pilot_status !== null);

    let reason: PilotBlockReason | null = null;
    let matchedClaimId: string | null = null;

    if (selfUsed && (!org?.pilot_position_id || org.pilot_position_id !== input.positionId)) {
      reason = "pilot_already_used";
    }

    // 2. The same company under a different account or workspace.
    if (!reason) {
      const prior = await findPriorClaim(admin, fp, { excludeOrganizationId: input.organizationId });
      if (prior && !prior.claim.exception_granted) {
        reason = prior.reason;
        matchedClaimId = prior.claim.id;
      }
    }

    // A staff override on this workspace beats every match — that is how a
    // second location or franchise is let through.
    if (reason && override) reason = null;

    const line = reason ? blockReasonLine(reason) : "First pilot for this company.";

    const { data: claim } = await admin
      .from("pilot_claims")
      .insert({
        organization_id: input.organizationId,
        position_id: input.positionId,
        intake_submission_id: input.intakeSubmissionId ?? null,
        company_name: fp.companyName || (org?.name ?? "Unknown"),
        company_name_normalized: fp.companyNameNormalized,
        company_domain: fp.companyDomain,
        email_domain: fp.emailDomain,
        contact_email: fp.contactEmail,
        status: reason ? "void" : "claimed",
        blocked: Boolean(reason),
        blocked_reason: reason,
        matched_claim_id: matchedClaimId,
        exception_granted: Boolean(reason) ? false : override,
        trace_id: input.traceId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (!reason) {
      await admin
        .from("organizations")
        .update({
          // The 14-day clock starts when the role goes live, not now.
          pilot_status: "reserved",
          pilot_used: true,
          pilot_position_id: input.positionId,
        })
        .eq("id", input.organizationId);
    } else {
      // Staff must see this, and see it as a warning, not as an ordinary intake.
      try {
        await admin.rpc("notify_platform_staff", {
          _organization_id: input.organizationId,
          _event_type: "intake_submitted",
          _title: `Repeat pilot attempt — ${fp.companyName || "unknown company"}`,
          _body: `${line} This role was created on a paid footing, not on a pilot. Grant a pilot exception only if this is a separate location, franchise or subsidiary.`,
          _link_path: input.positionId ? `/admin/positions/${input.positionId}` : "/admin/intake",
        } as never);
      } catch (err) {
        console.error("[pilot] staff warning failed (non-critical)", err);
      }
    }

    return {
      eligible: !reason,
      reason,
      matchedClaimId,
      claimId: (claim?.id as string | undefined) ?? null,
      line,
    } as PilotDecision;
  } catch (err) {
    console.error("[pilot] eligibility check failed (non-critical)", err);
    // Fail closed on the pilot, open on onboarding: no pilot is granted, but the
    // client still gets their workspace and role.
    return {
      eligible: false,
      reason: "pilot_already_used",
      matchedClaimId: null,
      claimId: null,
      line: "Pilot eligibility could not be confirmed — staff review required.",
    } as PilotDecision;
  }
}

/** Repeat-pilot attempts, newest first, for the admin warning surface. */
export async function listRepeatPilotAttempts(
  admin: Admin,
  opts: { organizationId?: string | null; limit?: number } = {},
) {
  let q = admin
    .from("pilot_claims")
    .select(
      "id, organization_id, position_id, intake_submission_id, company_name, company_domain, email_domain, contact_email, blocked_reason, matched_claim_id, exception_granted, exception_kind, exception_reason, exception_at, created_at",
    )
    .eq("blocked", true)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 25);
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}
