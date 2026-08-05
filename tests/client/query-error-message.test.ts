import { describe, expect, it } from "vitest";
import { queryErrorMessage } from "@/components/client/query-error";

describe("queryErrorMessage", () => {
  it("never returns an empty line", () => {
    expect(queryErrorMessage(new Error("   "))).toMatch(/failed/i);
    expect(queryErrorMessage(undefined)).toMatch(/failed/i);
  });

  it("translates auth failures", () => {
    expect(queryErrorMessage(new Error("Unauthorized"))).toMatch(/session expired/i);
  });

  it("translates permission failures", () => {
    expect(queryErrorMessage(new Error("new row violates row-level security policy"))).toMatch(
      /didn't allow/i,
    );
  });

  it("translates network failures", () => {
    expect(queryErrorMessage(new TypeError("Failed to fetch"))).toMatch(/couldn't reach/i);
  });

  it("keeps a real reason and truncates long ones", () => {
    expect(queryErrorMessage(new Error("positions view missing column"))).toBe(
      "positions view missing column",
    );
    const long = queryErrorMessage(new Error("x".repeat(600)));
    expect(long.length).toBeLessThanOrEqual(240);
    expect(long.endsWith("…")).toBe(true);
  });
});
