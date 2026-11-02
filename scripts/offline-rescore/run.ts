/**
 * Offline rescore runner. Usage:
 *   npx tsx scripts/offline-rescore/run.ts <export.json> <out-dir> [reason]
 * <export.json> is the document export.sql returns (the bare object, or a
 * query result wrapping it as rows[0].doc). Writes one <match_id>.sql per
 * scored match plus summary.json; run each of those .sql files against the
 * database.
 *
 * A match the engine refuses (no dated roles) gets refusals/<match_id>.sql
 * instead. It clears the match's score pointer and opens an admin task, so
 * apply one only for a match you have named explicitly, never as part of
 * "run every file": the live pipeline may have scored that match since the
 * export. Both kinds refuse to write if the CV text has changed since the
 * export, and a refusal never clears a human-reviewed published score.
 * Such a match also gets <match_id>.eligibility.sql: its dealbreaker checks,
 * unverified-claim flags and eligibility, without clearing the score pointer.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { offlineRescore, type OfflineContext, type OfflineMatch } from "../../src/lib/scoring/offline-rescore";

const [, , input, outDir, reason = "offline rescore on the current engine"] = process.argv;
if (!input || !outDir) {
  console.error("usage: run.ts <export.json> <out-dir> [reason]");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(input, "utf8"));
const doc = raw?.rows?.[0]?.doc ?? raw?.doc ?? raw;
const ctx: OfflineContext = {
  position: doc.position,
  organisation: doc.organisation ?? null,
  rubric: doc.rubric,
  role_family: doc.role_family ?? null,
  reason,
};
mkdirSync(outDir, { recursive: true });
const summary = (doc.matches as OfflineMatch[]).map((m) => {
  const out = offlineRescore(m, ctx);
  if (out.kind === "no_dated_roles") {
    mkdirSync(join(outDir, "refusals"), { recursive: true });
    writeFileSync(join(outDir, "refusals", `${m.match_id}.sql`), out.sql + "\n");
    writeFileSync(join(outDir, `${m.match_id}.eligibility.sql`), out.eligibility_sql + "\n");
  } else if ("sql" in out) {
    writeFileSync(join(outDir, `${m.match_id}.sql`), out.sql + "\n");
  }
  const { sql: _sql, eligibility_sql: _el, ...rest } = out as typeof out & { sql?: string; eligibility_sql?: string };
  void _sql;
  void _el;
  return rest;
});
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.map((s) => [s.match_id.slice(0, 8), s.kind, "score" in s ? s.score : ("why" in s ? s.why : "")])));
