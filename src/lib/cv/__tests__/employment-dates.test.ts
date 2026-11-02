/**
 * Owner item 6a (Hughes Mushrooms, Mushroom Harvesting Manager, 2 Nov 2026):
 * "Two matches have never been scored." Both CVs list dated roles, and both
 * were held with cv_employment_history_missing. Fixtures:
 * tests/fixtures/cv/hughes-unscored.ts.
 */
import { describe, expect, it } from "vitest";
import { employmentIntervals, yearsFromEmploymentDates } from "@/lib/cv/employment-dates";
import { CAREER_OVERVIEW_CV, DETACHED_HEADINGS_CV } from "@tests/fixtures/cv/hughes-unscored";

const month = (y: number, m: number) => y * 12 + (m - 1);

const APPLIED = new Date("2026-11-01T21:43:00Z");
const ASSESSED = new Date("2026-11-02T12:00:00Z");

describe("Mushroom Harvesting Manager: the two applicants never scored", () => {
  it("reads all five roles listed under 'Career Overview:'", () => {
    expect(employmentIntervals(CAREER_OVERVIEW_CV, ASSESSED)).toEqual([
      { start: month(2024, 11), end: month(2026, 11) },
      { start: month(2023, 6), end: month(2024, 9) },
      { start: month(2022, 4), end: month(2023, 5) },
      { start: month(2020, 12), end: month(2021, 1) },
      { start: month(2016, 4), end: month(2018, 5) },
    ]);
  });

  it("reads the roles above a detached WORK EXPERIENCE heading and leaves out the degree", () => {
    const expected = [
      { start: month(2025, 7), end: month(2026, 10) },
      { start: month(2021, 12), end: month(2025, 1) },
    ];
    // On the day he applied, and on the assessment day: October 2026 is past.
    expect(employmentIntervals(DETACHED_HEADINGS_CV, APPLIED)).toEqual(expected);
    expect(employmentIntervals(DETACHED_HEADINGS_CV, ASSESSED)).toEqual(expected);
    // 15 + 37 months; the five-year DVM is not counted as work.
    expect(yearsFromEmploymentDates(DETACHED_HEADINGS_CV, ASSESSED)).toBe(4);
  });

  it("reads the same CV when it is re-read with its line breaks", () => {
    const lines = [
      "CANDIDATE B",
      "Dedicated and results-driven veterinarian and dairy farm management professional.",
      "AGRICULTURE SPECIALIST / HERD MANAGER – EXAMPLE MILCH GMBH & CO. KG | SATOW, ROSTOCK, GERMANY",
      "07/2025 – 10/2026 – SATOW, GERMANY",
      "• Manage a herd of 5,500+ dairy cows",
      "ASSISTANT FARM MANAGER – EXAMPLE DAIRY LIMITED | SHEIKHUPURA, PUNJAB, PAKISTAN",
      "12/2021 – 01/2025 – SHEIKHUPURA, PAKISTAN",
      "• Managed daily operations of a large-scale commercial dairy farm",
      "11/2016 – 08/2021",
      "Example Campus, Pakistan",
      "DOCTOR OF VETERINARY MEDICINE (DVM)",
      "ABOUT ME",
      "WORK EXPERIENCE",
      "EDUCATION AND TRAINING",
      "LANGUAGE SKILLS",
    ].join("\n");
    expect(employmentIntervals(lines, ASSESSED)).toEqual([
      { start: month(2025, 7), end: month(2026, 10) },
      { start: month(2021, 12), end: month(2025, 1) },
    ]);
  });
});

describe("a detached heading does not turn other dates into roles", () => {
  it("a work section with undated roles is not filled from dates elsewhere", () => {
    const cv =
      "Volunteer coordinator 2015 – 2019 WORK EXPERIENCE Brand Manager, Example Co. EDUCATION BA 2010 – 2014";
    expect(employmentIntervals(cv, ASSESSED)).toEqual([]);
  });

  it("a course of study above an empty work heading is still not a role", () => {
    expect(
      employmentIntervals(
        "BSc Biology, Example University 2015 – 2018 WORK EXPERIENCE EDUCATION AND TRAINING",
        ASSESSED,
      ),
    ).toEqual([]);
    expect(
      employmentIntervals(
        "2015 – 2018\nExample College of Agriculture\nWORK EXPERIENCE\nEDUCATION",
        ASSESSED,
      ),
    ).toEqual([]);
  });

  it("digits inside a longer number are not a date range", () => {
    expect(
      employmentIntervals("Phone: +00 1712019-20201 WORK EXPERIENCE EDUCATION", ASSESSED),
    ).toEqual([]);
  });

  it("no work heading at all: a cover letter or education stays without roles", () => {
    expect(
      employmentIntervals(
        "Dear team, I worked hard from 2015 – 2019.\nEDUCATION\n2010 – 2014",
        ASSESSED,
      ),
    ).toEqual([]);
  });
});

describe("the detached-heading read survives heading words in a sentence (review, 2 Nov 2026)", () => {
  // Heading words in Title Case are split onto their own line wherever they
  // stand, so a profile sentence used to end the body before the roles.
  const ROLE = "HERD MANAGER – EXAMPLE FARM | 07/2025 – 10/2026 • Ran the herd";
  const LABELS = "ABOUT ME WORK EXPERIENCE EDUCATION AND TRAINING";
  const ONE_ROLE = [{ start: month(2025, 7), end: month(2026, 10) }];

  it.each([
    ["Skills", "CANDIDATE Communication Skills and teamwork."],
    ["Languages", "CANDIDATE Fluent in two Languages and good with people."],
    ["Qualifications", "CANDIDATE Holds Qualifications in herd care."],
    ["a Europass sub-label", "CANDIDATE Job-related Skills Communication Skills"],
    ["Experience", "CANDIDATE Ten years of hands-on Experience with herds."],
  ])("%s in the profile above the roles", (_word, profile) => {
    expect(employmentIntervals(`${profile} ${ROLE} ${LABELS}`, ASSESSED)).toEqual(ONE_ROLE);
  });

  it("and the same CV with its line breaks", () => {
    const cv = [
      "CANDIDATE",
      "Communication Skills and teamwork.",
      ROLE,
      "ABOUT ME",
      "WORK EXPERIENCE",
      "EDUCATION AND TRAINING",
    ].join("\n");
    expect(employmentIntervals(cv, ASSESSED)).toEqual(ONE_ROLE);
  });

  it("the body ends where the run of section labels begins, so dates below it stay out", () => {
    const cv = `CANDIDATE ${ROLE} ${LABELS} Driving Licence: B 2019 – 2020 LANGUAGE SKILLS`;
    expect(employmentIntervals(cv, ASSESSED)).toEqual(ONE_ROLE);
  });
});

describe("degrees and school-leaving courses above a detached heading are not roles (review, 2 Nov 2026)", () => {
  const LABELS = "ABOUT ME WORK EXPERIENCE EDUCATION AND TRAINING";

  it.each([
    ["BA (Hons)", "BA (Hons) Marketing, Leeds Beckett 2012 – 2015"],
    ["B.A.", "B.A. English Literature 2012 – 2015"],
    ["MA", "MA Marketing 2012 – 2013"],
    ["BEng", "BEng Mechanical Engineering 2010 – 2014"],
    ["MEng", "MEng Civil Engineering 2010 – 2015"],
    ["LLB", "LLB Law 2010 – 2013"],
    ["Hons", "Marketing (Hons), Leeds Beckett 2012 – 2015"],
    ["HND", "HND Agriculture 2010 – 2012"],
    ["HNC", "HNC Engineering 2010 – 2011"],
    ["B.Com", "B.Com Accounting 2009 – 2012"],
    ["BCom", "BCom Accounting 2009 – 2012"],
    ["A Levels", "A Levels: Biology, Chemistry 2007 – 2009"],
    ["A-Levels", "A-Levels: Biology, Chemistry 2007 – 2009"],
    ["the course after its dates", "2012 – 2015 BA (Hons) Marketing"],
  ])("%s", (_token, entry) => {
    expect(employmentIntervals(`CANDIDATE ${entry} ${LABELS}`, ASSESSED)).toEqual([]);
  });

  it("an education-only CV therefore stays without dated employment", () => {
    const cv = `CANDIDATE BA (Hons) Marketing 2012 – 2015 A Levels 2010 – 2012 ${LABELS}`;
    expect(employmentIntervals(cv, ASSESSED)).toEqual([]);
    expect(yearsFromEmploymentDates(cv, ASSESSED)).toBeNull();
  });

  it("the same letters in a role are still a role", () => {
    for (const role of [
      "Brand Manager, Example Co, Boston, MA 2015 – 2019",
      "Marketing Manager at a mushroom farm 2015 – 2019",
      "Picking team leader, a level site 2015 – 2019",
    ]) {
      expect(employmentIntervals(`CANDIDATE ${role} ${LABELS}`, ASSESSED)).toEqual([
        { start: month(2015, 1), end: month(2019, 12) },
      ]);
    }
  });
});
