/**
 * Server-side wiring for Finding 15: a real reviewer path onto the pure
 * override helpers in `./overrides.ts`, backed by the append-only
 * `evidence_overrides` table. The machine value on `candidate_evidence_items`
 * is never touched by this module — a revert appends a new row, it never
 * updates or deletes the original.
 */
import {
  createOverride,
  revertOverride,
  effectiveValue,
  overrideCaption,
  isActive,
  type OverrideRecord,
} from "./overrides";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function actorName(admin: AnyRow, userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("full_name,email")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data?.full_name || data?.email || "A reviewer";
}

export type EvidenceOverrideRow = {
  id: string;
  evidence_item_id: string;
  candidate_match_id: string;
  actor_user_id: string | null;
  reason: string;
  before_state: AnyRow;
  after_state: AnyRow;
  created_at: string;
};

/** Record a human override on one evidence item's criterion result. */
export async function recordEvidenceOverride(
  admin: AnyRow,
  opts: { evidenceItemId: string; matchId: string; humanValue: string; reason: string; actorUserId: string },
): Promise<OverrideRecord> {
  const { data: item, error } = await admin
    .from("candidate_evidence_items")
    .select("id,candidate_match_id,organization_id,rubric_criterion_key,result")
    .eq("id", opts.evidenceItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error("evidence_not_found");
  if (item.candidate_match_id !== opts.matchId) throw new Error("evidence_match_mismatch");

  const name = await actorName(admin, opts.actorUserId);
  const record = createOverride({
    target: "criterion_result",
    key: item.id,
    machine_value: String(item.result ?? ""),
    human_value: opts.humanValue,
    reason: opts.reason,
    user_id: opts.actorUserId,
    user_name: name,
  });

  const { error: insErr } = await admin.from("evidence_overrides").insert({
    evidence_item_id: item.id,
    candidate_match_id: opts.matchId,
    organization_id: item.organization_id,
    actor_user_id: opts.actorUserId,
    reason: record.reason,
    before_state: { record: null, machine_value: record.machine_value },
    after_state: { record },
  });
  if (insErr) throw new Error(insErr.message);
  return record;
}

/** Append-only revert: a new row restoring the machine value, never an update. */
export async function revertEvidenceOverride(
  admin: AnyRow,
  opts: { evidenceItemId: string; matchId: string; reason: string; actorUserId: string },
): Promise<OverrideRecord> {
  const active = await getActiveOverrideForItem(admin, opts.matchId, opts.evidenceItemId);
  if (!active) throw new Error("no_active_override");

  const name = await actorName(admin, opts.actorUserId);
  const reverted = revertOverride(active, name);

  const { error: insErr } = await admin.from("evidence_overrides").insert({
    evidence_item_id: opts.evidenceItemId,
    candidate_match_id: opts.matchId,
    organization_id: (
      await admin
        .from("candidate_evidence_items")
        .select("organization_id")
        .eq("id", opts.evidenceItemId)
        .maybeSingle()
    ).data?.organization_id,
    actor_user_id: opts.actorUserId,
    reason: opts.reason,
    before_state: { record: active },
    after_state: { record: reverted },
  });
  if (insErr) throw new Error(insErr.message);
  return reverted;
}

async function historyRows(admin: AnyRow, matchId: string): Promise<EvidenceOverrideRow[]> {
  const { data, error } = await admin
    .from("evidence_overrides")
    .select("id,evidence_item_id,candidate_match_id,actor_user_id,reason,before_state,after_state,created_at")
    .eq("candidate_match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EvidenceOverrideRow[];
}

/** Full, ordered override history for a match, oldest first. */
export async function getOverrideHistoryForMatch(
  admin: AnyRow,
  matchId: string,
): Promise<Array<EvidenceOverrideRow & { record: OverrideRecord | null; caption: string | null }>> {
  const rows = await historyRows(admin, matchId);
  return rows.map((r) => {
    const record = (r.after_state?.record as OverrideRecord | undefined) ?? null;
    return { ...r, record, caption: record ? overrideCaption(record) : null };
  });
}

/** The active (non-reverted) override for one evidence item, if any. */
export async function getActiveOverrideForItem(
  admin: AnyRow,
  matchId: string,
  evidenceItemId: string,
): Promise<OverrideRecord | null> {
  const rows = await historyRows(admin, matchId);
  const forItem = rows.filter((r) => r.evidence_item_id === evidenceItemId);
  if (forItem.length === 0) return null;
  const latest = forItem[forItem.length - 1];
  const record = (latest.after_state?.record as OverrideRecord | undefined) ?? null;
  return record && isActive(record) ? record : null;
}

/** Map of evidence_item_id -> active override, for a whole match in one pass. */
export async function getActiveOverridesForMatch(
  admin: AnyRow,
  matchId: string,
): Promise<Map<string, OverrideRecord>> {
  const rows = await historyRows(admin, matchId);
  const latestByItem = new Map<string, OverrideRecord | null>();
  for (const r of rows) {
    const record = (r.after_state?.record as OverrideRecord | undefined) ?? null;
    latestByItem.set(r.evidence_item_id, record);
  }
  const out = new Map<string, OverrideRecord>();
  for (const [itemId, record] of latestByItem) {
    if (record && isActive(record)) out.set(itemId, record);
  }
  return out;
}

/** Value + attribution to present for one item: override if active, else machine. */
export function presentedValue(
  machineValue: string,
  active: OverrideRecord | null,
): { value: string; caption: string | null; overridden: boolean } {
  if (!active) return { value: machineValue, caption: null, overridden: false };
  return { value: effectiveValue(active), caption: overrideCaption(active), overridden: true };
}
