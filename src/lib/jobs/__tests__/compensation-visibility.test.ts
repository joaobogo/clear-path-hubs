/**
 * No pay figure escapes without compensation_visibility === "public".
 *
 * public-facts.ts states the rule directly above the function: "Anything other
 * than an explicit `public` is treated as withheld — a missing or unrecognised
 * value must never leak a number." The legacy explicit-approval branch returned
 * BEFORE that check, so a record carrying approved: true and a display string
 * published a range whatever visibility said — and resolvePublicSalary, which
 * feeds the structured JobPosting markup, had always checked visibility first,
 * so the two functions disagreed about the same rule (audit 1 Sep, F27).
 *
 * Never observed in live data. This makes it unobservable.
 */
import { describe, expect, it } from "vitest";
import { resolveCompensation, RANGE_ON_CALL, NOT_SPECIFIED } from "@/lib/jobs/public-facts";

const RANGE = { budget_min: 3500, budget_max: 5000, currency: "BRL", period: "month" };
const LEGACY = { approved: true, display: "R$3,500 – R$5,000 per month" };

/** Everything that is not the one permitted value. */
const NOT_PUBLIC = [
  "private",
  "internal",
  "on_call",
  "PUBLIC",
  "Public",
  "",
  null,
  undefined,
  "public ",
] as const;

describe("compensation visibility", () => {
  it("publishes a range when visibility is exactly public", () => {
    const out = resolveCompensation(RANGE, "public");
    expect(out.display).toContain("3,500");
    expect(out.display).toContain("5,000");
  });

  it("withholds the range for every other visibility value", () => {
    for (const visibility of NOT_PUBLIC) {
      const out = resolveCompensation(RANGE, visibility as string | null | undefined);
      expect(out.display, String(visibility)).toBeNull();
      expect(out.line, String(visibility)).toBe(RANGE_ON_CALL);
    }
  });

  it("withholds the LEGACY approved shape too", () => {
    // The whole finding: this branch used to return before the check.
    for (const visibility of NOT_PUBLIC) {
      const out = resolveCompensation(LEGACY, visibility as string | null | undefined);
      expect(out.display, String(visibility)).toBeNull();
      expect(out.line, String(visibility)).toBe(RANGE_ON_CALL);
    }
  });

  it("still honours the legacy shape on a public role", () => {
    const out = resolveCompensation(LEGACY, "public");
    expect(out.display).toBe(LEGACY.display);
  });

  it("leaks no digits in any withheld line", () => {
    // A belt-and-braces check on the property that matters: whatever the
    // shape, a withheld result must not carry a number.
    for (const shape of [RANGE, LEGACY, { ...RANGE, ...LEGACY }, { summary: "R$4,000/month" }]) {
      for (const visibility of NOT_PUBLIC) {
        const out = resolveCompensation(shape, visibility as string | null | undefined);
        expect(out.display, JSON.stringify({ shape, visibility })).toBeNull();
        expect(/\d/.test(out.line), JSON.stringify({ shape, visibility })).toBe(false);
      }
    }
  });

  it("says not specified when there is nothing to publish", () => {
    expect(resolveCompensation({}, "public").line).toBe(NOT_SPECIFIED);
  });
});
