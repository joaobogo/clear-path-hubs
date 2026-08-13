import { describe, it, expect } from "vitest";
import { resolveQueryPhase } from "../query-phase";

describe("resolveQueryPhase", () => {
  it("shows a skeleton only while a first read is genuinely in flight", () => {
    expect(resolveQueryPhase({ pending: true, hasData: false })).toBe("loading");
  });

  it("never leaves loading as a terminal state", () => {
    expect(resolveQueryPhase({ pending: true, hasData: false, stuck: true })).toBe("stuck");
    // Settled with neither data nor an error (a gate that never enabled the query).
    expect(resolveQueryPhase({ pending: false, hasData: false })).toBe("stuck");
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
