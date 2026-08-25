import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  candidateSafeLabel,
  clientStatusLabel,
  statusLabel,
} from "@/lib/vocabulary";
import { stageDisplayName } from "@/lib/client/stage-display";
import { clientStageLabel } from "@/lib/client-stage-labels";

describe("one vocabulary module", () => {
  it("renders the interview stage under one label per audience", () => {
    for (const alias of ["interview_process", "interview", "INTERVIEWING", "in interviews"]) {
      expect(statusLabel(alias)).toBe("Interviewing");
      expect(clientStatusLabel(alias)).toBe("Interviewing");
      expect(candidateSafeLabel(alias)).toBe("Interviewing");
    }
    expect(stageDisplayName("interview")).toBe(clientStatusLabel("interview_process"));
    expect(clientStageLabel("interview")).toBe(clientStatusLabel("interview_process"));
  });

  it("keeps candidate-facing labels inside the six safe words", () => {
    for (const value of ["screening", "delivered", "hired", "not_moving_forward", "no_show"]) {
      expect([
        "Received",
        "Under review",
        "Shared with the employer",
        "Interviewing",
        "Offer stage",
        "Closed",
      ]).toContain(candidateSafeLabel(value));
    }
  });

  it("has no competing stage label map left in the codebase", () => {
    const hits = execSync(
      "grep -rln --include=*.ts --include=*.tsx 'interview_process: \"' src || true",
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((f) => f && !f.endsWith("src/lib/vocabulary.ts"));
    expect(hits).toEqual([]);
  });
});
