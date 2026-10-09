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

  it("hands interviews back to the client: they arrange them directly", () => {
    for (const stage of ["shortlisted", "interview_process"] as const) {
      const s = buildNextStep(stage, now.toISOString(), now);
      expect(s.owner).toBe("client");
      expect(s.due).toBeNull();
      expect(s.sentence.toLowerCase()).toContain("interview");
      expect(s.sentence).not.toMatch(/slot|calendar|book/i);
    }
  });

  it("promises the offer within 2 days after advancing", () => {
    const s = buildNextStep("offer", now.toISOString(), now);
    expect(s.sentence).toContain("within 2 days");
    expect(s.due).not.toBeNull();
    expect(s.overdue).toBe(false);
  });

  it("flags a missed commitment as overdue", () => {
    const s = buildNextStep("offer", "2026-07-25T10:00:00Z", now);
    expect(s.overdue).toBe(true);
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
