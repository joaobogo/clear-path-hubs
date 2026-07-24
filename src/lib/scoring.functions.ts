/**
 * Scoring canonical product-system server functions.
 *
 * This module owns:
 *  - Orphan review (rows whose scoring identity does not resolve).
 *  - Canonical-state read/transition helpers used by the reviewer center.
 *
 * Client-facing scoring reads MUST go through `src/lib/scoring-authz.server`
 * or query the `client_visible_candidates` view; never bypass either.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CanonicalScoringState } from "@/lib/scoring/canonical-state";

// JSON-serializable so it survives TanStack's server-fn RPC boundary.
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type ScoringOrphan = {
  id: string;
  candidate_match_id: string | null;
  score_run_id: string | null;
  organization_id: string | null;
  reason: string;
  detail: Json;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  detected_at: string;
};

/**
 * List all scoring orphans (platform staff only). Enforced by RLS on
 * `scoring_orphans`; this function is defense in depth.
 */
export const listScoringOrphans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isStaff } = await supabase.rpc("is_platform_staff", {
      _user: userId,
    });
    if (!isStaff) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("scoring_orphans")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as unknown as ScoringOrphan[];
  });

/**
 * Resolve an orphan. Options:
 *  - "relink": point the score_run at a real rubric_version_id.
 *  - "mark_failed": move the candidate_match to canonical_state='failed'
 *    with a reason (does not delete anything).
 *  - "acknowledge": leave the row as-is but mark it resolved (used for
 *    orphans that will be superseded by future runs anyway).
 */
export const resolveScoringOrphan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orphan_id: z.string().uuid(),
        action: z.enum(["mark_failed", "acknowledge"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: isStaff } = await supabase.rpc("is_platform_staff", {
      _user: userId,
    });
    if (!isStaff) throw new Error("Forbidden");

    const { data: orphan, error: readErr } = await supabase
      .from("scoring_orphans")
      .select("*")
      .eq("id", data.orphan_id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!orphan) throw new Error("Orphan not found");

    // Relinking a score_run's rubric_version_id is blocked by the
    // score_runs immutability trigger and needs a dedicated
    // SECURITY DEFINER SQL function; that ships in Prompt 2 alongside the
    // rubric builder. For now, orphans can be acknowledged (left for
    // supersession by a future run) or marked failed at the match level.
    if (data.action === "mark_failed" && orphan.candidate_match_id) {
      const { error: updErr } = await supabase
        .from("candidate_matches")
        .update({ canonical_state: "failed" as CanonicalScoringState })
        .eq("id", orphan.candidate_match_id);
      if (updErr) throw updErr;
    }

    const { error: resolveErr } = await supabase
      .from("scoring_orphans")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_note: data.note ?? null,
      })
      .eq("id", data.orphan_id);
    if (resolveErr) throw resolveErr;

    return { ok: true as const };
  });
