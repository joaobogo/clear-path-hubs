/**
 * Server-side loader for the evidence completeness gate.
 * Reads only; all writes live in completeness.functions.ts.
 */
import {
  buildCompletenessReport,
  slugifyCriterion,
  GATE_OVERRIDE_ACTION,
  type CompletenessReport,
  type RawAssessment,
  type RawEvidenceItem,
  type RawGateOverride,
  type RawRequirement,
} from "./completeness";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

function requirementLabel(entry: unknown): string {
  if (!entry) return "";
  if (typeof entry === "string") return entry.trim();
  const r = entry as Record<string, unknown>;
  const candidate =
    r["label"] ?? r["text"] ?? r["requirement_text"] ?? r["requirement"] ?? r["name"] ?? r["title"];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function toRequirements(must: unknown, nice: unknown): RawRequirement[] {
  const out: RawRequirement[] = [];
  const push = (list: unknown, required: boolean) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      const label = requirementLabel(entry);
      if (label) out.push({ label, required });
    }
  };
  push(must, true);
  push(nice, false);
  return out;
}

function toAssessments(runResult: unknown, insights: unknown): RawAssessment[] {
  const out: RawAssessment[] = [];
  const collect = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, any>;
      const label = requirementLabel(r);
      if (!label) continue;
      out.push({
        label,
        result: (r["status"] ?? r["verdict"] ?? r["result"] ?? null) as string | null,
        snippet:
          (r["cv_quote"] ?? r["snippet"] ?? r["quote"] ?? r["evidence"]?.[0]?.snippet ?? null) as
            | string
            | null,
        confidence: typeof r["confidence"] === "number" ? r["confidence"] : null,
      });
    }
  };
  const result = (runResult ?? {}) as Record<string, unknown>;
  collect(result["requirement_assessment"]);
  collect(result["evidence"]);
  collect((insights as Record<string, unknown> | null)?.["requirement_verdicts"]);
  return out;
}

export interface CompletenessPayload {
  matchId: string;
  organizationId: string | null;
  candidateName: string | null;
  positionTitle: string | null;
  clientName: string | null;
  alreadySubmitted: boolean;
  report: CompletenessReport;
}

export async function loadCompleteness(
  supabase: Client,
  matchId: string,
): Promise<CompletenessPayload> {
  const { data: match, error: matchErr } = await supabase
    .from("candidate_matches")
    .select(
      "id, organization_id, current_score_run_id, approved_score_run_id, client_visibility, delivered_at, candidate_profiles(full_name), positions(title, requirements, preferred_requirements, organizations(name))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) throw matchErr;
  if (!match) throw new Error("match_not_found");

  const runId = match.current_score_run_id ?? match.approved_score_run_id ?? null;

  const [itemsRes, runRes, evidenceRes, overrideRes] = await Promise.all([
    supabase
      .from("candidate_evidence_items")
      .select(
        "id, rubric_criterion_key, rubric_dimension_key, source_passage, normalized_meaning, result, confidence, source_kind, reviewer_status, integrity_ok",
      )
      .eq("candidate_match_id", matchId),
    runId
      ? supabase.from("score_runs").select("id, result").eq("id", runId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("candidate_evidence")
      .select("extracted")
      .eq("candidate_match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("audit_events")
      .select("actor_user_id, after_state, created_at")
      .eq("entity_type", "candidate_match")
      .eq("entity_id", matchId)
      .eq("action", GATE_OVERRIDE_ACTION)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (overrideRes.error) throw overrideRes.error;

  const items = (itemsRes.data ?? []) as RawEvidenceItem[];
  const insights = (evidenceRes?.data?.extracted as Record<string, unknown> | null)?.["insights"] ?? null;
  const assessments = toAssessments(runRes?.data?.result ?? null, insights);

  const overrideRows = (overrideRes.data ?? []) as Array<{
    actor_user_id: string | null;
    after_state: Record<string, any> | null;
    created_at: string;
  }>;

  const actorIds = Array.from(
    new Set(overrideRows.map((r) => r.actor_user_id).filter((v): v is string => !!v)),
  );
  const nameById = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", actorIds);
    for (const p of profiles ?? []) {
      if (p.full_name) nameById.set(p.user_id, p.full_name);
    }
  }

  // Latest override per criterion wins (rows already sorted newest first).
  const seen = new Set<string>();
  const overrides: RawGateOverride[] = [];
  for (const row of overrideRows) {
    const key = String(row.after_state?.["criterion_key"] ?? "");
    const reason = String(row.after_state?.["justification"] ?? "").trim();
    if (!key || !reason || seen.has(key)) continue;
    seen.add(key);
    overrides.push({
      criterionKey: key,
      reason,
      actorUserId: row.actor_user_id,
      actorName: row.actor_user_id ? (nameById.get(row.actor_user_id) ?? null) : null,
      at: row.created_at,
    });
  }

  const report = buildCompletenessReport({
    requirements: toRequirements(
      match.positions?.requirements,
      match.positions?.preferred_requirements,
    ),
    items,
    assessments,
    overrides,
  });

  return {
    matchId,
    organizationId: match.organization_id ?? null,
    candidateName: match.candidate_profiles?.full_name ?? null,
    positionTitle: match.positions?.title ?? null,
    clientName: match.positions?.organizations?.name ?? null,
    alreadySubmitted: !!match.delivered_at || match.client_visibility === "visible",
    report,
  };
}

/**
 * Gate used by the approval path. Returns the blocking labels, or an empty
 * array when every must-have criterion has evidence or a recorded override.
 */
export async function evidenceGateBlockers(supabase: Client, matchId: string): Promise<string[]> {
  const payload = await loadCompleteness(supabase, matchId);
  return payload.report.blockingLabels;
}

export { slugifyCriterion };
