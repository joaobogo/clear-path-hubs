import { describe, expect, it } from "vitest";
import { cvConsentGate, reachedInterview } from "../cv-consent-gate";

describe("contact release consent gate", () => {
  it("opens as soon as a release timestamp exists", () => {
    const gate = cvConsentGate({
      stage: "shortlisted",
      contact_released_at: "2026-08-12T23:50:00Z",
    });
    expect(gate.open).toBe(true);
    expect(gate.basis).toBe("published");
    expect(gate.clientLabel).toBe("Contact details released");
  });

  it("opens as published even when actor fields are missing", () => {
    const gate = cvConsentGate({
      stage: "shortlisted",
      contact_released_at: "2026-08-12T23:50:00Z",
      contact_released_by: null,
      contact_release_reason: "Delivered to the client for review",
    });
    expect(gate.open).toBe(true);
    expect(gate.basis).toBe("published");
  });

  it("blocks delivered / new / reviewing candidates with no release", () => {
    for (const stage of ["new", "reviewing", "delivered", "shortlisted"]) {
      expect(cvConsentGate({ stage }).open).toBe(false);
    }
  });

  it("opens at interview stage and later", () => {
    for (const stage of ["interview_process", "offer", "hired"]) {
      const gate = cvConsentGate({ stage });
      expect(gate.open).toBe(true);
      expect(gate.basis).toBe("interview_stage");
    }
  });

  it("opens on an explicit audited release with actor and reason", () => {
    const gate = cvConsentGate({
      stage: "shortlisted",
      contact_released_at: "2026-08-12T23:50:00Z",
      contact_released_by: "11111111-1111-1111-1111-111111111111",
      contact_release_reason: "Client confirmed interview slot",
    });
    expect(gate.open).toBe(true);
    expect(gate.basis).toBe("published");
    expect(gate.adminLabel).toBe("Released — explicit staff release");
  });

  it("keeps access for a post-interview rejection", () => {
    const gate = cvConsentGate({ stage: "not_moving_forward", has_interview: true });
    expect(gate.open).toBe(true);
  });

  it("blocks a rejection that never reached interview", () => {
    expect(cvConsentGate({ stage: "not_moving_forward", has_interview: false }).open).toBe(false);
  });

  it("keeps access for a post-interview rejection proven by stage history alone", () => {
    const has = reachedInterview({ stageHistory: 1, requestDecisions: 0, interviewRows: 0 });
    expect(has).toBe(true);
    expect(cvConsentGate({ stage: "not_moving_forward", has_interview: has }).open).toBe(true);
  });

  it("proves the interview stage from a live request_interview decision or a legacy row", () => {
    expect(reachedInterview({ requestDecisions: 1 })).toBe(true);
    expect(reachedInterview({ interviewRows: 2 })).toBe(true);
    expect(reachedInterview({ stageHistory: 0, requestDecisions: 0, interviewRows: 0 })).toBe(false);
    expect(reachedInterview({})).toBe(false);
  });

  it("treats an admin move to the interview stage as reaching interview (interviews are off system)", () => {
    // No client decision exists, only the stage history. Intended: the candidate
    // really is at interview, so a later decline keeps CV access.
    expect(reachedInterview({ stageHistory: 1, requestDecisions: 0, reversedDecisions: 0 })).toBe(true);
  });

  it("does not let an undone interview request keep the history-based access", () => {
    // Requested, then undone: the stage-history row remains but proves nothing.
    expect(reachedInterview({ stageHistory: 1, requestDecisions: 0, reversedDecisions: 1 })).toBe(false);
    // Undone and then requested again: the live request counts.
    expect(reachedInterview({ stageHistory: 2, requestDecisions: 1, reversedDecisions: 1 })).toBe(true);
    // A legacy interview row is still enough on its own.
    expect(reachedInterview({ stageHistory: 1, reversedDecisions: 1, interviewRows: 1 })).toBe(true);
  });
});
