/**
 * v1.7.12 — Billing Manager role (24 Nov 2026).
 *
 * A CV listed three earlier jobs on one line, with one period cut by the end
 * of the line, and dated the current job "April 202 – Present". The engine
 * read one year of billing and lost the current role with its team. The CV
 * below has the same shape, with names and employers replaced.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateYearsRequirement,
  findDatedRanges,
  roleBlocks,
} from "@/lib/scoring/structured-requirements";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";

const TODAY = new Date("2026-11-24T00:00:00Z");
const BILLING_YEARS = "5+ years of billing experience";
const TEAM_YEARS = "2+ years managing a team";

const CV = [
  "Jordan Example",
  "Practice Operations Assistant Director Springfield, NJ | 555-010-2233",
  "Professional Experience",
  "Northside Podiatry — Practice Operations Assistant Director",
  "April 202 – Present | Springfield & Riverton, NJ",
  "Direct operations for a multi-site podiatry practice across two locations.",
  "Lead 20 employees (15 onsite, 5 remote) with full hiring, onboarding, coaching, performance",
  "management, and termination authority.",
  "Previous Experience",
  "Medical Biller — Riverton Foot & Ankle Center (2019–2020)Medical Biller — Medi-Sample Inc. (2015–",
  "2019)Assistant Store Manager / Pharmacy Technician — Corner Pharmacy (2012–2015)",
  "Professional Development & Education",
  "• High School Diploma",
].join("\n");

describe("v1.7.12 — two jobs on one line and a period cut by the line end", () => {
  it("reads the period that continues on the next line", () => {
    const raws = findDatedRanges(CV, TODAY).map((s) => s.raw.replace(/\s+/g, ""));
    expect(raws).toContain("2019–2020");
    expect(raws).toContain("2015–2019");
    expect(raws).toContain("2012–2015");
  });

  it("gives each job on a shared line its own words", () => {
    const blocks = roleBlocks(CV, TODAY);
    const second = blocks.find((b) => b.span.raw.replace(/\s+/g, "") === "2015–2019")!;
    expect(second.header).toContain("Medi-Sample Inc.");
    expect(second.header).not.toContain("Riverton Foot & Ankle");
    const first = blocks.find((b) => b.span.raw.replace(/\s+/g, "") === "2019–2020")!;
    expect(first.header).toContain("Riverton Foot & Ankle Center");
    expect(first.header).not.toContain("Medi-Sample");
    const store = blocks.find((b) => b.span.raw.replace(/\s+/g, "") === "2012–2015")!;
    expect(store.header).toContain("Assistant Store Manager");
  });

  it("counts both billing jobs: five years from titles, confirmed at screening", () => {
    const v = evaluateYearsRequirement(BILLING_YEARS, CV, TODAY)!;
    // Was: 1 yr, missing. Titles alone are partial, as for every candidate.
    expect(v.status).toBe("partial");
    expect(v.note).toContain("5 yrs from a title alone");
    expect(v.note).toContain("Medical Biller — Medi-Sample Inc. 2015–2019");
    expect(v.note).not.toContain("( ");
  });

  it("periods with no words between them still share the line", () => {
    const cv = [
      "Work Experience",
      "Billing Specialist, Example Co 2010–2012, 2014–2016",
      "• Prepared and posted client invoices every month.",
    ].join("\n");
    const blocks = roleBlocks(cv, TODAY);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]!.header).toContain("Billing Specialist");
  });

  it("a next line that opens with its own period is not joined", () => {
    const cv = ["Experience", "Analyst, Example Co 2015 –", "2019 – 2021 Manager, Other Co"].join(
      "\n",
    );
    const raws = findDatedRanges(cv, TODAY).map((s) => s.raw.replace(/\s+/g, ""));
    expect(raws).toEqual(["2019–2021"]);
  });
});

describe("v1.7.12 — a current role whose start year lost a digit", () => {
  it("is a dated role with nothing to count", () => {
    const span = findDatedRanges(CV, TODAY).find((s) => s.startUnreadable)!;
    expect(span.raw).toBe("April 202 – Present");
    expect(span.to - span.from).toBe(0);
    const block = roleBlocks(CV, TODAY).find((b) => b.span.startUnreadable)!;
    expect(block.header).toContain("Northside Podiatry");
    expect(block.body).toContain("Lead 20 employees");
    // The role ends at the next section; it does not own the earlier jobs.
    expect(block.body).not.toContain("Medical Biller");
  });

  it("the team it describes is evidence; its length is confirmed at screening", () => {
    const v = evaluateYearsRequirement(TEAM_YEARS, CV, TODAY)!;
    // Was: partial from the store-manager title alone, the team line unread.
    expect(v.status).toBe("partial");
    expect(v.needs_validation).toBe(true);
    expect(v.note).toContain(
      "Managing a team is described in a current role whose start date cannot be read on the CV: Northside Podiatry",
    );
    expect(v.note).toContain("3 yrs from a title alone (Assistant Store Manager");
    expect(v.note).toContain("Against 2 required; confirm the dates at screening.");
    expect(v.note).not.toContain("2019)");
    expect(v.evidence[0]!.snippet).toContain("Lead 20 employees");
  });

  it("a readable year is read as before", () => {
    const cv = CV.replace("April 202 – Present", "April 2020 – Present");
    expect(findDatedRanges(cv, TODAY).some((s) => s.startUnreadable)).toBe(false);
    const v = evaluateYearsRequirement(TEAM_YEARS, cv, TODAY)!;
    expect(v.status).toBe("met");
  });

  it("a three-digit number that is not a start year is left alone", () => {
    const cv = [
      "Experience",
      "Supervisor, Example Co, Suite 202 – present location",
      "March 2018 – Present",
    ].join("\n");
    expect(findDatedRanges(cv, TODAY).some((s) => s.startUnreadable)).toBe(false);
  });

  it("bumps the engine version", () => {
    expect(ENGINE_VERSION).toBe("taasflow-scoring-v1.7.12");
  });
});
