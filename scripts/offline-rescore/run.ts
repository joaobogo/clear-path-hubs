/**
 * Offline rescore runner. Usage:
 *   npx tsx scripts/offline-rescore/run.ts <export.json> <out-dir> [reason]
 * <export.json> is the document export.sql returns (the bare object, or a
 * query result wrapping it as rows[0].doc). Writes one <match_id>.sql per
 * match plus summary.json; run each .sql against the database. A match whose
 * CV has no dated roles also gets <match_id>.eligibility.sql: its dealbreaker
 * checks, unverified-claim flags and eligibility without the <match_id>.sql
 * step that clears the current score pointer (which would drop a reviewed
 * score).
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
const ctx: OfflineContext = { position: doc.position, rubric: doc.rubric, role_family: doc.role_family ?? null, reason };
mkdirSync(outDir, { recursive: true });
const summary = (doc.matches as OfflineMatch[]).map((m) => {
  const out = offlineRescore(m, ctx);
  if ("sql" in out) writeFileSync(join(outDir, `${m.match_id}.sql`), out.sql + "\n");
  // A CV with no dated roles: the eligibility block alone (flags, dealbreaker
  // checks, recruiter decisions) without clearing the current score pointer.
  if (out.kind === "no_dated_roles") writeFileSync(join(outDir, `${m.match_id}.eligibility.sql`), out.eligibility_sql + "\n");
  const { sql: _sql, eligibility_sql: _el, ...rest } = out as typeof out & { sql?: string; eligibility_sql?: string };
  void _sql;
  void _el;
  return rest;
});
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.map((s) => [s.match_id.slice(0, 8), s.kind, "score" in s ? s.score : ("why" in s ? s.why : "")])));
