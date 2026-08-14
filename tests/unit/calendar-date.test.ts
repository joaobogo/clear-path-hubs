import { describe, expect, it } from "vitest";
import { calendarDateInputValue, formatCalendarDate } from "@/lib/calendar-date";

describe("calendar dates", () => {
  it("renders the stored day, not a timezone-shifted one", () => {
    expect(formatCalendarDate("2026-09-01")).toBe("1 Sep 2026");
    expect(formatCalendarDate("2026-09-01T00:00:00Z")).toBe("1 Sep 2026");
  });

  it("falls back for empty and malformed values", () => {
    expect(formatCalendarDate(null)).toBe("—");
    expect(formatCalendarDate("", "")).toBe("");
    expect(formatCalendarDate("not-a-date")).toBe("—");
  });

  it("round-trips to the input value form", () => {
    expect(calendarDateInputValue("2026-09-01T00:00:00Z")).toBe("2026-09-01");
    expect(calendarDateInputValue(null)).toBe("");
  });
});
