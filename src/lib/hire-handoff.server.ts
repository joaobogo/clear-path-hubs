/**
 * Handoff after a hire — data loading and the two writes it needs.
 *
 * Reads run as the signed-in client user, so RLS decides what is visible. The
 * step catalogue comes from the plan stored against the account; completion and
 * recorded owners come from `hire_handoff_steps` and persist until done.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHandoffSteps,
  compensationLine,
  guaranteeWindow,
  normalisePlan,
  type PositionHandoff,
} from "./hire-handoff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const HIRE_COLS =
  "id, candidate_match_id, candidate_profile_id, organization_id, position_id, status, owner_user_id, start_date, start_date_confirmed, guarantee_days, guarantee_starts_on, guarantee_terms, guarantee_visible_to_client, salary_amount, salary_currency, salary_period, employment_type, location, work_model, accepted_at, hired_at, updated_at";

/** The plan stored against the account, or null when nothing is stored yet. */
async function readPlan(db: Db, orgId: string): Promise<{ label: string | null; source: string | null }> {
  const { data } = await db
    .from("plan_entitlements")
    .select("plan_label, source, status, created_at")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data ?? null) as Row | null;
  if (row) {
    return { label: (row["plan_label"] as string | null) ?? null, source: (row["source"] as string | null) ?? null };
  }
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan_label, status, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const srow = (sub ?? null) as Row | null;
  return {
    label: (srow?.["plan_label"] as string | null) ?? null,
    source: srow ? "subscription" : null,
  };
}

/**
 * The handoff for a position, or null when no hire has been confirmed on it.
 * Null is the signal for the page to keep showing the search view.
 */
export async function loadPositionHandoff(
  db: Db,
  args: { orgId: string; positionId: string },
): Promise<PositionHandoff | null> {
  const hireRes = await db
    .from("hire_records")
    .select(HIRE_COLS)
    .eq("organization_id", args.orgId)
    .eq("position_id", args.positionId)
    .eq("status", "hire_confirmed")
    .order("hired_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hireRes.error) throw new Error(hireRes.error.message);
  const hire = (hireRes.data ?? null) as Row | null;
  if (!hire) return null;

  const [posRes, candRes, ownerRes, stepRes, plan] = await Promise.all([
    db.from("positions").select("id, title").eq("id", args.positionId).maybeSingle(),
    db
      .from("candidate_profiles")
      .select("id, full_name")
      .eq("id", hire["candidate_profile_id"])
      .maybeSingle(),
    hire["owner_user_id"]
      ? db
          .from("profiles")
          .select("auth_user_id, full_name")
          .eq("auth_user_id", hire["owner_user_id"])
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db
      .from("hire_handoff_steps")
      .select("step_key, owner_label, completed_at")
      .eq("hire_id", hire["id"]),
    readPlan(db, args.orgId),
  ]);
  if (stepRes.error) throw new Error(stepRes.error.message);

  const normalised = normalisePlan(plan.label, plan.source);
  const serviceOwnerName =
    ((ownerRes.data as Row | null)?.["full_name"] as string | null) ?? null;

  const steps = buildHandoffSteps(
    normalised,
    ((stepRes.data as Row[]) ?? []).map((r) => ({
      step_key: String(r["step_key"]),
      owner_name: (r["owner_label"] as string | null) ?? null,
      completed_at: (r["completed_at"] as string | null) ?? null,
    })),
    { serviceOwnerName },
  );

  const guaranteeVisible = hire["guarantee_visible_to_client"] !== false;

  return {
    position_id: args.positionId,
    position_title: String((posRes.data as Row | null)?.["title"] ?? "This role"),
    hire_id: String(hire["id"]),
    candidate_name: String((candRes.data as Row | null)?.["full_name"] ?? "Your new hire"),
    accepted_at: (hire["accepted_at"] as string | null) ?? null,
    hired_at: (hire["hired_at"] as string | null) ?? null,
    start_date: (hire["start_date"] as string | null) ?? null,
    start_date_confirmed: hire["start_date_confirmed"] === true,
    compensation: compensationLine({
      salary_amount: hire["salary_amount"] as number | null,
      salary_currency: hire["salary_currency"] as string | null,
      salary_period: hire["salary_period"] as string | null,
    }),
    employment_type: (hire["employment_type"] as string | null) ?? null,
    location: (hire["location"] as string | null) ?? null,
    work_model: (hire["work_model"] as string | null) ?? null,
    guarantee: guaranteeVisible
      ? guaranteeWindow({
          start_date: hire["start_date"] as string | null,
          guarantee_starts_on: hire["guarantee_starts_on"] as string | null,
          guarantee_days: hire["guarantee_days"] as number | null,
        })
      : null,
    guarantee_terms: guaranteeVisible ? ((hire["guarantee_terms"] as string | null) ?? null) : null,
    guarantee_visible: guaranteeVisible,
    plan_label: normalised.label,
    steps,
    generated_at: new Date().toISOString(),
  };
}

/** Marks a handoff step complete or reopens it. Persists until completed. */
export async function setHandoffStepDone(
  db: Db,
  args: {
    orgId: string;
    positionId: string;
    hireId: string;
    stepKey: string;
    label: string;
    sequence: number;
    ownerLabel: string | null;
    planLabel: string | null;
    done: boolean;
    actorUserId: string;
  },
): Promise<{ ok: true }> {
  const res = await db
    .from("hire_handoff_steps")
    .upsert(
      {
        hire_id: args.hireId,
        organization_id: args.orgId,
        position_id: args.positionId,
        step_key: args.stepKey,
        label: args.label,
        sequence: args.sequence,
        owner_label: args.ownerLabel,
        plan_source: args.planLabel,
        completed_at: args.done ? new Date().toISOString() : null,
        completed_by: args.done ? args.actorUserId : null,
      },
      { onConflict: "hire_id,step_key" },
    );
  if (res.error) throw new Error(res.error.message);

  const audit = await db.from("audit_events").insert({
    entity_type: "hire_records",
    entity_id: args.hireId,
    organization_id: args.orgId,
    actor_user_id: args.actorUserId,
    action: args.done ? "hire.handoff_step_completed" : "hire.handoff_step_reopened",
    after_state: { step_key: args.stepKey },
  });
  if (audit.error) throw new Error(audit.error.message);
  return { ok: true };
}
