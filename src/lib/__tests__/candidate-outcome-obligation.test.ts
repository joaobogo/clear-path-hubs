import { describe, expect, it } from "vitest";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COPY,
  candidateStatusFromStateKey,
} from "@/lib/candidate/status-vocabulary";
import { assessOutcome, businessDaysBetween } from "@/lib/candidate/outcome-sla";
import { dueReminder, isNoShow } from "@/lib/candidate/interview-reminders.server";
import { missingProfileItems, nudgeDue } from "@/lib/candidate/profile-nudges.server";

describe("candidate status vocabulary", () => {
  it("keeps one label map every surface reads", () => {
    expect(CANDIDATE_STATUSES.map((s) => `${s}|${CANDIDATE_STATUS_COPY[s].meaning}`)).toMatchInlineSnapshot(`
      [
        "Received|Your application and CV are with us.",
        "Under review|A reviewer is reading your application against the role.",
        "Shared with the employer|Your profile has been passed to the employer for this role.",
        "Interviewing|The employer is arranging or holding interviews with you.",
        "Offer stage|The employer is discussing an offer with you.",
        "Closed|This application is no longer active.",
      ]
    `);
  });

  it("never leaves a next step blank", () => {
    for (const s of CANDIDATE_STATUSES) {
      expect(CANDIDATE_STATUS_COPY[s].nextStep.trim().length).toBeGreaterThan(0);
    }
  });

  it("maps every detailed state onto the six words", () => {
    expect(candidateStatusFromStateKey("support_required")).toBe("Under review");
    expect(candidateStatusFromStateKey("role_closed")).toBe("Closed");
  });
});

describe("terminal outcome obligation", () => {
  const monday = new Date("2026-05-04T09:00:00Z");

  it("counts business days only", () => {
    expect(businessDaysBetween(monday, new Date("2026-05-11T09:00:00Z"))).toBe(5);
  });

  it("flags a decision the candidate was never told about", () => {
    const a = assessOutcome({
      applicationStatus: "rejected",
      matchStage: "not_moving_forward",
      withdrawnAt: null,
      closureNotifiedAt: null,
      appliedAt: monday.toISOString(),
      now: new Date("2026-05-06T09:00:00Z"),
    });
    expect(a.state).toBe("outcome_not_sent");
    expect(a.weight).toBeGreaterThan(500);
  });

  it("flags an open application past the commitment", () => {
    const a = assessOutcome({
      applicationStatus: "ready_for_review",
      matchStage: null,
      withdrawnAt: null,
      closureNotifiedAt: null,
      appliedAt: monday.toISOString(),
      now: new Date("2026-05-14T09:00:00Z"),
    });
    expect(a.state).toBe("overdue");
    expect(a.daysOverdue).toBeGreaterThan(0);
  });

  it("owes nothing on a self-withdrawal or a sent outcome", () => {
    expect(
      assessOutcome({
        applicationStatus: "withdrawn",
        matchStage: null,
        withdrawnAt: monday.toISOString(),
        closureNotifiedAt: null,
        appliedAt: monday.toISOString(),
        now: new Date("2026-06-01T09:00:00Z"),
      }).state,
    ).toBe("answered");
    expect(
      assessOutcome({
        applicationStatus: "rejected",
        matchStage: "not_moving_forward",
        withdrawnAt: null,
        closureNotifiedAt: monday.toISOString(),
        appliedAt: monday.toISOString(),
        now: new Date("2026-06-01T09:00:00Z"),
      }).state,
    ).toBe("answered");
  });
});

describe("interview reminders", () => {
  const start = "2026-05-12T10:00:00Z";

  it("sends the day-before reminder once", () => {
    expect(
      dueReminder({
        scheduledAt: start,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
        now: new Date("2026-05-11T10:00:00Z"),
      }),
    ).toBe("24h");
    expect(
      dueReminder({
        scheduledAt: start,
        reminder24hSentAt: "2026-05-11T10:00:00Z",
        reminder1hSentAt: null,
        now: new Date("2026-05-11T12:00:00Z"),
      }),
    ).toBeNull();
  });

  it("sends the hour-before reminder inside the final window", () => {
    expect(
      dueReminder({
        scheduledAt: start,
        reminder24hSentAt: "2026-05-11T10:00:00Z",
        reminder1hSentAt: null,
        now: new Date("2026-05-12T09:20:00Z"),
      }),
    ).toBe("1h");
  });

  it("treats a passed slot with no outcome as a no-show, once", () => {
    const base = {
      scheduledAt: start,
      status: "scheduled",
      completedAt: null,
      cancelledAt: null,
      noShowFlaggedAt: null,
      now: new Date("2026-05-12T13:00:00Z"),
    };
    expect(isNoShow(base)).toBe(true);
    expect(isNoShow({ ...base, noShowFlaggedAt: "2026-05-12T12:30:00Z" })).toBe(false);
    expect(isNoShow({ ...base, completedAt: "2026-05-12T11:00:00Z" })).toBe(false);
  });
});

describe("profile nudges", () => {
  it("names what is missing in plain language", () => {
    const missing = missingProfileItems({
      hasCv: false,
      location: null,
      phone: "123",
      headline: "Designer",
      experience: [{ title: "x" }],
    });
    expect(missing).toEqual(["a CV in PDF form", "where you are based"]);
  });

  it("stops at two nudges, ever", () => {
    expect(
      nudgeDue({
        nudgeCount: 2,
        lastNudgeAt: "2026-01-01T00:00:00Z",
        appliedAt: "2026-01-01T00:00:00Z",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe(false);
  });

  it("waits a day before the first nudge and spaces the second", () => {
    expect(
      nudgeDue({
        nudgeCount: 0,
        lastNudgeAt: null,
        appliedAt: "2026-05-01T00:00:00Z",
        now: new Date("2026-05-01T06:00:00Z"),
      }),
    ).toBe(false);
    expect(
      nudgeDue({
        nudgeCount: 1,
        lastNudgeAt: "2026-05-02T00:00:00Z",
        appliedAt: "2026-05-01T00:00:00Z",
        now: new Date("2026-05-09T00:00:00Z"),
      }),
    ).toBe(true);
  });
});
