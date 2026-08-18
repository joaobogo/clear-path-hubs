import { describe, it, expect } from "vitest";
import {
  calendarDaysUntil,
  relativeDayLabel,
  dueDateLabel,
  overdueDays,
  isOverdueDate,
  agoLabel,
} from "@/lib/format/relative-date";

// Workspace zone is America/Sao_Paulo (UTC-3).
const NOW = new Date("2026-08-18T15:00:00Z"); // 18 Aug, 12:00 local

describe("relative-date", () => {
  it("never calls a date two days out 'tomorrow'", () => {
    expect(calendarDaysUntil("2026-08-20T09:00:00Z", NOW)).toBe(2);
    expect(relativeDayLabel("2026-08-20T09:00:00Z", NOW)).toBe("in 2 days");
    expect(relativeDayLabel("2026-08-19T09:00:00Z", NOW)).toBe("tomorrow");
  });

  it("never calls today 'yesterday'", () => {
    // 17:01 local on the same calendar day, i.e. later today.
    expect(relativeDayLabel("2026-08-18T20:01:00Z", NOW)).toBe("today");
    // Earlier the same local day.
    expect(relativeDayLabel("2026-08-18T11:00:00Z", NOW)).toBe("today");
    expect(relativeDayLabel("2026-08-17T20:01:00Z", NOW)).toBe("yesterday");
  });

  it("gives one identical overdue value regardless of time of day", () => {
    const due = "2026-08-15T09:00:00Z"; // 3 calendar days before NOW
    expect(overdueDays(due, NOW)).toBe(3);
    expect(dueDateLabel(due, NOW)).toBe("3 days overdue");
    // Same due day, different stored time — still 3, never 4.
    expect(overdueDays("2026-08-15T20:30:00Z", NOW)).toBe(3);
    expect(dueDateLabel("2026-08-15T12:30:00Z", NOW)).toBe("3 days overdue");
  });

  it("cannot be due today and overdue at once", () => {
    const today = "2026-08-18T13:00:00Z";
    expect(dueDateLabel(today, NOW)).toBe("Due today");
    expect(isOverdueDate(today, NOW)).toBe(false);
    expect(overdueDays(today, NOW)).toBe(0);
  });

  it("labels a UTC-rendered date against UTC days, not the workspace zone", () => {
    // 19 Aug 02:00 UTC is still 18 Aug locally; shown as UTC it must read "tomorrow".
    expect(relativeDayLabel("2026-08-19T02:00:00Z", NOW, "UTC")).toBe("tomorrow");
    expect(relativeDayLabel("2026-08-19T02:00:00Z", NOW, "America/Sao_Paulo")).toBe("today");
  });

  it("labels due dates and ages in English", () => {
    expect(dueDateLabel(null, NOW)).toBe("No deadline");
    expect(dueDateLabel("2026-08-19T09:00:00Z", NOW)).toBe("Due tomorrow");
    expect(dueDateLabel("2026-08-22T09:00:00Z", NOW)).toBe("Due in 4 days");
    expect(dueDateLabel("2026-08-17T09:00:00Z", NOW)).toBe("1 day overdue");
    expect(agoLabel("2026-08-13T09:00:00Z", NOW)).toBe("5 days ago");
    expect(agoLabel("2026-08-18T09:00:00Z", NOW)).toBe("today");
  });
});
