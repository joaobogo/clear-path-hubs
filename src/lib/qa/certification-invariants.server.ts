/**
 * Live certification invariants.
 *
 * The certification report used to be hand-maintained, so its numbers drifted
 * away from the database the app actually talks to. This module is the single
 * source of truth: it reads the same Supabase project the app uses (server
 * admin client, service role) and returns the counts verbatim. Anything that
 * publishes a certification figure must call this, never a stored snapshot.
 */

import { EXPECTED_ACTIVE_PLATFORM_ADMINS } from "@/lib/qa/consistency.server";

export type CertificationInvariants = {
  generated_at: string;
  supabase_project: string;
  database_invariants: {
    total_matches: number;
    matches_with_score_run: number;
    matches_with_approved_score_run: number;
    matches_scored: number;
    matches_manual_review_required: number;
    matches_failed: number;
    audit_events_total: number;
    active_platform_admin_memberships: number;
    expected_active_platform_admin_memberships: number;
    master_admins_active: number;
  };
  consistent: boolean;
  mismatches: string[];
};

export async function collectCertificationInvariants(): Promise<CertificationInvariants> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  const countMatches = async (filter?: (q: any) => any) => {
    let query = sb.from("candidate_matches").select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count, error } = await query;
    if (error) throw new Error(`candidate_matches count failed: ${error.message}`);
    return count ?? 0;
  };

  const totalMatches = await countMatches();
  const withRun = await countMatches((q) => q.not("current_score_run_id", "is", null));
  const withApproved = await countMatches((q) => q.not("approved_score_run_id", "is", null));
  const scored = await countMatches((q) => q.eq("processing_state", "scored"));
  const manualReview = await countMatches((q) => q.eq("processing_state", "manual_review_required"));
  const failed = await countMatches((q) => q.eq("processing_state", "failed"));

  const { count: auditEvents } = await sb
    .from("audit_events")
    .select("*", { count: "exact", head: true });

  const { count: activeAdmins } = await sb
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("role", "platform_admin")
    .eq("status", "active");

  const { count: masterAdmins } = await sb
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("role", "platform_admin")
    .eq("status", "active")
    .eq("is_master_admin", true);

  const mismatches: string[] = [];
  if ((activeAdmins ?? 0) !== EXPECTED_ACTIVE_PLATFORM_ADMINS) {
    mismatches.push(
      `active platform_admin memberships: expected ${EXPECTED_ACTIVE_PLATFORM_ADMINS}, found ${activeAdmins ?? 0}`,
    );
  }
  if ((masterAdmins ?? 0) !== 1) {
    mismatches.push(`master admins active: expected 1, found ${masterAdmins ?? 0}`);
  }
  if (withRun > scored + manualReview) {
    mismatches.push(
      `matches with a score run (${withRun}) exceed scored + manual review (${scored + manualReview})`,
    );
  }

  return {
    generated_at: new Date().toISOString(),
    supabase_project: process.env["SUPABASE_PROJECT_ID"] ?? "unknown",
    database_invariants: {
      total_matches: totalMatches,
      matches_with_score_run: withRun,
      matches_with_approved_score_run: withApproved,
      matches_scored: scored,
      matches_manual_review_required: manualReview,
      matches_failed: failed,
      audit_events_total: auditEvents ?? 0,
      active_platform_admin_memberships: activeAdmins ?? 0,
      expected_active_platform_admin_memberships: EXPECTED_ACTIVE_PLATFORM_ADMINS,
      master_admins_active: masterAdmins ?? 0,
    },
    consistent: mismatches.length === 0,
    mismatches,
  };
}
