/**
 * Certification runner.
 *
 * Reads the live database the app uses (SUPABASE_URL + service role, exactly
 * like the app's server code) and rewrites the certification report's
 * database_invariants block. Run with:
 *
 *   bun run scripts/run-certification.ts
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { collectCertificationInvariants } from "../src/lib/qa/certification-invariants.server";

const JSON_PATH = "reports/final-certification/TAASFLOW_V2_FINAL.json";
const MD_PATH = "reports/final-certification/TAASFLOW_V2_FINAL.md";
const MARKER_START = "<!-- LIVE-INVARIANTS:START -->";
const MARKER_END = "<!-- LIVE-INVARIANTS:END -->";

function markdownBlock(inv: Awaited<ReturnType<typeof collectCertificationInvariants>>): string {
  const d = inv.database_invariants;
  return [
    MARKER_START,
    `### Live database invariants (read ${inv.generated_at})`,
    "",
    "| Invariant | Value | Query | Read at |",
    "| --- | --- | --- | --- |",
    `| Rows in candidate_matches | **${d.total_matches}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Rows in score_runs | **${d.score_runs_total}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Completed score runs | **${d.completed_score_runs_total}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Matches with a completed score run | **${d.matches_with_completed_score_runs}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| With a current score run | **${d.matches_with_score_run}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| With an approved score run | **${d.matches_with_approved_score_run}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Marked scored | **${d.matches_scored}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Marked manual review required | **${d.matches_manual_review_required}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Marked failed | **${d.matches_failed}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Audit events recorded | **${d.audit_events_total}** | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Active platform_admin memberships | **${d.active_platform_admin_memberships}** (expected ${d.expected_active_platform_admin_memberships}) | Q1 | ${inv.query_provenance.ran_at} |`,
    `| Active master admins | **${d.master_admins_active}** (expected 1) | Q1 | ${inv.query_provenance.ran_at} |`,
    "",
    inv.consistent
      ? "All live invariants match their expected values."
      : `Mismatches: ${inv.mismatches.join("; ")}`,
    "",
    "#### Query provenance",
    "",
    ...inv.query_provenance.queries.flatMap((query) => [
      `**${query.id} — ${query.description}**`,
      "",
      "```sql",
      query.sql,
      "```",
      "",
    ]),
    MARKER_END,
  ].join("\n");
}

async function main() {
  const inv = await collectCertificationInvariants();
  console.log(JSON.stringify(inv, null, 2));

  if (existsSync(JSON_PATH)) {
    const report = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    report.database_invariants = inv.database_invariants;
    report.invariants_read_at = inv.generated_at;
    report.query_provenance = inv.query_provenance;
    writeFileSync(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (existsSync(MD_PATH)) {
    const md = readFileSync(MD_PATH, "utf8");
    const block = markdownBlock(inv);
    const start = md.indexOf(MARKER_START);
    const end = md.indexOf(MARKER_END);
    const next =
      start !== -1 && end !== -1
        ? `${md.slice(0, start)}${block}${md.slice(end + MARKER_END.length)}`
        : `${md.trimEnd()}\n\n${block}\n`;
    writeFileSync(MD_PATH, next);
  }

  if (!inv.consistent) {
    console.error("CERTIFICATION INVARIANTS FAILED:", inv.mismatches.join(", "));
    process.exit(1);
  }
  console.log("Certification invariants match the live database.");
}

main().catch((error) => {
  console.error("Certification runner error:", error);
  process.exit(1);
});
