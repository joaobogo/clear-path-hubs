import { describe, expect, it } from "vitest";
import { isProtectedAttributeText, removeProtectedSentences } from "../protected-attributes";
import { employmentIntervals, yearsFromEmploymentDates } from "../../cv/employment-dates";

describe("screening safeguards", () => {
  it("excludes inferred nationality but preserves UAE relocation", () => {
    expect(isProtectedAttributeText("Egyptian heritage inferred from university")).toBe(true);
    expect(isProtectedAttributeText("Must be willing to relocate to the UAE")).toBe(false);
    expect(removeProtectedSentences("Has Egyptian nationality. Leads retail marketing.")).toBe("Leads retail marketing.");
  });
  it("treats July 2025 as past on 28 October 2026", () => {
    expect(employmentIntervals("WORK EXPERIENCE\nMarketing Director July 2025 – Present", new Date("2026-10-28")).length).toBe(1);
  });
  it("does not accept a cover letter or education as dated employment", () => {
    expect(employmentIntervals("Dear team, I would love this role.\nEDUCATION\n2010 – 2014")).toEqual([]);
  });
  it("does not double count concurrent employment", () => {
    expect(yearsFromEmploymentDates("WORK EXPERIENCE\nDirector Jan 2010 – Jan 2020\nConsultant Jan 2015 – Jan 2020", new Date("2026-10-28"))).toBe(10);
  });
});