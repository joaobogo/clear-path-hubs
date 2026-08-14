import { describe, expect, it } from "vitest";
import { calendarDateInputValue, formatCalendarDate } from "@/lib/calendar-date";

describe("calendar dates", () => {
  it("renders the stored day, not a timezone-shifted one", () => {
    // Month abbreviation depends on the ICU build ("Sep" / "Sept"); the day
    // and year are the point of the test.
    expect(formatCalendarDate("2026-09-01")).toMatch(/^1 Sep\w* 2026$/);
    expect(formatCalendarDate("2026-09-01T00:00:00Z")).toMatch(/^1 Sep\w* 2026$/);
    expect(formatCalendarDate("2026-08-31")).toMatch(/^31 Aug 2026$/);
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
