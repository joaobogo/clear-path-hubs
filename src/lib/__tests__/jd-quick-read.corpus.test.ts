/**
 * The instant job-description read, measured against a corpus of real-shaped
 * descriptions (tests/fixtures/jd).
 *
 * Each fixture has an expected.json written by a person reading the text:
 *  - `fields`  values the description states unambiguously (counted for recall)
 *  - `empty`   fields the description does NOT state; the reader must leave them
 *              empty, because a wrong pre-fill is worse than none
 *  - `skip`    the rare field where two honest readings exist; not scored
 *
 * Precision must be 100%: not one wrong value across the corpus. Recall is
 * printed per field and held above a floor, so it can only go up.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeJdText, quickReadJd } from "@/lib/jd-quick-read";
import type { JdBlueprint } from "@/lib/jd-blueprint";

const DIR = join(process.cwd(), "tests/fixtures/jd");
const NOW = new Date("2026-10-08T12:00:00Z");
const FIELDS = [
  "title", "team", "seniority", "location", "workModel", "employmentType", "salaryMin", "salaryMax",
  "currency", "compensationPeriod", "targetStartDate", "requiresExistingWorkAuth",
] as const;
type FieldKey = (typeof FIELDS)[number];

type Expected = {
  fields: Partial<Record<FieldKey, string | number | boolean>>;
  empty: FieldKey[];
  skip: FieldKey[];
  requirements: { must: string[]; nice: string[]; none: boolean };
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const names = readdirSync(DIR)
  .filter((f) => f.endsWith(".txt"))
  .map((f) => f.replace(/\.txt$/, ""))
  .sort();

const corpus = names.map((name) => ({
  name,
  text: readFileSync(join(DIR, `${name}.txt`), "utf8"),
  expected: JSON.parse(readFileSync(join(DIR, `${name}.expected.json`), "utf8")) as Expected,
}));

/** Recall floors, measured on this corpus. Raise them when the reader improves; never lower them. */
const RECALL_FLOOR: Record<FieldKey, number> = {
  title: 1,
  team: 1,
  seniority: 1,
  location: 1,
  workModel: 1,
  employmentType: 1,
  salaryMin: 1,
  salaryMax: 1,
  currency: 1,
  compensationPeriod: 1,
  targetStartDate: 1,
  requiresExistingWorkAuth: 1,
};
const REQUIREMENT_RECALL_FLOOR = 1;

function valueOf(bp: JdBlueprint, k: FieldKey): unknown {
  return (bp[k] as { value: unknown } | undefined)?.value;
}

describe("quickReadJd over the fixture corpus", () => {
  it("has a big, complete corpus", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(30);
    for (const c of corpus) {
      const declared = new Set<string>([...Object.keys(c.expected.fields), ...c.expected.empty, ...c.expected.skip]);
      for (const f of FIELDS) expect(declared.has(f), `${c.name} must declare ${f}`).toBe(true);
    }
  });

  const tally = Object.fromEntries(FIELDS.map((f) => [f, { expected: 0, found: 0, wrong: 0, falseFill: 0 }])) as Record<
    FieldKey,
    { expected: number; found: number; wrong: number; falseFill: number }
  >;
  const req = { expected: 0, found: 0, wrongTag: 0, invented: 0, extracted: 0 };
  const errors: string[] = [];
  const misses: string[] = [];

  for (const c of corpus) {
    const { blueprint, requirements } = quickReadJd(c.text, { now: NOW });
    for (const f of FIELDS) {
      const got = valueOf(blueprint, f);
      if (f in c.expected.fields) {
        const want = c.expected.fields[f];
        tally[f].expected += 1;
        if (got === undefined) {
          misses.push(`${c.name}: ${f}`);
          continue;
        }
        if (got === want) tally[f].found += 1;
        else {
          tally[f].wrong += 1;
          errors.push(`${c.name}: ${f} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
        }
      } else if (c.expected.empty.includes(f) && got !== undefined) {
        tally[f].falseFill += 1;
        errors.push(`${c.name}: ${f} must stay empty, got ${JSON.stringify(got)}`);
      }
    }
    // Requirements: every expected item found with the right tag; nothing invented.
    const source = fold(normalizeJdText(c.text));
    req.extracted += requirements.length;
    for (const r of requirements) {
      const probe = fold(r.text).slice(0, 24);
      if (!source.includes(probe)) {
        req.invented += 1;
        errors.push(`${c.name}: requirement not in the text: ${r.text}`);
      }
    }
    if (c.expected.requirements.none && requirements.length > 0) {
      req.invented += requirements.length;
      errors.push(`${c.name}: expected no requirements, got ${requirements.map((r) => r.text).join(" | ")}`);
    }
    const check = (needles: string[], tag: "must_have" | "nice_to_have") => {
      for (const n of needles) {
        req.expected += 1;
        const hit = requirements.find((r) => fold(r.text).includes(fold(n)));
        if (!hit) {
          misses.push(`${c.name}: requirement "${n}"`);
          continue;
        }
        if (hit.tag === tag) req.found += 1;
        else {
          req.wrongTag += 1;
          errors.push(`${c.name}: requirement "${n}" tagged ${hit.tag}, expected ${tag}`);
        }
      }
    };
    check(c.expected.requirements.must, "must_have");
    check(c.expected.requirements.nice, "nice_to_have");
  }

  it("prints per-field precision and recall", () => {
    const rows = FIELDS.map((f) => {
      const t = tally[f];
      const recall = t.expected ? t.found / t.expected : 1;
      return `${f.padEnd(26)} recall ${(recall * 100).toFixed(0).padStart(3)}%  (${t.found}/${t.expected})  wrong ${t.wrong}  false-fill ${t.falseFill}`;
    });
    rows.push(
      `${"requirements".padEnd(26)} recall ${((req.found / Math.max(1, req.expected)) * 100).toFixed(0).padStart(3)}%  (${req.found}/${req.expected})  wrong-tag ${req.wrongTag}  invented ${req.invented}  extracted ${req.extracted}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `\nquickReadJd corpus (${corpus.length} descriptions)\n${rows.join("\n")}\nnot read (left empty): ${misses.length ? misses.join("; ") : "none"}\n`,
    );
    expect(rows.length).toBe(FIELDS.length + 1);
  });

  it("is never wrong (precision 100%)", () => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  it("holds the recall floor for every field", () => {
    for (const f of FIELDS) {
      const t = tally[f];
      if (t.expected === 0) continue;
      expect(t.found / t.expected, `${f} recall`).toBeGreaterThanOrEqual(RECALL_FLOOR[f]);
    }
    expect(req.found / req.expected, "requirements recall").toBeGreaterThanOrEqual(REQUIREMENT_RECALL_FLOOR);
  });
});
