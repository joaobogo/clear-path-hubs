import { describe, it, expect } from "vitest";
import { resolveQueryPhase } from "../query-phase";

describe("resolveQueryPhase", () => {
  it("shows a skeleton only while a first read is genuinely in flight", () => {
    expect(resolveQueryPhase({ pending: true, hasData: false })).toBe("loading");
  });

  it("never leaves loading as a terminal state", () => {
    expect(resolveQueryPhase({ pending: true, hasData: false, stuck: true })).toBe("stuck");
    // A gate that never enabled the query still shows a skeleton, and the
    // stuck backstop is timed from "no data" so it trips there too.
    expect(resolveQueryPhase({ pending: false, hasData: false })).toBe("loading");
    expect(resolveQueryPhase({ pending: false, hasData: false, stuck: true })).toBe("stuck");
  });

  it("reports a failed first read as an error", () => {
    expect(resolveQueryPhase({ pending: false, hasData: false, isError: true })).toBe("error");
  });

  it("keeps the last safe data on screen when a refetch fails", () => {
    expect(resolveQueryPhase({ pending: false, hasData: true, isError: true })).toBe("data");
  });

  it("separates a true empty from a filtered zero", () => {
    expect(resolveQueryPhase({ pending: false, hasData: true, empty: true })).toBe("empty");
    expect(
      resolveQueryPhase({ pending: false, hasData: true, empty: true, hasFilters: true }),
    ).toBe("filtered-empty");
  });

  it("renders data when there is data", () => {
    expect(resolveQueryPhase({ pending: false, hasData: true })).toBe("data");
  });
});
