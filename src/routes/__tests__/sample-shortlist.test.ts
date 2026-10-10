import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_LABEL,
  SAMPLE_SHORTLIST_REQUIREMENTS,
} from "@/lib/previews/representative-fixtures";
import { OFFER_LAST_REVIEWED, OFFER_LAST_UPDATED_LABEL } from "@/config/offer-facts";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("sample shortlist fixture", () => {
  it("has ten ranked candidates with one score each", () => {
    expect(SAMPLE_SHORTLIST).toHaveLength(10);
    SAMPLE_SHORTLIST.forEach((c, i) => {
      expect(c.rank).toBe(i + 1);
      expect(Number.isInteger(c.score)).toBe(true);
      if (i > 0) expect(c.score).toBeLessThanOrEqual(SAMPLE_SHORTLIST[i - 1].score);
      const mean =
        SAMPLE_SHORTLIST_REQUIREMENTS.reduce((a, q) => a + c.results[q.key].score, 0) /
        SAMPLE_SHORTLIST_REQUIREMENTS.length;
      expect(c.score).toBe(Math.round(mean));
      for (const q of SAMPLE_SHORTLIST_REQUIREMENTS) {
        expect(c.results[q.key].evidence.length).toBeGreaterThan(10);
      }
    });
  });

  it("uses no real names and is labelled as example data", () => {
    expect(SAMPLE_SHORTLIST_LABEL).toMatch(/example data, not a client result/i);
    for (const c of SAMPLE_SHORTLIST) expect(c.ref).toMatch(/^Example candidate/);
  });
});

describe("sample shortlist page and links", () => {
  const page = read("src/routes/sample-shortlist.tsx");
  it("is noindex, labelled, and carries both CTAs and a breadcrumb", () => {
    expect(page).toContain('robots: "noindex,follow"');
    expect(page).toContain("SAMPLE_SHORTLIST_LABEL");
    expect(page).toContain("CTA_PRIMARY");
    expect(page).toContain("CTA_MESSAGE");
    expect(page).toContain("breadcrumbs");
  });
  it("is linked from the homepage hero and the pilot page", () => {
    for (const f of ["src/components/home/run-hero.tsx", "src/routes/pilot.tsx"]) {
      const src = read(f);
      expect(src).toContain('to="/sample-shortlist"');
      expect(src).toContain("See a sample top 10");
    }
  });
});

describe("Last updated line", () => {
  it("is derived from one constant and shown on pricing, pilot and home", () => {
    expect(OFFER_LAST_REVIEWED).toBe("7 October 2026");
    expect(OFFER_LAST_UPDATED_LABEL).toBe("Last updated: 7 October 2026");
    for (const f of ["src/routes/pricing.tsx", "src/routes/pilot.tsx", "src/routes/index.tsx"]) {
      const src = read(f);
      expect(src).toContain("OFFER_LAST_UPDATED_LABEL");
      expect(src).not.toMatch(/Last updated: \d/);
    }
  });
});
