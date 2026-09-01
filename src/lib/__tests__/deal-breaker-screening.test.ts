/**
 * The intake form promises protected-characteristic filtering is removed.
 * Nothing enforced it (audit 1 Sep, F12).
 *
 * Two failure modes matter equally here, and the second is the one that kills
 * safeguards in practice: catching legitimate entries teaches clients to
 * dismiss the warning.
 */
import { describe, expect, it } from "vitest";
import {
  screenDealBreaker,
  screenDealBreakers,
  usableDealBreakers,
} from "@/lib/deal-breaker-screening";

describe("flags entries tied to a protected characteristic", () => {
  it("flags the entry the audit actually found", () => {
    const flag = screenDealBreaker("no citizenship");
    expect(flag?.characteristic).toBe("nationality or citizenship");
    expect(flag?.suggestion).toMatch(/visa sponsorship/i);
  });

  it("flags each characteristic the policy line names", () => {
    const cases: Array<[string, string]> = [
      ["under 30 only", "age"],
      ["no women on site visits", "sex or gender"],
      ["must be a native English speaker", "nationality or citizenship"],
      ["no religious commitments on Sundays", "religion"],
      ["cannot have a disability", "disability"],
      ["no one on maternity leave", "pregnancy or family status"],
      ["must be married", "marital status"],
    ];
    for (const [line, characteristic] of cases) {
      expect(screenDealBreaker(line)?.characteristic, line).toBe(characteristic);
    }
  });

  it("says what we will do, not what the law is", () => {
    // Product copy, not legal advice.
    const flag = screenDealBreaker("under 30 only")!;
    expect(flag.message).toMatch(/we will not use it/i);
    expect(flag.message).not.toMatch(/illegal|unlawful|discriminat/i);
  });
});

describe("does not flag work-related requirements", () => {
  it("leaves ordinary deal-breakers alone", () => {
    const legitimate = [
      "No agency-side-only backgrounds",
      "Cannot start within six weeks",
      "No hands-on ownership of the core system",
      "Less than three years of production Kubernetes",
      "Not willing to travel to Lisbon monthly",
      "No commercial React experience",
    ];
    for (const line of legitimate) {
      expect(screenDealBreaker(line), line).toBeNull();
    }
  });

  it("exempts lawful work-authorisation phrasing", () => {
    // The form asks about visa sponsorship separately. Catching these would
    // train clients to ignore the warning, which is how a safeguard dies.
    const lawful = [
      "Must have the right to work in Portugal without sponsorship",
      "We cannot sponsor a work visa for this role",
      "Must already be eligible to work in the EU",
      "No work permit required",
    ];
    for (const line of lawful) {
      expect(screenDealBreaker(line), line).toBeNull();
    }
  });

  it("does not fire on ordinary words that contain a term", () => {
    // "age" inside agency/manage, "race" inside racing, "trans" inside
    // transaction — the reason every rule is word-bounded.
    const innocent = [
      "No agency-only backgrounds",
      "Must have managed a team",
      "No experience racing to deadlines without process",
      "No transaction-processing background",
      "React Native experience is not enough on its own",
      "Average tenure under one year",
    ];
    for (const line of innocent) {
      expect(screenDealBreaker(line), line).toBeNull();
    }
  });

  it("ignores blank lines", () => {
    expect(screenDealBreaker("")).toBeNull();
    expect(screenDealBreaker("   ")).toBeNull();
    expect(screenDealBreaker(null)).toBeNull();
    expect(screenDealBreaker(undefined)).toBeNull();
  });
});

describe("list helpers", () => {
  const lines = ["No agency-only backgrounds", "no citizenship", "Cannot start within six weeks"];

  it("reports flags by row index", () => {
    const flags = screenDealBreakers(lines);
    expect(Object.keys(flags)).toEqual(["1"]);
    expect(flags[1]!.characteristic).toBe("nationality or citizenship");
  });

  it("returns only the lines that will actually be used", () => {
    expect(usableDealBreakers(lines)).toEqual([
      "No agency-only backgrounds",
      "Cannot start within six weeks",
    ]);
  });

  it("keeps the flagged text rather than deleting it", () => {
    // The client must see what happened to what they typed. A rule silently
    // dropped is worse than one visibly excluded.
    expect(lines).toContain("no citizenship");
    expect(screenDealBreakers(lines)[1]).toBeTruthy();
  });
});
