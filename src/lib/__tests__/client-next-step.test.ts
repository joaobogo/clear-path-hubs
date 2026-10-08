import { describe, expect, it } from "vitest";
import {
  buildNextStep,
  confirmationLine,
  dueLabel,
  withinLabel,
} from "@/lib/client-next-step";

describe("client next step commitments", () => {
  const now = new Date("2026-07-30T10:00:00Z");

  it("hands the next move back to the client while awaiting review", () => {
    const s = buildNextStep("delivered", now.toISOString(), now);
    expect(s.owner).toBe("client");
    expect(s.due).toBeNull();
  });

  it("never promises to book interviews when a candidate reaches shortlist", () => {
    const s = buildNextStep("shortlisted", now.toISOString(), now);
    expect(s.sentence).toContain("outside TAASFlow");
    expect(s.sentence).not.toMatch(/book|calendar|invite|propose.*slots/i);
    expect(s.due).toBeNull();
    expect(s.overdue).toBe(false);
  });

  it("does not invent overdue interview or offer tasks for historical stages", () => {
    for (const stage of ["shortlisted", "interview_process", "offer"] as const) {
      const next = buildNextStep(stage, "2026-07-27T10:00:00Z", now);
      expect(next.sentence).toContain("outside TAASFlow");
      expect(next.due).toBeNull();
      expect(next.overdue).toBe(false);
    }
  });

  it("words commitment windows in plain language", () => {
    expect(withinLabel(24)).toBe("within 24h");
    expect(withinLabel(48)).toBe("within 2 days");
    expect(withinLabel(6)).toBe("within 6h");
  });

  it("labels deadlines relative to today", () => {
    expect(dueLabel(new Date("2026-07-30T14:00:00Z"), now)).toContain("today");
    expect(dueLabel(new Date("2026-07-31T14:00:00Z"), now)).toContain("tomorrow");
  });

  it("returns an immediate consequence line for every decision outcome", () => {
    for (const stage of ["shortlisted", "interview_process", "offer", "hired", "not_moving_forward"] as const) {
      expect(confirmationLine(stage, now).length).toBeGreaterThan(10);
    }
  });

  it("never leaks internal vocabulary to clients", () => {
    const banned = /score|rubric|canonical|integrity|match_id/i;
    for (const stage of [
      "delivered",
      "shortlisted",
      "interview_process",
      "offer",
      "hired",
      "not_moving_forward",
    ] as const) {
      expect(buildNextStep(stage, now.toISOString(), now).sentence).not.toMatch(banned);
    }
  });
});
