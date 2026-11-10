/**
 * v1.7.6 — found rescoring the Billing Manager (Law Firm) role (10 Nov 2026).
 *
 * 1. Roles dated with full US dates ("10/18/21 – 9/12/2022") count towards
 *    years of experience. They were skipped, so a CV dated that way showed
 *    4.2 of its 10.2 years.
 * 2. A screening question whose must-have names the requirement word for word
 *    speaks for it. "5+ years of billing experience" shares one content word
 *    with itself, so a "yes" to its own question had stopped counting.
 */
import { describe, expect, it } from "vitest";
import { evaluateYearsRequirement, findDatedRanges } from "@/lib/scoring/structured-requirements";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";

const TODAY = new Date("2026-11-10T00:00:00Z");
const cv = (...ls: string[]) => ls.join("\n");
const ym = (span: { from: number; to: number }) => [
  `${Math.floor(span.from / 12)}-${(span.from % 12) + 1}`,
  `${Math.floor(span.to / 12)}-${(span.to % 12) + 1}`,
];

// The shape of the CV that showed the gap: month/year on the first page, full
// dates on the next.
const FULL_DATES_CV = cv(
  "Work Experience",
  "MIZUHO BANK| 7/2024 – PRESENT",
  "Assistant Vice President of Credit Control - Finance",
  "SIMPSON THACHER & BARTLETT | 4/2023 – 5/2024",
  "Manager of Collections - Finance",
  "ECLERX | 9/2022 – 3/2023",
  "Senior Analyst – Financial Markets",
  "BARCLAYS BANK | 10/18/21 – 9/12/2022",
  "Analyst – Financial Markets",
  "TERUMO MEDICAL CORP. | 7/28/20 -10/8/21",
  "Collections, Credit & Data Supervisor",
  "WELLS FARGO | 11/14/17 – 11/8/19",
  "Capital Finance Credit & Collections Supervisor",
  "SELECTIVE INSURANCE | 2/1/16-11/9/17",
  "Supervisor of Credit & Collections",
  "Managed a team of 6 within the Billing Services Department.",
  "Education",
  "COLUMBIA UNIVERSITY | 9/2004 - 5/2008",
  "Bachelor of Arts degree",
);

describe("full dates in dated roles", () => {
  it("reads month/day/year ranges with two- and four-digit years", () => {
    const spans = findDatedRanges(
      cv("BARCLAYS BANK | 10/18/21 – 9/12/2022", "SELECTIVE INSURANCE | 2/1/16-11/9/17"),
      TODAY,
    );
    expect(spans.map(ym)).toEqual([
      ["2021-10", "2022-9"],
      ["2016-2", "2017-11"],
    ]);
  });

  it("keeps month/year ranges as they were", () => {
    const spans = findDatedRanges(
      cv("ECLERX | 9/2022 – 3/2023", "Brand Manager, Mar 2014 - Jun 2016"),
      TODAY,
    );
    expect(spans.map(ym)).toEqual([
      ["2022-9", "2023-3"],
      ["2014-3", "2016-6"],
    ]);
  });

  it("reads day/month order when the first number cannot be a month, and an end to present", () => {
    const spans = findDatedRanges(cv("Analyst | 18/10/21 - present"), TODAY);
    expect(spans.map(ym)).toEqual([["2021-10", "2026-11"]]);
  });

  it("a two-digit year that would be in the future is last century", () => {
    const spans = findDatedRanges(cv("Clerk | 5/1/98 - 6/30/99"), TODAY);
    expect(spans.map(ym)).toEqual([["1998-5", "1999-6"]]);
  });

  it("counts every dated role towards years of experience", () => {
    const v = evaluateYearsRequirement("5+ years of billing experience", FULL_DATES_CV, TODAY);
    expect(v?.status).toBe("met");
    expect(v?.note).toBe("10.2 years from dated roles on the CV, against 5 required.");
  });
});

describe("a must-have that names the requirement links its question", () => {
  const requirement = {
    id: "req-0",
    text: "5+ years of billing experience",
    required: true,
    keywords: [],
  };
  const yes: ScreeningAnswer = {
    question_id: "q-years",
    question: "Do you have at least 5 years of billing experience?",
    required: true,
    answer_type: "boolean",
    value: true,
    disqualifying_condition: { operator: "equals", value: false },
    must_have: "5+ years of billing experience",
  };
  // Four dated years: partial against five on the CV alone.
  const FOUR_YEARS = cv(
    "Experience",
    "Billing Supervisor, Acme Services | Jan 2024 - Present",
    "Ran monthly billing for professional services clients.",
    "Billing Analyst, Acme Services | Nov 2022 - Dec 2023",
  );

  it("a yes lifts the CV's partial to met, with the answer as evidence", () => {
    const r = scoreCandidate({
      cv_text: FOUR_YEARS,
      requirements: [requirement],
      screening: [yes],
      as_of: TODAY,
    });
    const a = r.requirement_assessment[0]!;
    expect(a.status).toBe("met");
    expect(
      a.evidence.some((e) => e.source === "screening" && e.snippet.startsWith("Answered yes to")),
    ).toBe(true);
    expect(r.engine_version).toBe(ENGINE_VERSION);
  });

  it("without the answer the row stays partial", () => {
    const r = scoreCandidate({
      cv_text: FOUR_YEARS,
      requirements: [requirement],
      screening: [],
      as_of: TODAY,
    });
    expect(r.requirement_assessment[0]!.status).toBe("partial");
  });

  it("matching ignores case, spacing and punctuation, not words", () => {
    const loose = { ...yes, must_have: "5+ Years of billing  experience." };
    const other = { ...yes, must_have: "5+ years of collections experience" };
    const statusWith = (s: ScreeningAnswer) =>
      scoreCandidate({
        cv_text: FOUR_YEARS,
        requirements: [requirement],
        screening: [s],
        as_of: TODAY,
      }).requirement_assessment[0]!.status;
    expect(statusWith(loose)).toBe("met");
    expect(statusWith(other)).toBe("partial");
  });
});
