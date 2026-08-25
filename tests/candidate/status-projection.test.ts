import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  candidateStateKey,
  candidateLifecycleFacts,
  toCandidateStatusDTO,
} from "@/lib/candidate/status-projection";
import { resolveCandidateState } from "@/lib/candidate/apply-status-model";

const app = (over: Record<string, unknown> = {}) => ({
  status: "submitted",
  withdrawn_at: null,
  positions: { status: "active" },
  candidate_matches: [] as unknown[],
  ...over,
});

describe("candidate status projection", () => {
  it("reads the status off applications + candidate_matches only", () => {
    expect(toCandidateStatusDTO(app()).status).toBe("Received");
    expect(toCandidateStatusDTO(app({ status: "processing" })).status).toBe("Under review");
  });

  it("reflects publication — the client_visibility flip and nothing else", () => {
    const hidden = app({
      status: "ready_for_review",
      candidate_matches: [{ stage: "delivered", client_visibility: "hidden" }],
    });
    expect(toCandidateStatusDTO(hidden).status).toBe("Under review");
    const published = app({
      status: "ready_for_review",
      candidate_matches: [{ stage: "delivered", client_visibility: "visible" }],
    });
    expect(toCandidateStatusDTO(published).status).toBe("Shared with the employer");
  });

  it("follows an admin's stage change with no second write", () => {
    const base = { status: "ready_for_review", client_visibility: "visible" };
    const at = (stage: string) =>
      toCandidateStatusDTO(app({ status: "ready_for_review", candidate_matches: [{ ...base, stage }] }))
        .status;
    expect(at("interview_process")).toBe("Interviewing");
    expect(at("offer")).toBe("Offer stage");
    expect(at("hired")).toBe("Offer stage");
    expect(at("not_moving_forward")).toBe("Closed");
  });

  it("counts a live interview row, ignoring cancelled ones", () => {
    const withInterviews = (interviews: unknown[]) =>
      toCandidateStatusDTO(
        app({
          status: "ready_for_review",
          candidate_matches: [{ stage: "delivered", client_visibility: "visible", interviews }],
        }),
      );
    expect(withInterviews([{ status: "cancelled", scheduled_at: "2026-09-01T09:00:00Z" }]).status).toBe(
      "Shared with the employer",
    );
    const live = withInterviews([{ status: "scheduled", scheduled_at: "2026-09-01T09:00:00Z" }]);
    expect(live.status).toBe("Interviewing");
    expect(live.interview_state).toBe("scheduled");
  });

  it("closes on withdrawal and on a closed role", () => {
    expect(toCandidateStatusDTO(app({ withdrawn_at: "2026-08-01T10:00:00Z" })).status).toBe("Closed");
    expect(toCandidateStatusDTO(app({ positions: { status: "filled" } })).status).toBe("Closed");
  });

  it("carries the copy and the withdraw right, so no surface writes its own", () => {
    const dto = toCandidateStatusDTO(app({ status: "processing" }));
    expect(dto.meaning).toMatch(/reviewer/i);
    expect(dto.next_step.length).toBeGreaterThan(0);
    expect(dto.email_line).toContain("Under review");
    expect(dto.can_withdraw).toBe(true);
    expect(toCandidateStatusDTO(app({ withdrawn_at: "x" })).can_withdraw).toBe(false);
  });

  it("derives the journey key from the same status", () => {
    const facts = candidateLifecycleFacts(app({ status: "processing" }), {
      hasOpenInfoRequest: true,
    });
    expect(candidateStateKey("Under review", facts)).toBe("information_required");
    expect(
      resolveCandidateState({
        applicationStatus: "ready_for_review",
        withdrawnAt: null,
        positionStatus: "active",
        matchStage: "interview_process",
        matchVisible: true,
        hasOpenInfoRequest: false,
        interviewScheduled: false,
        interviewRequested: false,
        needsSupport: false,
      }),
    ).toBe("interview_stage");
  });

  it("is the only derivation the candidate surfaces use", () => {
    const portal = readFileSync("src/lib/candidate.functions.ts", "utf8");
    expect(portal).toContain("toCandidateStatusDTO");
    // No local re-derivation of the status or its copy in the portal.
    expect(portal).not.toContain("interviewStateOf(");
    expect(portal).not.toContain("nextStepHint(");
    const publicModel = readFileSync("src/lib/candidate/apply-status-model.ts", "utf8");
    expect(publicModel).toContain("candidateStatusFromFacts");
    const returning = readFileSync("src/lib/candidate/existing-application.server.ts", "utf8");
    expect(returning).toContain("toCandidateStatusDTO");
  });

  it("stores no candidate-facing status string", () => {
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    for (const stored of [
      "candidate_facing_status",
      "candidate_status_label",
      "portal_status",
    ]) {
      expect(types).not.toContain(stored);
    }
    // The old SQL projection of a candidate status is gone.
    expect(types).not.toContain("candidate_status:");
  });
});
