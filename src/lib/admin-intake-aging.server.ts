/**
 * Intake aging and conversion tracker — data layer.
 *
 * Open = no linked position AND not rejected. Conversion is detected purely by
 * `position_id`, so converting an intake removes it from the open list on the
 * next read with no extra flag to maintain.
 */
import {
  daysWaitingSince,
  intakeAgingTier,
  intakeBlockingReason,
  matchesAgingFilter,
  type IntakeAgingFilter,
  type IntakeAgingTier,
} from "./intake-aging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any };

export type IntakeAgingRow = {
  id: string;
  company_name: string | null;
  role_title: string | null;
  contact_email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  submitted_at: string;
  days_waiting: number;
  tier: IntakeAgingTier;
  status: string | null;
  workspace_status: string | null;
  requisition_pending: boolean;
  owner_user_id: string | null;
  owner_name: string | null;
  converted_position_id: string | null;
  converted_position_title: string | null;
  lead_status: string | null;
  close_reason: string | null;
  closed_at: string | null;
  blocking_reason: string | null;
};

export type IntakeAgingTable = {
  rows: IntakeAgingRow[];
  counts: { open: number; watch: number; late: number; critical: number; not_proceeding: number };
  generated_at: string;
};

export async function loadIntakeAging(
  admin: Admin,
  opts: { includeTest?: boolean; filter?: IntakeAgingFilter; includeClosed?: boolean } = {},
): Promise<IntakeAgingTable> {
  const filter: IntakeAgingFilter = opts.filter ?? "all";
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, opts.includeTest ?? false);

  let q = admin
    .from("intake_submissions")
    .select(
      "id, company_name, role_title, primary_email, organization_id, position_id, status, workspace_status, requisition_pending, owner_user_id, lead_status, lead_close_reason, lead_closed_at, payload, created_at",
      { count: "exact" },
    )
    .is("position_id", null)
    .neq("status", "rejected")
    .order("created_at", { ascending: true });

  if (opts.filter !== "all") {
    q = q.limit(400);
  } else {
    q = q.limit(limit);
  }
  q = excludeTestOrgs(q, scope);

  const res = await q;
  if (res.error) throw new Error(res.error.message);

  const raw = (res.data ?? []) as Array<{
    id: string;
    company_name: string | null;
    role_title: string | null;
    primary_email: string | null;
    organization_id: string | null;
    position_id: string | null;
    status: string | null;
    workspace_status: string | null;
    requisition_pending: boolean | null;
    owner_user_id: string | null;
    lead_status: string | null;
    lead_close_reason: string | null;
    lead_closed_at: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    created_at: string;
  }>;

  const ownerIds = [...new Set(raw.map((r) => r.owner_user_id).filter(Boolean) as string[])];
  const orgIds = [...new Set(raw.map((r) => r.organization_id).filter(Boolean) as string[])];

  const [profRes, orgRes] = await Promise.all([
    ownerIds.length
      ? admin.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profRes.error) throw new Error(profRes.error.message);
  if (orgRes.error) throw new Error(orgRes.error.message);

  const ownerName = new Map<string, string>();
  for (const p of (profRes.data ?? []) as Array<{
    auth_user_id: string;
    full_name: string | null;
    email: string | null;
  }>) {
    ownerName.set(p.auth_user_id, p.full_name || p.email || "Unknown staff member");
  }
  const orgName = new Map<string, string>();
  for (const o of (orgRes.data ?? []) as Array<{ id: string; name: string | null }>) {
    orgName.set(o.id, o.name ?? "Unnamed client");
  }

  const now = Date.now();
  const all: IntakeAgingRow[] = raw.map((r) => {
    const days = daysWaitingSince(r.created_at, now);
    const jd = String(r.payload?.jobDescription ?? "").trim();
    return {
      id: r.id,
      company_name: r.company_name,
      role_title: r.role_title,
      contact_email: r.primary_email,
      organization_id: r.organization_id,
      organization_name: r.organization_id ? (orgName.get(r.organization_id) ?? null) : null,
      submitted_at: r.created_at,
      days_waiting: days,
      tier: intakeAgingTier(days),
      status: r.status,
      workspace_status: r.workspace_status,
      requisition_pending: !!r.requisition_pending,
      owner_user_id: r.owner_user_id,
      owner_name: r.owner_user_id ? (ownerName.get(r.owner_user_id) ?? null) : null,
      converted_position_id: null,
      converted_position_title: null,
      lead_status: r.lead_status,
      close_reason: r.lead_close_reason,
      closed_at: r.lead_closed_at,
      blocking_reason: intakeBlockingReason({
        organization_id: r.organization_id,
        status: r.status,
        workspace_status: r.workspace_status,
        requisition_pending: r.requisition_pending,
        owner_user_id: r.owner_user_id,
        lead_status: r.lead_status,
        role_title: r.role_title,
        payload_has_jd: jd.length > 0,
      }),
    };
  });

  const openRows = all.filter((r) => r.lead_status !== "closed");
  const closedRows = all.filter((r) => r.lead_status === "closed");
  const pool = opts.includeClosed ? closedRows : openRows;

  const rows = (opts.includeClosed ? pool : pool.filter((r) => matchesAgingFilter(r.tier, filter)))
    .slice()
    .sort((a, b) => b.days_waiting - a.days_waiting);

  return {
    rows,
    counts: {
      open: openRows.length,
      watch: openRows.filter((r) => r.tier !== "fresh").length,
      late: openRows.filter((r) => r.tier === "late" || r.tier === "critical").length,
      critical: openRows.filter((r) => r.tier === "critical").length,
      not_proceeding: closedRows.length,
    },
    generated_at: new Date().toISOString(),
  };
}

async function writeIntakeAudit(
  admin: Admin,
  opts: {
    actor: string;
    action: string;
    intakeId: string;
    organizationId: string | null;
    before: unknown;
    after: unknown;
  },
) {
  const { error } = await admin.from("audit_events").insert({
    entity_type: "intake_submissions",
    entity_id: opts.intakeId,
    organization_id: opts.organizationId,
    action: opts.action,
    actor_user_id: opts.actor,
    before_state: opts.before as never,
    after_state: opts.after as never,
  });
  if (error) throw new Error(error.message);
}

/** Assign or clear the owner of an intake. Audited. */
export async function assignIntakeOwnerRow(
  admin: Admin,
  input: { intakeId: string; ownerUserId: string | null; actorUserId: string },
): Promise<{ ok: true; owner_user_id: string | null }> {
  const cur = await admin
    .from("intake_submissions")
    .select("id, owner_user_id, organization_id, position_id")
    .eq("id", input.intakeId)
    .maybeSingle();
  if (cur.error) throw new Error(cur.error.message);
  if (!cur.data) throw new Error("Intake not found");
  if (cur.data.position_id) throw new Error("This intake is already converted to a position");

  const upd = await admin
    .from("intake_submissions")
    .update({ owner_user_id: input.ownerUserId, updated_at: new Date().toISOString() })
    .eq("id", input.intakeId);
  if (upd.error) throw new Error(upd.error.message);

  await writeIntakeAudit(admin, {
    actor: input.actorUserId,
    action: "intake.owner_assigned",
    intakeId: input.intakeId,
    organizationId: cur.data.organization_id ?? null,
    before: { owner_user_id: cur.data.owner_user_id ?? null },
    after: { owner_user_id: input.ownerUserId },
  });
  return { ok: true as const, owner_user_id: input.ownerUserId };
}

/**
 * Mark an intake as not proceeding (reason required) or reopen it. Reopening
 * clears the close reason and returns the row to the open list; the audit trail
 * keeps both events.
 */
export async function setIntakeProceedingRow(
  admin: Admin,
  input: {
    intakeId: string;
    proceeding: boolean;
    reason?: string;
    actorUserId: string;
  },
): Promise<{ ok: true; lead_status: string }> {
  if (!input.proceeding && !(input.reason ?? "").trim()) {
    throw new Error("A reason is required to mark an intake as not proceeding");
  }
  const cur = await admin
    .from("intake_submissions")
    .select("id, organization_id, lead_status, lead_close_reason, position_id")
    .eq("id", input.intakeId)
    .maybeSingle();
  if (cur.error) throw new Error(cur.error.message);
  if (!cur.data) throw new Error("Intake not found");
  if (cur.data.position_id) throw new Error("This intake is already converted to a position");

  const now = new Date().toISOString();
  const patch = input.proceeding
    ? {
        lead_status: "open",
        lead_close_reason: null,
        lead_closed_at: null,
        lead_closed_by: null,
        updated_at: now,
      }
    : {
        lead_status: "closed",
        lead_close_reason: (input.reason ?? "").trim(),
        lead_closed_at: now,
        lead_closed_by: input.actorUserId,
        updated_at: now,
      };

  const upd = await admin.from("intake_submissions").update(patch).eq("id", input.intakeId);
  if (upd.error) throw new Error(upd.error.message);

  await writeIntakeAudit(admin, {
    actor: input.actorUserId,
    action: input.proceeding ? "intake.reopened" : "intake.not_proceeding",
    intakeId: input.intakeId,
    organizationId: cur.data.organization_id ?? null,
    before: { lead_status: cur.data.lead_status, lead_close_reason: cur.data.lead_close_reason },
    after: { lead_status: patch.lead_status, lead_close_reason: patch.lead_close_reason },
  });
  return { ok: true as const, lead_status: patch.lead_status };
}
