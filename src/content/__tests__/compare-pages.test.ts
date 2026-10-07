import { describe, expect, it } from "vitest";
import { COMPARE_PAGES } from "@/content/compare-pages";
import { COMPETITOR_FACTS } from "@/content/competitor-facts";
import { PACKAGES, formatUsdExact } from "@/config/pricing-core";
import { EXAMPLE_ROWS, EXAMPLE_SALARY_USD } from "@/content/compare-pages";

const text = (p: (typeof COMPARE_PAGES)[number]) =>
  JSON.stringify([p.directAnswer, p.sections, p.faqs, p.title, p.description]);

describe("compare pages", () => {
  it("have unique canonical paths", () => {
    const paths = COMPARE_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
  it("have question-form H2s", () => {
    for (const p of COMPARE_PAGES) for (const s of p.sections) expect(s.h2.endsWith("?")).toBe(true);
  });
  it("every competitor fact has sourceUrl and accessedOn", () => {
    for (const f of COMPETITOR_FACTS) {
      expect(f.sourceUrl).toMatch(/^https:\/\//);
      expect(f.accessedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("only contain prices from pricing-core, competitor facts or the labelled example", () => {
    const allowed = new Set<string>([
      ...PACKAGES.map((p) => p.totalDisplay),
      formatUsdExact(EXAMPLE_SALARY_USD),
      ...EXAMPLE_ROWS.map((r) => formatUsdExact(r.fee)),
    ]);
    const factText = JSON.stringify(COMPETITOR_FACTS);
    for (const p of COMPARE_PAGES) {
      for (const raw of text(p).match(/\$[\d,]+/g) ?? []) {
        const m = raw.replace(/,$/, "");
        expect(allowed.has(m) || factText.includes(m), `${p.path}: ${m}`).toBe(true);
      }
    }
  });
  it("do not repeat paragraphs across pages", () => {
    const seen = new Map<string, string>();
    for (const p of COMPARE_PAGES)
      for (const s of p.sections)
        for (const para of s.paragraphs) {
          expect(seen.get(para), `${p.path} repeats ${seen.get(para)}`).toBeUndefined();
          seen.set(para, p.path);
        }
  });
  it("FAQ entries are non-empty (JSON-LD is built from the same array)", () => {
    for (const p of COMPARE_PAGES) for (const f of p.faqs) expect(f.q && f.a).toBeTruthy();
  });
});
