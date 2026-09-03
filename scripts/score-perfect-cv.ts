/**
 * Scores the fixture CV against the demo role's requirements, using the real
 * engine, before anything is uploaded.
 *
 * scoreCandidate is pure — CV text in, verdicts out — so the fixture's claim to
 * be a maximum-score CV can be checked here rather than discovered after an
 * upload. The requirement texts below are reconstructed from the cohort
 * dossiers (each candidate's R1-R6 / P1-P4 evidence lines) and the golden
 * corpus, which quotes two of them verbatim.
 *
 *   bun run scripts/score-perfect-cv.ts
 */
import { scoreCandidate } from "../src/lib/scoring-engine.server";
import { cvReadingOrder } from "./seed-northwind-demo/cv-pdf";
import { cv } from "./make-perfect-cv-doc";

// Re-import the document the renderer uses, so the text scored here is the text
// that ends up in the PDF.

const cv_text = cvReadingOrder(cv).join("\n");

// `required: true` is what marks a must-have; there is no `importance` field.
const must = (text: string) => ({ id: text.slice(0, 28), text, required: true, keywords: [] });
const pref = (text: string) => ({ id: text.slice(0, 28), text, required: false, keywords: [] });

const requirements = [
  must("Nine years building production React and TypeScript applications"),
  must("Strong SQL and relational data modelling in Postgres"),
  must("Owns features end to end, from schema design to shipped UI"),
  must("Practical experience with row-level security or another multi-tenant isolation model"),
  must("Comfortable writing and maintaining automated tests (unit and end-to-end)"),
  must("Fluent English, written and spoken"),
  pref("Multi-tenant SaaS with per-tenant data isolation"),
  pref("Experience in an early-stage, founder-led team"),
  pref("Exposure to AI or large language model features in production"),
  pref("Experience with Remix, the full-stack React framework"),
];

const result = scoreCandidate({ cv_text, requirements, screening: [] });

console.log(`engine ${result.engine_version} / ${result.calibration_version}`);
console.log(`score  ${result.score}  (raw ${result.raw_score})`);
console.log(`must-have coverage  ${Math.round(result.must_have_coverage * 100)}%`);
console.log(`preferred coverage  ${Math.round(result.preferred_coverage * 100)}%`);
if (result.applied_caps.length) console.log(`caps: ${JSON.stringify(result.applied_caps)}`);
console.log("");

let met = 0;
for (const r of result.requirement_assessment) {
  const status = String((r as Record<string, unknown>).status ?? "");
  if (status === "met") met += 1;
  const req = (r as Record<string, unknown>).required ? "must" : "pref";
  const mark = (status === "met" ? "MET" : status === "partial" ? "PARTIAL" : status.toUpperCase()).padEnd(8);
  const label = String((r as Record<string, unknown>).text ?? "");
  console.log(`${mark} ${req}  ${label.slice(0, 66)}`);
  if (status !== "met") {
    const rec = r as Record<string, unknown>;
    console.log(`         derived : ${JSON.stringify(rec.keywords ?? rec.derived_terms ?? "?")}`);
    console.log(`         matched : ${JSON.stringify(rec.matched_terms ?? [])}`);
  }
}

console.log("");
console.log(`${met} of ${requirements.length} requirements met`);
if (met < requirements.length) {
  console.error("Not a maximum-score CV - the lines above show what is not landing.");
  process.exit(1);
}
console.log("Every requirement met.");
