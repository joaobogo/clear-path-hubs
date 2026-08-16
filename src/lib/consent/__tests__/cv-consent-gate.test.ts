import { describe, expect, it } from "vitest";
import { cvConsentGate, isExplicitAuditedRelease } from "../cv-consent-gate";

describe("pre-interview consent gate", () => {
  it("blocks a shortlisted candidate whose only release is a blanket one", () => {
    const gate = cvConsentGate({
      stage: "shortlisted",
      contact_released_at: "2026-08-12T23:50:00Z",
      contact_released_by: null,
      contact_release_reason: "Delivered to the client for review",
    });
    expect(gate.open).toBe(false);
    expect(gate.blanket_release).toBe(true);
    expect(gate.clientLabel).toBe("Available after interview");
    expect(gate.adminLabel).toBe("Blocked — pre-interview");
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
    expect(gate.basis).toBe("explicit_release");
  });

  it("treats a release without a reason as non-explicit", () => {
    expect(
      isExplicitAuditedRelease({
        contact_released_at: "2026-08-12T23:50:00Z",
        contact_released_by: "11111111-1111-1111-1111-111111111111",
        contact_release_reason: "  ",
      }),
    ).toBe(false);
  });

  it("keeps access for a post-interview rejection", () => {
    const gate = cvConsentGate({ stage: "not_moving_forward", has_interview: true });
    expect(gate.open).toBe(true);
  });

  it("blocks a rejection that never reached interview", () => {
    expect(cvConsentGate({ stage: "not_moving_forward", has_interview: false }).open).toBe(false);
  });
});
