/**
 * A public performance figure says where it came from, or it is not published.
 *
 * /case-studies published POSITIONS DELIVERED 175+, CITIES ENGAGED 18, MEDIAN
 * TIME TO SHORTLIST 7d, CLIENT SHORTLIST RATING 9.1/10, 12-MONTH RETENTION 92%
 * and OFFER ACCEPTANCE 86% under a single page-level hedge, with no source
 * against any individual number (audit 1 Sep, F23).
 *
 * The platform's own records hold one confirmed hire, starting 25 September
 * 2026; the Calibration desk states only 9 scored candidates have any
 * downstream outcome recorded. Several figures may come from recruiting
 * delivered before this platform existed — which is the point, because nothing
 * said so.
 *
 * What made it a finding rather than a marketing opinion is the same domain's
 * Trust Center: "Security and privacy, stated only where we can prove it.
 * Every claim here traces to the platform, an internal control, or a published
 * policy", with a whole section on what it refuses to claim. Two public pages,
 * two standards of evidence.
 *
 * Provenance is a required field, and the render withholds anything without
 * one. This test holds that shut, including against the ways a required field
 * gets satisfied without being answered.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASE_STUDY_METRICS,
  EMPTY_PROVENANCE_PHRASES,
  publishableMetrics,
} from "@/config/case-study-metrics";

const page = readFileSync(join(process.cwd(), "src", "routes", "case-studies.tsx"), "utf8");

describe("published figures carry a source", () => {
  it("publishes only what has been attributed", () => {
    for (const m of publishableMetrics()) {
      expect(m.provenance.trim().length, `${m.label} is published with no source`).toBeGreaterThan(
        0,
      );
    }
  });

  it("does not accept a phrase that says nothing", () => {
    // "Internal data" satisfies a required string and lets nobody check
    // anything, which would turn this gate into paperwork.
    for (const m of publishableMetrics()) {
      const p = m.provenance.trim().toLowerCase();
      for (const empty of EMPTY_PROVENANCE_PHRASES) {
        expect(p, `${m.label}: "${m.provenance}" is not a source`).not.toBe(empty);
      }
      expect(p.length, `${m.label}: "${m.provenance}" is too short to be a source`).toBeGreaterThan(
        12,
      );
    }
  });

  it("renders from the gated list, not from a local array", () => {
    // The finding's original shape: six figures hard-coded in the component,
    // where no gate could reach them.
    expect(page).toMatch(/publishableMetrics\(\)/);
    expect(page, "the page must not rebuild the metric list inline").not.toMatch(
      /value: "175\+"/,
    );
    expect(page).not.toMatch(/value: "92%"/);
  });

  it("shows the source next to the figure", () => {
    expect(page, "a provenance that is not rendered is not a provenance").toMatch(
      /\{m\.provenance\}/,
    );
  });

  it("withholds the whole strip while nothing is attributed", () => {
    // The intended state today. The page keeps its engagements and narrative
    // and gains figures back one at a time as each source is written.
    expect(page).toMatch(/if \(items\.length === 0\) return null;/);
  });

  it("still holds every figure, so none is lost while it waits", () => {
    // Withholding must not become deletion — the numbers stay in the config,
    // ready to publish the moment a source is recorded.
    expect(CASE_STUDY_METRICS.map((m) => m.label)).toEqual([
      "Positions delivered",
      "Cities engaged",
      "Median time to shortlist",
      "Client shortlist rating",
      "12-month retention",
      "Offer acceptance",
    ]);
  });
});
