/**
 * Pilot eligibility — admin side.
 *
 * Reads the refused attempts so staff can see them, and grants the narrow
 * exception that exists for separate locations, franchises and subsidiaries.
 */

import { blockReasonLine } from "@/lib/pilot-eligibility";
import type { RepeatPilotAttempt } from "@/lib/pilot-eligibility.functions";

type Admin = { from: (table: string) => any };

export async function loadPilotWarnings(
  admin: Admin,
  opts: { organizationId?: string | null; limit?: number } = {},
): Promise<RepeatPilotAttempt[]> {
  let q = admin
    .from("pilot_claims")
    .select(
      "id, organization_id, position_id, intake_submission_id, company_name, company_domain, email_domain, contact_email, blocked_reason, matched_claim_id, exception_granted, exception_kind, exception_reason, created_at",
    )
    .eq("blocked", true)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 25);
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, any>[];
  if (rows.length === 0) return [];

  // Company names for both sides of the match.
  const priorIds = rows.map((r) => r.matched_claim_id).filter(Boolean) as string[];
  const priorById = new Map<string, Record<string, any>>();
  if (priorIds.length > 0) {
    const { data: priors } = await admin
      .from("pilot_claims")
      .select("id, company_name, organization_id, created_at")
      .in("id", priorIds);
    for (const p of (priors ?? []) as Record<string, any>[]) priorById.set(p.id as string, p);
  }

  const orgIds = new Set<string>();
  for (const r of rows) if (r.organization_id) orgIds.add(r.organization_id as string);
  for (const p of priorById.values()) if (p.organization_id) orgIds.add(p.organization_id as string);
  const orgNameById = new Map<string, string>();
  if (orgIds.size > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", Array.from(orgIds));
    for (const o of (orgs ?? []) as Record<string, any>[])
      orgNameById.set(o.id as string, (o.name as string) ?? "");
  }

  return rows.map((r) => {
    const prior = r.matched_claim_id ? priorById.get(r.matched_claim_id as string) : null;
    return {
      id: r.id as string,
      organization_id: (r.organization_id as string) ?? null,
      organization_name: r.organization_id
        ? (orgNameById.get(r.organization_id as string) ?? null)
        : null,
      position_id: (r.position_id as string) ?? null,
      intake_submission_id: (r.intake_submission_id as string) ?? null,
      company_name: (r.company_name as string) ?? "Unknown company",
      company_domain: (r.company_domain as string) ?? null,
      email_domain: (r.email_domain as string) ?? null,
      contact_email: (r.contact_email as string) ?? null,
      blocked_reason: (r.blocked_reason as string) ?? null,
      blocked_line: blockReasonLine(r.blocked_reason as string | null),
      first_claim: prior
        ? {
            id: prior.id as string,
            company_name: (prior.company_name as string) ?? "Unknown company",
            organization_id: (prior.organization_id as string) ?? null,
            organization_name: prior.organization_id
              ? (orgNameById.get(prior.organization_id as string) ?? null)
              : null,
            created_at: prior.created_at as string,
          }
        : null,
      exception_granted: Boolean(r.exception_granted),
      exception_kind: (r.exception_kind as string) ?? null,
      exception_reason: (r.exception_reason as string) ?? null,
      created_at: r.created_at as string,
    };
  });
}

export async function grantException(
  admin: Admin,
  input: { claimId: string; kind: string; reason: string; actorUserId: string },
): Promise<{ ok: true }> {
  const { data: claim, error } = await admin
    .from("pilot_claims")
    .select("id, organization_id, position_id, company_name, exception_granted")
    .eq("id", input.claimId)
    .maybeSingle();
  if (error) throw error;
  if (!claim) throw new Error("pilot_claim_not_found");

  const { error: upErr } = await admin
    .from("pilot_claims")
    .update({
      blocked: false,
      status: "claimed",
      exception_granted: true,
      exception_kind: input.kind,
      exception_reason: input.reason,
      exception_by: input.actorUserId,
      exception_at: new Date().toISOString(),
    })
    .eq("id", input.claimId);
  if (upErr) throw upErr;

  // The workspace now genuinely holds a pilot for this role.
  if (claim.organization_id) {
    await admin
      .from("organizations")
      .update({
        pilot_status: "reserved",
        pilot_used: true,
        pilot_position_id: claim.position_id ?? null,
        pilot_admin_override: true,
        pilot_override_by: input.actorUserId,
        pilot_override_at: new Date().toISOString(),
        pilot_override_reason: `${input.kind}: ${input.reason}`,
      })
      .eq("id", claim.organization_id);
  }

  // Every exception is auditable — who approved it, for which company, and why.
  try {
    await admin.from("audit_events").insert({
      organization_id: claim.organization_id ?? null,
      actor_user_id: input.actorUserId,
      entity_type: "pilot_claim",
      entity_id: input.claimId,
      action: "pilot_exception_granted",
      after_state: { kind: input.kind, reason: input.reason, company: claim.company_name },
    });
  } catch (err) {
    console.error("[pilot] exception audit failed (non-critical)", err);
  }

  return { ok: true };
}
