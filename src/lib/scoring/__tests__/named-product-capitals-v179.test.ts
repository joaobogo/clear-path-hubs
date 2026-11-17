/**
 * v1.7.9 — a product named with capitals inside it is a named product.
 *
 * "Hands-on with QuickBooks and Caret or comparable billing software, plus
 * strong Excel": Caret and Excel were read as named products, QuickBooks was
 * not (it was looked for as "Quickbooks"). A controller's CV that lists
 * QuickBooks in four roles, and Microsoft Office rather than Excel, was then
 * marked missing for naming none of the products (Billing Manager role, 16
 * Nov 2026).
 */
import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";

const TODAY = new Date("2026-11-16T00:00:00Z");
const SOFTWARE = {
  id: "pref-3",
  text: "Hands-on with QuickBooks and Caret or comparable billing software, plus strong Excel",
  required: false,
  keywords: [],
};
const BODY = [
  "Ina Balt",
  "PROFESSIONAL EXPERIENCE",
  "Rose Bath Co",
  "Accountant | 01/2022 – 03/2026",
  "• Manage full-cycle accounting, including general ledger, journal entries, reconciliations, and period-end close.",
  "• Oversee HR and payroll processing and reporting for the whole company every month of the year.",
  "• Prepare financial reports, performance variance, and trend analysis for management.",
];
const row = (lines: string[], requirement = SOFTWARE) =>
  scoreCandidate({
    cv_text: [...BODY, ...lines].join("\n"),
    requirements: [requirement],
    screening: [],
    as_of: TODAY,
  }).requirement_assessment[0]!;

describe("a product named with capitals inside it", () => {
  it("QuickBooks on the CV is evidence for a requirement that names QuickBooks", () => {
    const a = row(["• Systems: QuickBooks Online, Square, Wix, Microsoft Office Suite."]);
    expect(a.matched_terms).toContain("quickbooks");
    expect(a.status).toBe("partial");
    expect(a.needs_validation).toBe(false);
  });

  it("one of three named products is partial, not met", () => {
    const a = row(["• Systems: QuickBooks Enterprise, Microsoft Excel."]);
    expect(a.status).toBe("partial");
  });

  it("generic overlap with none of the named products is still refused", () => {
    const a = row(["Utilized NetSuite and Salesforce for accounting functions."]);
    expect(a.status).toBe("missing");
    expect(a.needs_validation).toBe(true);
  });

  it("a requirement naming one mixed-case product is met by that product", () => {
    const a = row(["• Built the monthly close in NetSuite and trained two colleagues on it."], {
      id: "req-x",
      text: "Experience with NetSuite or a similar accounting system",
      required: true,
      keywords: [],
    });
    expect(a.status).toBe("met");
  });

  it("abbreviations in capitals are read as before", () => {
    const a = row(["• Member of the site food safety team for three years."], {
      id: "pref-2",
      text: "Food safety team experience (HACCP, TACCP, VACCP, BRC)",
      required: false,
      keywords: [],
    });
    // Not a named-product refusal: the team experience still counts in part.
    expect(a.status).toBe("partial");
  });

  it("carries an engine version", () => {
    expect(ENGINE_VERSION).toMatch(/^taasflow-scoring-v1\.\d+\.\d+$/);
  });
});
