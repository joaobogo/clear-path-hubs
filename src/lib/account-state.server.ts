/**
 * Plan / seats / onboarding — the one reader.
 *
 * Every surface that prints any of these three figures calls this. Plan falls
 * back subscription → entitlement → workspace record (exactly the order the
 * account operating summary uses), seats come from the single seat derivation,
 * and onboarding progress is derived from the same records the client Setup
 * wizard counts rather than from the raw status column.
 */
import { readSeatsForOrg } from "@/lib/kpis/seats.server";
import { deriveOnboardingState, type AccountState } from "@/lib/account-state";
import {
  deriveOnboardingCompletion,
  ONBOARDING_STEP_TOTAL,
} from "@/lib/onboarding/derive-completion";
import { WEIGHT_DIMENSIONS } from "@/lib/requisition-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DRAFT_NAMESPACE = "onboarding_v1";

function labelCount(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

export async function readAccountState(
  db: Any,
  organizationId: string,
): Promise<AccountState> {
  const a = db as { from: (t: string) => Any };

  const [orgRes, subRes, entRes, posRes, seats] = await Promise.all([
    a
      .from("organizations")
      .select("id, plan_name, onboarding_status, client_seat_limit, pilot_position_id")
      .eq("id", organizationId)
      .maybeSingle(),
    a
      .from("subscriptions")
      .select("plan_label, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
    a
      .from("plan_entitlements")
      .select("plan_label, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
    a
      .from("positions")
      .select(
        "id, title, status, requirements, evaluation_weights, blueprint_status, blueprint_confirmed_at, search_live_at, intake_context, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(25),
    readSeatsForOrg(db, organizationId),
  ]);

  const org = (orgRes?.data ?? null) as Any;
  const sub = ((subRes?.data ?? [])[0] ?? null) as Any;
  const ent = ((entRes?.data ?? [])[0] ?? null) as Any;
  const rows = (posRes?.data ?? []) as Any[];

  const plan = sub?.plan_label
    ? { label: String(sub.plan_label), source: "subscription" as const, status: (sub.status as string) ?? null }
    : ent?.plan_label
      ? { label: String(ent.plan_label), source: "entitlement" as const, status: (ent.status as string) ?? null }
      : org?.plan_name
        ? { label: String(org.plan_name), source: "workspace" as const, status: null }
        : { label: null, source: "none" as const, status: null };

  const preferred = org?.pilot_position_id ?? null;
  const row = rows.find((r) => r.id === preferred) ?? rows[0] ?? null;
  const ctx = (row?.intake_context ?? {}) as Record<string, unknown>;
  const weightsRaw = (row?.evaluation_weights ?? {}) as Record<string, unknown>;

  // Wizard confirmations live on a per-user draft; staff cannot read another
  // user's draft, so record-derived steps are counted here and confirmations
  // are added when the workspace has any.
  let confirmed: Record<string, unknown> = {};
  try {
    const { data: drafts } = await a
      .from("intake_drafts")
      .select("payload, updated_at")
      .order("updated_at", { ascending: false })
      .limit(25);
    for (const d of ((drafts ?? []) as Any[])) {
      const ns = ((d?.payload ?? {}) as Any)[DRAFT_NAMESPACE] as Any;
      const c = (ns?.confirmed ?? null) as Record<string, unknown> | null;
      if (c && Object.keys(c).length > 0) {
        confirmed = { ...c, ...confirmed };
      }
    }
  } catch {
    confirmed = {};
  }

  // Candidates already shared for this role: the strongest evidence that setup
  // finished, whichever route the role took.
  let deliveredForPosition = 0;
  if (row?.id) {
    const { count } = await a
      .from("candidate_matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("position_id", row.id);
    deliveredForPosition = count ?? 0;
  }

  const complete = deriveOnboardingCompletion({
    organizationName: org?.name ?? "workspace",
    confirmed: confirmed as Any,
    position: row
      ? {
          title: row.title ?? null,
          mustHaveCount: labelCount(row.requirements),
          blueprintConfirmedAt: row.blueprint_confirmed_at ?? null,
          weightsSet: WEIGHT_DIMENSIONS.some((d) => typeof weightsRaw[d.key] === "number"),
          oversightKeys:
            ctx.oversight && typeof ctx.oversight === "object"
              ? Object.keys(ctx.oversight as Record<string, unknown>).length
              : 0,
          blueprintStatus: row.blueprint_status ?? null,
          searchLiveAt: row.search_live_at ?? null,
          status: row.status ?? null,
          deliveredCandidates: deliveredForPosition,
        }
      : null,
  });

  const recruiterSeats = Math.max(0, seats.seatLimit - 1);

  return {
    organization_id: organizationId,
    plan,
    seats: {
      limit: seats.seatLimit,
      used: seats.seatsUsed,
      remaining: seats.seatsLeft,
      recruiterSeats,
    },
    onboarding: deriveOnboardingState({
      storedStatus: org?.onboarding_status ?? null,
      stepsComplete: complete.length,
      stepsTotal: ONBOARDING_STEP_TOTAL,
    }),
    generated_at: new Date().toISOString(),
  };
}
