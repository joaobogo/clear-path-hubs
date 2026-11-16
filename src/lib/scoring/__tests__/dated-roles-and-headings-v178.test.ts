/**
 * v1.7.8 — three applicants on the Billing Manager role (16 Nov 2026).
 *
 * A contract accountant with six dated roles was parked as "no dated
 * employment history". Two readings failed together: an employer named
 * "Board of Education" was taken for the Education heading and ended the
 * work history, and the one role above it ended on a full date ("April 29,
 * 2025"), which was not read. A controller's current role, dated "03/2026 –
 * to present", was dropped, and the parser fallback stored a certificate
 * ("MS Word 2007") as a degree and a page footer as an employer.
 */
import { describe, expect, it } from "vitest";
import { employmentIntervals, yearsFromEmploymentDates } from "@/lib/cv/employment-dates";
import { evaluateYearsRequirement, findDatedRanges } from "@/lib/scoring/structured-requirements";
import { outlineCv } from "@/lib/cv/cv-outline";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import { CONTRACT_ACCOUNTANT_CV, CONTROLLER_CV } from "./fixtures/billing-manager-v177";

const TODAY = new Date("2026-11-16T00:00:00Z");
const cv = (...ls: string[]) => ls.join("\n");
const ym = (span: { from: number; to: number }) => [
  `${Math.floor(span.from / 12)}-${(span.from % 12) + 1}`,
  `${Math.floor(span.to / 12)}-${(span.to % 12) + 1}`,
];

describe("a month may carry its day", () => {
  it("reads 'July 2024 – April 29, 2025' as July 2024 to April 2025", () => {
    const spans = findDatedRanges("Accountant (Contract) July 2024 – April 29, 2025", TODAY);
    expect(spans.map(ym)).toEqual([["2024-7", "2025-4"]]);
    expect(spans[0]!.raw).toBe("July 2024 – April 29, 2025");
  });

  it("reads a day on either side, with or without the comma or an ordinal", () => {
    const spans = findDatedRanges(
      cv("Clerk, March 3, 2019 - June 30 2021", "Analyst | Sept 1st, 2021 – Oct 2022"),
      TODAY,
    );
    expect(spans.map(ym)).toEqual([
      ["2019-3", "2021-6"],
      ["2021-9", "2022-10"],
    ]);
  });

  it("the employment gate reads the same date", () => {
    const text = cv("PROFESSIONAL EXPERIENCE", "Accountant (Contract) July 2024 – April 29, 2025");
    expect(employmentIntervals(text, TODAY)).toHaveLength(1);
  });
});

describe("a dash followed by 'to' is one separator", () => {
  it("reads '03/2026 – to present' as an open range", () => {
    const spans = findDatedRanges("Senior Accountant 03/2026 – to present", TODAY);
    expect(spans.map(ym)).toEqual([["2026-3", "2026-11"]]);
    expect(spans[0]!.open).toBe(true);
  });

  it("still reads '– today' and '- to date'", () => {
    expect(findDatedRanges("Analyst Jan 2024 – today", TODAY)).toHaveLength(1);
    expect(findDatedRanges("Analyst Jan 2024 - to date", TODAY)).toHaveLength(1);
  });
});

describe("a heading word inside an employer's name is not a heading", () => {
  it("'Board of Education' does not end the work history", () => {
    const text = cv(
      "PROFESSIONAL EXPERIENCE",
      "Riverton Board of Education – Riverton, NJ",
      "Accountant (Contract) Feb 2024 – June 2024",
      "Lakeside Board of Education – Lakeside, NJ",
      "Accountant Nov 2022 – Nov 2023",
    );
    expect(employmentIntervals(text, TODAY)).toHaveLength(2);
  });

  it("the Education heading still ends it, in capitals or at the start of a line", () => {
    const caps = cv("WORK EXPERIENCE", "Clerk Jan 2020 – Dec 2021", "EDUCATION", "BSc 2015 – 2018");
    const title = cv(
      "Work Experience",
      "Clerk Jan 2020 – Dec 2021",
      "Education",
      "BSc 2015 – 2018",
    );
    expect(employmentIntervals(caps, TODAY)).toHaveLength(1);
    expect(employmentIntervals(title, TODAY)).toHaveLength(1);
  });

  it("the whole CV that was parked now reads as six roles", () => {
    expect(employmentIntervals(CONTRACT_ACCOUNTANT_CV, TODAY)).toHaveLength(6);
    expect(yearsFromEmploymentDates(CONTRACT_ACCOUNTANT_CV, TODAY)).toBe(5);
    expect(findDatedRanges(CONTRACT_ACCOUNTANT_CV, TODAY)).toHaveLength(6);
  });

  it("and its years are counted for what the requirement asks", () => {
    // Billing is one task among AP and AR in three of the six roles.
    const billing = evaluateYearsRequirement(
      "5+ years of billing experience",
      CONTRACT_ACCOUNTANT_CV,
      TODAY,
    )!;
    expect(billing.status).toBe("missing");
    expect(billing.note).toContain("2.7 yrs from:");
    const team = evaluateYearsRequirement(
      "2+ years managing a team",
      CONTRACT_ACCOUNTANT_CV,
      TODAY,
    )!;
    expect(team.status).toBe("missing");
    expect(team.note).toBe(
      "None of the 6 dated roles on the CV shows managing a team, against 2 years required.",
    );
  });
});

describe("the parser fallback", () => {
  it("does not take a page footer or the candidate's own name for an employer", () => {
    const o = outlineCv(CONTRACT_ACCOUNTANT_CV, TODAY);
    expect(o.full_name).toBe("Sam Rivera");
    expect(o.experience.map((r) => `${r.title} @ ${r.company}`)).toEqual([
      "Accountant (Contract) @ Harbor Seafood Data",
      "Accountant (Contract) @ Riverton Board of Education",
      "Accountant @ Lakeside Board of Education",
      "Accounts Receivable Analyst (Contract) @ Stoneworks Property Restoration",
      "Accounts Receivable Analyst (Contract) @ Genline Life Sciences",
      "Accounts Receivable Analyst @ Crestline Insurance",
    ]);
    expect(o.experience[0]).toMatchObject({ start: "July 2024", end: "April 29, 2025" });
  });

  it("keeps the current role dated '– to present' and reads the degree, not the certificates", () => {
    const o = outlineCv(CONTROLLER_CV, TODAY);
    expect(o.experience[0]).toMatchObject({
      title: "Senior Accountant",
      company: "ColdPak Logistics",
      start: "03/2026",
      end: "present",
    });
    expect(o.education).toEqual([
      {
        school: "BALTIC UNIVERSITY OF TECHNOLOGY",
        degree: "bachelor’s degree",
        field: "business administration and management /Accounting",
        year: "1995",
      },
    ]);
  });

  it("a bare abbreviation is a degree only beside a school", () => {
    const withSchool = outlineCv(
      cv("Pat Doe", "EDUCATION", "MS, Data Science, Northfield University, 2019"),
      TODAY,
    );
    expect(withSchool.education).toHaveLength(1);
    const product = outlineCv(cv("Pat Doe", "EDUCATION", "MS Word 2007", "MS Excel 2010"), TODAY);
    expect(product.education).toEqual([]);
  });
});

it("carries an engine version", () => {
  expect(ENGINE_VERSION).toMatch(/^taasflow-scoring-v1\.\d+\.\d+$/);
});
