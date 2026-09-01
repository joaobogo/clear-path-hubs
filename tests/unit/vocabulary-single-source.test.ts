import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { filesMatching } from "@tests/helpers/scan-source";
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
    // A stage display label starts with the stage word itself; event
    // sentences ("Moved into interviews") and action keys are not labels.
    const hits = filesMatching(join(process.cwd(), "src"), /interview_process: "Interview/).filter(
      (f) => f !== "src/lib/vocabulary.ts",
    );
    expect(hits).toEqual([]);
  });
});
