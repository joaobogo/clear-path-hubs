import { describe, expect, it } from "vitest";
import {
  canJoinInterview,
  displayInterviewStatus,
  hasInterviewHappened,
  interviewOccurrence,
  interviewStatusLabel,
} from "@/lib/interview-timing";

const NOW = new Date("2026-08-14T12:00:00Z").getTime();
const FUTURE = "2026-08-18T09:30:00Z";
const PAST = "2026-08-10T09:30:00Z";

describe("interview timing", () => {
  it("classifies strictly by the scheduled time, never by status", () => {
    expect(interviewOccurrence({ status: "completed", scheduled_at: FUTURE }, NOW)).toBe("upcoming");
    expect(interviewOccurrence({ status: "scheduled", scheduled_at: PAST }, NOW)).toBe("happened");
    expect(interviewOccurrence({ status: "requested", scheduled_at: null }, NOW)).toBe("unscheduled");
    expect(hasInterviewHappened({ status: "completed", scheduled_at: FUTURE }, NOW)).toBe(false);
  });

  it("never presents a future interview as completed", () => {
    expect(displayInterviewStatus({ status: "completed", scheduled_at: FUTURE }, NOW)).toBe("scheduled");
    expect(interviewStatusLabel({ status: "completed", scheduled_at: FUTURE }, NOW)).toBe("Confirmed");
    expect(interviewStatusLabel({ status: "completed", scheduled_at: PAST }, NOW)).toBe("Completed");
  });

  it("offers a join link only around the meeting time", () => {
    expect(canJoinInterview({ status: "scheduled", scheduled_at: FUTURE, meeting_url: "https://x" }, NOW)).toBe(false);
    expect(canJoinInterview({ status: "completed", scheduled_at: PAST, meeting_url: "https://x" }, NOW)).toBe(false);
    const soon = new Date(NOW + 5 * 60 * 1000).toISOString();
    expect(canJoinInterview({ status: "scheduled", scheduled_at: soon, meeting_url: "https://x" }, NOW)).toBe(true);
  });
});
