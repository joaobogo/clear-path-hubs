/**
 * Backfill candidate_evidence_items from the passages the scoring runs stored.
 *
 * candidate_evidence_items is populated by a step separate from scoring, and
 * that step had never run for the demo workspace. So Northwind — the account
 * shown to prospects — was told on a page titled "Your data advantage" that it
 * held zero evidence items, while its own candidate pages quoted passages
 * against every requirement (audit 1 Sep, F22).
 *
 * The "Your data advantage" tile no longer depends on this table; it counts
 * score_runs.evidence, which is where the passages a client can actually read
 * live. This script populates the table anyway, for the surfaces that index it
 * and so the two never disagree again.
 *
 * Safe to re-run: rows are upserted on (score_run_id, requirement_id, location),
 * so a second pass changes nothing.
 *
 *   node scripts/backfill-evidence-items.mjs --dry-run
 *   node scripts/backfill-evidence-items.mjs --org <uuid>
 *   node scripts/backfill-evidence-items.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ORG = args[args.indexOf("--org") + 1];
const ORG_FILTER = args.includes("--org") && ORG && !ORG.startsWith("--") ? ORG : null;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 500;

async function main() {
  console.log(
    `Backfilling candidate_evidence_items${ORG_FILTER ? ` for org ${ORG_FILTER}` : " for all orgs"}` +
      `${DRY_RUN ? " (dry run — nothing will be written)" : ""}`,
  );

  let from = 0;
  let runsSeen = 0;
  let rowsBuilt = 0;
  let rowsWritten = 0;
  let runsWithNoEvidence = 0;

  for (;;) {
    let q = db
      .from("score_runs")
      .select("id, organization_id, candidate_match_id, evidence, completed_at")
      .not("evidence", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (ORG_FILTER) q = q.eq("organization_id", ORG_FILTER);

    const { data: runs, error } = await q;
    if (error) throw error;
    if (!runs || runs.length === 0) break;

    const rows = [];
    for (const run of runs) {
      runsSeen += 1;
      const evidence = Array.isArray(run.evidence) ? run.evidence : [];
      if (evidence.length === 0) {
        runsWithNoEvidence += 1;
        continue;
      }
      for (const e of evidence) {
        const snippet = typeof e?.snippet === "string" ? e.snippet.trim() : "";
        if (!snippet) continue;
        rows.push({
          score_run_id: run.id,
          organization_id: run.organization_id,
          candidate_match_id: run.candidate_match_id,
          rubric_criterion_key: e?.requirement_id ?? null,
          requirement_text: e?.requirement_text ?? null,
          source_kind: e?.source ?? null,
          source_location: e?.location ?? null,
          quote: snippet,
          created_at: run.completed_at ?? new Date().toISOString(),
        });
      }
    }

    rowsBuilt += rows.length;
    if (rows.length > 0 && !DRY_RUN) {
      const { error: upsertError } = await db
        .from("candidate_evidence_items")
        .upsert(rows, {
          onConflict: "score_run_id,rubric_criterion_key,source_location",
          ignoreDuplicates: true,
        });
      if (upsertError) throw upsertError;
      rowsWritten += rows.length;
    }

    process.stdout.write(`  ${runsSeen} runs read, ${rowsBuilt} passages found\r`);
    if (runs.length < PAGE) break;
    from += PAGE;
  }

  console.log("");
  console.log(`Runs read:               ${runsSeen}`);
  console.log(`Runs with no passages:   ${runsWithNoEvidence}`);
  console.log(`Passages found:          ${rowsBuilt}`);
  console.log(
    DRY_RUN ? "Nothing written (dry run)." : `Rows upserted:           ${rowsWritten}`,
  );
  if (runsSeen === 0) {
    console.log(
      "\nNo runs carried evidence. If that is unexpected, check the org filter " +
        "before concluding the data is missing.",
    );
  }
}

main().catch((e) => {
  console.error("\nBackfill failed:", e?.message ?? e);
  process.exit(1);
});
