/**
 * Read-only calibration simulator: renders a dossier's CV through the product's
 * PDF + extractor path and scores it with the product's own engine and the
 * rubric calibration already in force. No writes, no score persisted.
 *
 * Usage: bun run scripts/tmp/sim.ts <slug> [<slug> ...]
 */
import { renderCvPdf } from "../seed-northwind-demo/cv-pdf";
import { TARGETS, bandOf } from "../seed-northwind-demo/targets";

const POSITION_ID = "ee6d2a82-6122-4026-95e4-45a7821b7b7d";
const MARKER = "northwind-demo-2026-08";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  const slugs = process.argv.slice(2);
  const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;
  const { scoreCandidate } = await import("../../src/lib/scoring-engine.server");
  const { extractCvText } = await import("../../src/lib/cv-extractor.server");

  const { data: pos } = await sb
    .from("positions")
    .select("requirements,preferred_requirements")
    .eq("id", POSITION_ID)
    .maybeSingle();
  const requirements = [
    ...(pos.requirements as string[]).map((t, i) => ({ id: `req-${i}`, text: t, required: true, keywords: [] as string[] })),
    ...(pos.preferred_requirements as string[]).map((t, i) => ({ id: `pref-${i}`, text: t, required: false, keywords: [] as string[] })),
  ];

  for (const slug of slugs) {
    const mod = await import(`../seed-northwind-demo/candidates/${slug}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = ((mod as any).dossier ?? (mod as any).default);
    const { data: profile } = await sb
      .from("candidate_profiles")
      .select("id")
      .eq("legacy_source_system", MARKER)
      .ilike("email", d.email)
      .maybeSingle();
    const { data: match } = await sb
      .from("candidate_matches")
      .select("id,application_id")
      .eq("candidate_profile_id", profile.id)
      .maybeSingle();
    const { data: ans } = await sb
      .from("application_answers")
      .select("question_id,answer,screening_questions(question,answer_type,required,dealbreaker)")
      .eq("application_id", match.application_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const screening = (ans ?? []).map((r: any) => {
      const q = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
      const value = r.answer && typeof r.answer === "object" && "value" in r.answer ? r.answer.value : r.answer;
      return {
        question_id: r.question_id,
        question: q?.question ?? "",
        required: q?.required ?? false,
        answer_type: q?.answer_type ?? "text",
        value,
        disqualifying_condition:
          q?.dealbreaker && q?.answer_type === "boolean" ? { operator: "equals" as const, value: false } : null,
      };
    });
    const { data: run } = await sb
      .from("score_runs")
      .select("calibration")
      .eq("candidate_match_id", match.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pdf = await renderCvPdf(d.cv);
    const extracted = await extractCvText(new Uint8Array(pdf), "application/pdf", `${slug}.pdf`);
    const cvText = extracted.text;

    const res = scoreCandidate({
      cv_text: cvText,
      requirements,
      screening,
      calibration: run?.calibration ?? undefined,
    });
    const t = TARGETS[slug];
    const order = ["req-0","req-1","req-2","req-3","req-4","req-5","pref-0","pref-1","pref-2","pref-3"];
    const tgt = t.verdicts
      ? ["R1","R2","R3","R4","R5","R6","P1","P2","P3","P4"].map((k) => (t.verdicts as any)[k])
      : order.map(() => "?");
    const line = order.map((id, i) => {
      const a = res.requirement_assessment.find((x) => x.id === id)!;
      const got = a.status === "met" ? "M" : a.status === "partial" ? "P" : "X";
      const want = tgt[i];
      const ok = want === "?" ? true : want === "M" ? got === "M" : want === "P" ? got === "P" : got !== "M";
      return `${id}=${got}${want === "?" ? "" : `/${want}`}${ok ? "" : "!!"}`;
    }).join(" ");
    console.log(
      `\n${slug}: score=${res.score} band=${bandOf(res.score)} target=${t.band} fit=${res.fit_label} must=${res.must_have_coverage.toFixed(4)} pref=${res.preferred_coverage.toFixed(4)} conf=${res.overall_confidence.toFixed(3)} evid=${res.evidence_confidence} contra=${res.contradiction_status} chars=${norm(cvText).length} pages=${extracted.page_count}`,
    );
    console.log(`  ${line}`);
    for (const a of res.requirement_assessment) {
      console.log(`   ${a.id} ${a.status.padEnd(9)} matched=[${a.matched_terms.join(",")}]`);
    }
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
