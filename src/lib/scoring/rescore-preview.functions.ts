// A role's re-score, previewed: for each scored candidate, the score shown
// today beside the score a re-score would show, and every requirement whose
// status would change. Staff only. Reads only: nothing is scored, queued,
// flagged or published by looking.

import type { StaffActionContext } from "@/lib/staff-action-context";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type RescorePreviewRow = {
  match_id: string;
  candidate: string | null;
  admin_status: string | null;
  client_visibility: string | null;
  current: { score: number | null; method: string | null; engine_version: string | null };
  /** Null when the match cannot be scored as it stands; `reason` says why. */
  preview: {
    machine_score: number;
    shown_score: number;
    reviewed: boolean;
    inputs_unchanged: boolean;
    eligibility: string;
  } | null;
  reason: string | null;
  /** shown_score minus the current score, to one decimal. */
  delta: number | null;
  /** Requirements whose shown status would change: id, from, to. */
  changes: Array<{ id: string; from: string | null; to: string }>;
};

export const previewRoleRescoreValidate = (i: unknown) =>
  z
    .object({
      position_id: z.string().uuid(),
      limit: z.number().int().min(1).max(40).optional(),
      offset: z.number().int().min(0).optional(),
    })
    .parse(i);

export const previewRoleRescore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(previewRoleRescoreValidate)
  .handler(previewRoleRescoreHandler);

export async function previewRoleRescoreHandler({
  data,
  context,
}: {
  data: ReturnType<typeof previewRoleRescoreValidate>;
  context: StaffActionContext;
}) {
  await requireStaff(context.userId);
  const s = await getAdmin();
  const limit = data.limit ?? 15;
  const offset = data.offset ?? 0;
  const {
    data: matches,
    error,
    count,
  } = await s
    .from("candidate_matches")
    .select(
      "id,admin_status,client_visibility,current_score_run_id,candidate_profiles(full_name),score_runs:current_score_run_id(final_score,evaluation_method,engine_version,result)",
      { count: "exact" },
    )
    .eq("position_id", data.position_id)
    .not("current_score_run_id", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const { previewScoring } = await import("@/lib/scoring-service.server");
  const { ENGINE_VERSION } = await import("@/lib/scoring/engine-version");
  const rows: RescorePreviewRow[] = [];
  for (const m of (matches ?? []) as AnyRow[]) {
    const run = Array.isArray(m.score_runs) ? m.score_runs[0] : m.score_runs;
    const profile = Array.isArray(m.candidate_profiles)
      ? m.candidate_profiles[0]
      : m.candidate_profiles;
    const currentScore = run?.final_score == null ? null : Number(run.final_score);
    const currentStatuses = new Map<string, string>(
      (Array.isArray(run?.result?.requirement_assessment)
        ? (run.result.requirement_assessment as AnyRow[])
        : []
      ).map((r) => [String(r.id), String(r.status)]),
    );
    const base = {
      match_id: m.id as string,
      candidate: (profile?.full_name as string | null) ?? null,
      admin_status: (m.admin_status as string | null) ?? null,
      client_visibility: (m.client_visibility as string | null) ?? null,
      current: {
        score: currentScore,
        method: (run?.evaluation_method as string | null) ?? null,
        engine_version: (run?.engine_version as string | null) ?? null,
      },
    };
    let p: Awaited<ReturnType<typeof previewScoring>>;
    try {
      p = await previewScoring(m.id as string);
    } catch (e) {
      p = { ok: false, match_id: m.id, reason: (e as Error)?.message ?? "preview_failed" };
    }
    if (!p.ok) {
      rows.push({ ...base, preview: null, reason: p.reason, delta: null, changes: [] });
      continue;
    }
    const shown = p.reviewed?.statuses ?? p.machine.statuses;
    const changes = Object.entries(shown)
      .filter(([id, to]) => currentStatuses.get(id) !== to)
      .map(([id, to]) => ({ id, from: currentStatuses.get(id) ?? null, to }));
    rows.push({
      ...base,
      preview: {
        machine_score: p.machine.score,
        shown_score: p.shown_score,
        reviewed: p.reviewed != null,
        inputs_unchanged: p.inputs_unchanged,
        eligibility: p.eligibility,
      },
      reason: null,
      delta: currentScore == null ? null : Math.round((p.shown_score - currentScore) * 10) / 10,
      changes,
    });
  }
  return {
    position_id: data.position_id,
    engine_version: ENGINE_VERSION,
    total: count ?? rows.length,
    offset,
    limit,
    rows,
  };
}
