import { describe, expect, it } from "vitest";
import { employmentIntervals, yearsFromEmploymentDates } from "@/lib/cv/employment-dates";
import { evaluateYearsRequirement, findDatedRanges } from "../structured-requirements";

const TODAY = new Date("2026-11-18T00:00:00Z");
const CV = [
  "WORK EXPERIENCE",
  "TikTok | Accounts Receivable Specialist | May ‘24 - Present",
  "Handles billing discrepancies and invoice corrections.",
  "Similarweb | Billing Specialist | Mar ‘23 - May ‘24",
  "Owned billing and receivables.",
  "PBF Energy",
  "Team Lead | Nov ‘21 - Mar ‘23 / Billing Associate | Aug ‘18 - Nov ‘21",
  "Lead a team of 4 members for a billing/inventory group.",
].join("\n");

describe("month and apostrophe employment years", () => {
  it.each(["'", "‘", "’"])("reads the four ranges with %s", (apostrophe) => {
    const text = CV.replaceAll("‘", apostrophe);
    expect(employmentIntervals(text, TODAY)).toHaveLength(4);
    expect(yearsFromEmploymentDates(text, TODAY)).toBe(8);
    expect(findDatedRanges(text, TODAY).map((r) => [r.from, r.to])).toEqual([
      [2024 * 12 + 4, 2026 * 12 + 10],
      [2023 * 12 + 2, 2024 * 12 + 4],
      [2021 * 12 + 10, 2023 * 12 + 2],
      [2018 * 12 + 7, 2021 * 12 + 10],
    ]);
  });

  it("counts billing and leadership from the dated roles", () => {
    expect(evaluateYearsRequirement("5+ years of billing experience", CV, TODAY)?.status).toBe("met");
    const leadership = [
      "WORK EXPERIENCE",
      "PBF Energy | Team Lead | Nov ‘21 - Mar ‘23",
      "Lead a team of 4 members for a billing/inventory group.",
    ].join("\n");
    const verdict = evaluateYearsRequirement("2+ years managing a team", leadership, TODAY);
    expect(verdict?.status).toBe("missing");
    expect(verdict?.note).toContain("1.4 yrs from:");
    expect(findDatedRanges(leadership, TODAY)[0]?.to).toBe(2023 * 12 + 2);
  });

  it.each(["May 24 - Present", "‘24 - ‘25", "May ‘24 - ‘25", "24 - 25", "Summers ‘15-’17"])(
    "does not interpret %s as an abbreviated employment range", (range) => {
      expect(employmentIntervals(`WORK EXPERIENCE\nIntern | ${range}`, TODAY)).toEqual([]);
      expect(findDatedRanges(`Intern | ${range}`, TODAY)).toEqual([]);
    },
  );
});