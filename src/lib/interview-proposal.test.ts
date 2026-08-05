import { describe, expect, it } from "vitest";
import {
  MIN_NOTICE_HOURS,
  assertProposedSlots,
  emptyProposal,
  isEmail,
  validateProposal,
} from "./interview-proposal";

const HOUR = 3600_000;
const now = Date.parse("2026-03-02T09:00:00.000Z");
const iso = (hoursFromNow: number) => new Date(now + hoursFromNow * HOUR).toISOString();

describe("assertProposedSlots", () => {
  it("accepts two or three slots at least 24 hours out", () => {
    expect(assertProposedSlots([iso(30), iso(50)], now)).toHaveLength(2);
    expect(assertProposedSlots([iso(30), iso(50), iso(72)], now)).toHaveLength(3);
  });

  it("rejects fewer than two slots", () => {
    expect(() => assertProposedSlots([iso(30)], now)).toThrow(/slots/);
  });

  it("rejects more than three slots", () => {
    expect(() => assertProposedSlots([iso(30), iso(40), iso(50), iso(60)], now)).toThrow(/slots/);
  });

  it("rejects slots inside the notice window", () => {
    expect(() => assertProposedSlots([iso(MIN_NOTICE_HOURS - 1), iso(50)], now)).toThrow(/too_soon/);
  });

  it("rejects duplicates", () => {
    expect(() => assertProposedSlots([iso(30), iso(30)], now)).toThrow();
  });
});

describe("validateProposal", () => {
  const base = () => {
    const d = emptyProposal("Europe/London");
    return d;
  };

  it("flags a proposal with no usable slots", () => {
    const result = validateProposal(base(), now);
    expect(result.valid).toBe(false);
  });

  it("flags an unreachable attendee", () => {
    expect(isEmail("someone@")).toBe(false);
    expect(isEmail("hiring@taasflow.com")).toBe(true);
  });
});
