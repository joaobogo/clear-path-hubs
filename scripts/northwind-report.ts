/**
 * Northwind demo cohort read-only calibration report.
 *
 * Prints, per candidate, the latest score run's band, fit label, coverage,
 * confidence and per-requirement verdicts, plus the verified evidence item
 * count and recommendation column state. Reads only — no writes.
 */

import { TARGETS, bandOf } from "./seed-northwind-demo/targets";

const ORG_ID = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed";
const SEED_MARKER = "northwind-demo-2026-08";

async function main() {
  const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  const { data: profiles } = await sb
    .from("candidate_profiles")
    .select("id,email,full_name")
    .eq("legacy_source_system", SEED_MARKER);

  const { data: matches } = await sb
    .from("candidate_matches")
    .select("id,candidate_profile_id,eligibility_status,recommendation,recommendation_reason,stage,admin_status,processing_state")
    .eq("organization_id", ORG_ID)
    .in("candidate_profile_id", (profiles ?? []).map((p: any) => p.id));

  const byProfile = new Map<string, any>();
  for (const m of matches ?? []) byProfile.set(m.candidate_profile_id, m);

  for (const [slug, tv] of Object.entries(TARGETS)) {
    const t = { slug, ...tv } as any;
    const mod = await import(`./seed-northwind-demo/candidates/${t.slug}`);
    const email = ((mod as any).dossier ?? (mod as any).default).email.toLowerCase();
    const p = (profiles ?? []).find((x: any) => x.email.toLowerCase() === email);
    if (!p) { console.log(`${t.slug.padEnd(18)} MISSING PROFILE`); continue; }
    const m = byProfile.get(p.id);
    if (!m) { console.log(`${t.slug.padEnd(18)} MISSING MATCH`); continue; }
    const { data: run } = await sb
      .from("score_runs")
      .select("id,final_score,fit_label,confidence,evidence_confidence,must_have_coverage,preferred_coverage,requirement_coverage,contradiction_status,engine_version,evaluation_method")
      .eq("candidate_match_id", m.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cov = (run?.requirement_coverage ?? {}) as any;
    const asses = (cov.requirement_assessment ?? []) as any[];
    const verdict = asses
      .map((a) => `${a.id}:${a.status === "met" ? "M" : a.status === "partial" ? "P" : "X"}`)
      .join(" ");
    const { count: items } = await sb
      .from("candidate_evidence_items")
      .select("id", { count: "exact", head: true })
      .eq("candidate_match_id", m.id);
    console.log(
      `${t.slug.padEnd(18)} score=${String(run?.final_score ?? "—").padEnd(6)} band=${bandOf(Number(run?.final_score ?? 0)).padEnd(16)} target=${t.band.padEnd(15)} fit=${(run?.fit_label ?? "—").padEnd(18)} must=${run?.must_have_coverage ?? "—"} pref=${run?.preferred_coverage ?? "—"} conf=${run?.confidence ?? "—"} evid=${run?.evidence_confidence ?? "—"} contra=${run?.contradiction_status ?? "—"} elig=${m.eligibility_status} rec=${m.recommendation ?? "—"} items=${items ?? 0}`,
    );
    console.log(`${" ".repeat(18)} ${verdict}`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
