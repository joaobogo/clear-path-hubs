import { describe, expect, it } from "vitest";
import { isProtectedAttributeText, removeProtectedSentences, sanitizeGeneratedText } from "../protected-attributes";
import { employmentIntervals, yearsFromEmploymentDates } from "../../cv/employment-dates";
import { publishedScore, withRecordedOverride, scoreVoidedByUnreadableCv } from "../published-score";

describe("screening safeguards", () => {
  it("uses the recorded 80 override without mutating the automated 66 run", () => {
    const run = { id: "radwa-run", score: 66, final_score: 66 };
    expect(publishedScore(withRecordedOverride(run, [{ decision_type: "override", score_run_id: "radwa-run", approved_score: 80 }]))).toBe(80);
    expect(run.final_score).toBe(66);
  });
  it("ignores an override from a previous scoring run", () => {
    expect(publishedScore(withRecordedOverride({ id: "new", score: 60 }, [{ decision_type: "override", score_run_id: "old", approved_score: 75 }]))).toBe(60);
  });
  it("voids Boral's 62 ranking when dated employment is missing", () => {
    expect(publishedScore({ score: 62, processing_state: "manual_review_required", processing_error_code: "cv_employment_history_missing" })).toBeNull();
    expect(scoreVoidedByUnreadableCv({ processing_state: "manual_review_required" })).toBe(false);
  });
  it("strips protected text from every nested briefing field while preserving experience", () => {
    const clean = sanitizeGeneratedText({ headline_suggested: "An Egyptian candidate.", screening_analysis: [{ note: "British passport. Worked in Singapore." }], strengths: [{ detail: "Indian heritage. Leads retail." }] });
    expect(clean.headline_suggested).toBe("");
    expect(clean.screening_analysis[0]?.note).toBe("Worked in Singapore.");
    expect(clean.strengths[0]?.detail).toBe("Leads retail.");
  });
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
  it("reads flattened PDF text and letter-spaced headings", () => {
    expect(employmentIntervals("Nora P R O F E S S I O N A L E X P E R I E N C E SAFI GROUP Feb 2025 – Present Marketing Director E D U C A T I O N 2010 – 2014", new Date("2026-10-28"))).toHaveLength(1);
  });
});
