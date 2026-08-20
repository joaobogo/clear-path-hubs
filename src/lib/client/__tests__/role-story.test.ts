import { describe, expect, it } from "vitest";
import { buildCoverage, buildDistribution, buildMilestone, type StoryCandidate } from "../role-story";
import type { RequirementRow } from "@/lib/client-fit-presentation";

const req = (
  id: string,
  status: RequirementRow["status"],
  importance: RequirementRow["importance"] = "must_have",
): RequirementRow => ({
  id,
  label: id.toUpperCase(),
  importance,
  status,
  explanation: null,
  evidence: [],
  context: [],
  interpretation: null,
  contradictions: []
});

const cand = (over: Partial<StoryCandidate>): StoryCandidate => ({
  match_id: "m1",
  name: "Ana Ribeiro",
  stage: "shortlisted",
  score: 80,
  requirement_rows: [req("react", "met"), req("aws", "not_evidenced")],
  ...over,
});

describe("role story coverage", () => {
  it("counts met / partial / missing across the shortlist only", () => {
    const c = buildCoverage([
      cand({}),
      cand({ match_id: "m2", name: "Rui Fernandes", stage: "interview_process" }),
      cand({ match_id: "m3", stage: "delivered", requirement_rows: [req("react", "met")] }),
    ]);
    expect(c.shortlist_size).toBe(2);
    expect(c.met).toBe(2);
    expect(c.missing).toBe(2);
    expect(c.checks).toBe(4);
    expect(c.takeaway).toContain("2 of 4");
    expect(c.takeaway).toContain("AWS");
  });

  it("falls back to delivered candidates when nobody is shortlisted", () => {
    const c = buildCoverage([cand({ stage: "delivered" })]);
    expect(c.shortlist_size).toBe(1);
    expect(c.criteria).toContain("nobody is shortlisted yet");
  });

  it("says so in words when there is nothing to show", () => {
    const c = buildCoverage([]);
    expect(c.checks).toBe(0);
    expect(c.takeaway).toContain("No requirement checks yet");
  });

  it("ignores out-of-scope requirements and puts must-haves first", () => {
    const c = buildCoverage([
      cand({
        requirement_rows: [
          req("nice", "met", "preferred"),
          req("must", "partial"),
          req("na", "not_applicable"),
        ],
      }),
    ]);
    expect(c.requirements.map((r) => r.id)).toEqual(["must", "nice"]);
    expect(c.checks).toBe(2);
  });
});

describe("role story distribution", () => {
  it("bands delivered candidates and names the takeaway", () => {
    const d = buildDistribution([
      cand({ score: 96 }),
      cand({ score: 72 }),
      cand({ score: 55 }),
      cand({ score: null }),
    ]);
    expect(d.delivered).toBe(4);
    expect(d.scored).toBe(3);
    expect(d.bands.find((b) => b.key === "exceptional")?.count).toBe(1);
    expect(d.bands.find((b) => b.key === "strong")?.count).toBe(1);
    expect(d.bands.find((b) => b.key === "consider")?.count).toBe(1);
    expect(d.bands.reduce((sum, b) => sum + b.count, 0)).toBe(d.scored);
    expect(d.bandTotal).toBe(d.scored);
    expect(d.takeaway).toContain("2 of 3");
  });

  it("counts candidates below 50 in the Not Recommended band", () => {
    const d = buildDistribution([
      cand({ score: 88, match_id: "m1" }),
      cand({ score: 79, match_id: "m2" }),
      cand({ score: 78, match_id: "m3" }),
      cand({ score: 68, match_id: "m4" }),
      cand({ score: 68, match_id: "m5" }),
      cand({ score: 68, match_id: "m6" }),
      cand({ score: 60, match_id: "m7" }),
      cand({ score: 47, match_id: "m8" }),
      cand({ score: 42, match_id: "m9" }),
      cand({ score: 35, match_id: "m10" }),
    ]);
    expect(d.delivered).toBe(10);
    expect(d.scored).toBe(10);
    expect(d.bandTotal).toBe(10);
    expect(d.bands.find((b) => b.key === "not_recommended")?.count).toBe(3);
    expect(d.bands.find((b) => b.key === "consider")?.count).toBe(4);
    expect(d.bands.find((b) => b.key === "strong")?.count).toBe(2);
    expect(d.bands.find((b) => b.key === "top")?.count).toBe(1);
    expect(d.bands.find((b) => b.key === "exceptional")?.count).toBe(0);
    expect(d.bands.reduce((sum, b) => sum + b.count, 0)).toBe(d.delivered);
  });

  it("does not invent a spread with no scores", () => {
    expect(buildDistribution([]).takeaway).toContain("No scored candidates yet");
  });
});

describe("role story milestone", () => {
  const base = {
    status: "active",
    nextInterviewAt: null,
    firstShortlistExpectedAt: null,
    openings: 1,
    hires: 0,
  };

  it("prioritises an outstanding offer", () => {
    const m = buildMilestone({ ...base, candidates: [cand({ stage: "offer" })] });
    expect(m.headline).toContain("offer response");
  });

  it("uses a scheduled interview date", () => {
    const m = buildMilestone({
      ...base,
      candidates: [cand({ stage: "interview_process" })],
      nextInterviewAt: "2026-09-01T10:00:00Z",
    });
    expect(m.headline).toContain("Next interview");
  });

  it("asks for a review when candidates are waiting", () => {
    const m = buildMilestone({ ...base, candidates: [cand({ stage: "delivered" })] });
    expect(m.headline).toContain("waiting on your review");
  });

  it("states there is no committed date rather than guessing one", () => {
    const m = buildMilestone({ ...base, candidates: [] });
    expect(m.detail).toContain("No date is committed");
  });

  it("reports completion once the openings are filled", () => {
    const m = buildMilestone({ ...base, candidates: [cand({ stage: "hired" })], hires: 1 });
    expect(m.headline).toContain("complete");
  });
});