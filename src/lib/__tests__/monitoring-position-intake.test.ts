import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { interviewProcessSummary, type InterviewStage } from "../express-intake-schema";

const stages: InterviewStage[] = [{ name: "Technical interview", format: "video_call", ownerName: "Hiring lead" }];

describe("position screening and intake interview persistence", () => {
  it("orders screening questions by the existing display_order column", () => {
    const source = readFileSync("src/lib/admin.functions.ts", "utf8");
    const getPosition = source.slice(source.indexOf("export const getPosition ="), source.indexOf("const positionPatch ="));
    expect(getPosition).toMatch(/from\("screening_questions"\)[\s\S]*?order\("display_order"/);
    expect(getPosition).not.toContain('order("position_order"');
  });
  it("keeps complete notes alongside stage format, owner and target", () => {
    const notes = "Candidates must do a take-home task.\n\n" + "Additional context. ".repeat(40);
    const result = interviewProcessSummary(stages, 21, notes);
    expect(result).toContain("1. Technical interview — Video call (Hiring lead)");
    expect(result).toContain("Target: shortlist to offer in 21 days");
    expect(result.endsWith(notes)).toBe(true);
  });
  it("leaves the existing summary unchanged when notes are skipped", () => {
    expect(interviewProcessSummary(stages, null, "  ")).toBe(interviewProcessSummary(stages));
    expect(interviewProcessSummary([], null, "Notes only")).toBe("Notes only");
  });
});