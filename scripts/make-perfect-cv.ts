/**
 * Renders a maximum-score CV for the Northwind demo role.
 *
 * WHY THIS EXISTS
 * The calibration desk reports "Top (85-94): Never produced" and the cohort's
 * best result is 98. Nothing has ever demonstrated that the top of the scale is
 * reachable, so a perfect score is an untested claim. This is the fixture that
 * tests it: a candidate engineered to satisfy every requirement the role
 * declares, so the engine's ceiling can be observed rather than assumed.
 *
 * HOW THE TARGET WAS DERIVED
 * From the cohort's own targets file, Helena Carvalho is the best case at
 * MMMMMM / MMPM — six must-haves met, three preferred met, one partial — and
 * scores 98. The audit's arithmetic on her record reads 60 + 18 + 20 = 98:
 * six must-haves at 10, preferred at 5 (three met, one partial), and a base of
 * 20. All ten satisfied is therefore 60 + 20 + 20 = 100.
 *
 * Her gap is P3. Reading across the cohort dossiers, the ten requirements are:
 *
 *   R1  production React and TypeScript, with years behind it
 *   R2  strong SQL and relational data modelling in Postgres
 *   R3  owning a feature end to end, schema through to shipped UI
 *   R4  row-level security or another multi-tenant isolation model
 *   R5  automated tests, unit and end-to-end
 *   R6  English fluency
 *   P1  multi-tenant SaaS with per-tenant data isolation
 *   P2  early-stage, founder-led team
 *   P3  AI / LLM work shipped as a product feature   <- Helena's partial
 *   P4  Remix, the full-stack React framework        <- named-product gate
 *
 * WHAT THE ENGINE REQUIRES OF THE TEXT
 * These are not decoration; each is a rule this CV is written against.
 *
 *   Named products must be named. The gate credits P4 only from a passage that
 *   contains "Remix" itself, so the word appears in prose, not only in a skills
 *   list.
 *
 *   Substance over keywords. Evidence must clear a minimum length and token
 *   count, so every claim sits in a sentence that says what was built and what
 *   happened — a keyword list would be rejected as an echo.
 *
 *   Negation is detected. No claim is phrased near "no", "not", "without" or
 *   "rather than", which would flip a match to a miss.
 *
 *   Framing words are stripped. "Practical experience with X" derives to X, so
 *   the content terms are what must appear — stating the capability plainly
 *   beats mirroring the requirement's wording.
 *
 *   Each requirement is evidenced in more than one place — summary, a role
 *   bullet, and selected work — so a single unlucky extraction cannot lose it.
 *
 * The person is fictional and the address is on a reserved example domain that
 * cannot receive mail. It is a test fixture, and nothing about it is presented
 * as a real candidate.
 *
 *   bun run scripts/make-perfect-cv.ts [--out <path>]
 */
import { writeFileSync } from "node:fs";
import { renderCvPdf, cvReadingOrder } from "./seed-northwind-demo/cv-pdf";

import { cv } from "./make-perfect-cv-doc";

const outFlag = process.argv.indexOf("--out");
const out =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : "Joao-Kasprzak-CV.pdf";

const bytes = await renderCvPdf(cv);
writeFileSync(out, bytes);

const text = cvReadingOrder(cv).join(" ");
console.log(`Wrote ${out} (${(bytes.length / 1024).toFixed(1)} KB)`);
console.log(`Extractable text: ${text.length} characters`);

// Cheap self-check on the things the engine is strict about, so a bad edit to
// this file is caught before the PDF is uploaded rather than after it scores.
const mustAppear: Array<[string, RegExp]> = [
  ["R1 React + TypeScript", /React and TypeScript/i],
  ["R2 SQL / Postgres modelling", /relational data modelling/i],
  ["R3 end to end ownership", /end to end/i],
  ["R4 row-level security", /row-level security/i],
  ["R5 automated tests", /automated tests/i],
  ["R6 English fluency", /English — fluent/i],
  ["P1 multi-tenant isolation", /multi-tenant isolation|client workspaces/i],
  ["P2 early-stage founder-led", /early-stage, founder-led/i],
  ["P3 LLM shipped in product", /large language model/i],
  ["P4 Remix named in prose", /on Remix, the full-stack React framework/i],
];

let ok = true;
for (const [label, re] of mustAppear) {
  const hit = re.test(text);
  if (!hit) ok = false;
  console.log(`${hit ? "  ok  " : "  MISS"} ${label}`);
}

// Negation near a capability claim flips a match to a miss.
const negated = /\b(no|not|without|never|rather than)\b[^.]{0,40}\b(React|Postgres|row-level security|tests|Remix|language model)\b/i;
if (negated.test(text)) {
  ok = false;
  console.log("  MISS negation detected near a capability claim");
}

if (!ok) {
  console.error("\nOne or more requirements would not be evidenced. Fix before uploading.");
  process.exit(1);
}
console.log("\nAll ten requirements evidenced, no negation near a claim.");
