import { describe, it, expect } from "vitest";
import { assessJobQuality, type QualityInput } from "../requisition-schema";

const base: QualityInput = {
  title: "Senior Full-Stack Engineer",
  description: "",
  seniority: "",
  employment_type: "",
  department: "",
  must_have_skills: ["TypeScript", "React", "Postgres"],
  nice_to_have_skills: [],
  disqualifier_tags: [],
  responsibilities: "",
  experience: "",
  interview_process: "",
  screening_questions: [],
  locations: [{ country_code: "PT", work_model: "remote" }] as never,
  travel_expectation: "",
  primary_timezone: "",
  timezone_overlap_hours: null,
  target_start_date: "",
  headcount: 1,
  owner_user_id: null,
  reference_code: "",
  compensation_collected: false,
};

describe("job quality checklist against a draft", () => {
  it("flags seniority and employment type only while they are unset", () => {
    const missing = assessJobQuality(base);
    expect(missing.blocking.map((g) => g.id)).toEqual(
      expect.arrayContaining(["seniority", "employment_type"]),
    );
  });

  it("clears both entries once the draft sets them", () => {
    const draft: Partial<QualityInput> = { seniority: "Senior", employment_type: "full_time" };
    const merged = assessJobQuality({ ...base, ...draft });
    const ids = merged.blocking.map((g) => g.id);
    expect(ids).not.toContain("seniority");
    expect(ids).not.toContain("employment_type");
    expect(merged.readiness).not.toBe("not_scoreable");
  });
});
