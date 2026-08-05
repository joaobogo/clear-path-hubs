import { describe, expect, it } from "vitest";
import { changeEligibility } from "@/lib/candidate/interview-change";

const NOW = Date.parse("2026-08-05T12:00:00Z");
const iso = (h: number) => new Date(NOW + h * 3600_000).toISOString();

describe("changeEligibility", () => {
  it("allows changes up to the start time", () => {
    expect(changeEligibility({ scheduledAt: iso(48), status: "scheduled", now: NOW })).toEqual({
      allowed: true,
      shortNotice: false,
      blockedReason: null,
    });
  });

  it("permits short-notice requests and flags them", () => {
    const r = changeEligibility({ scheduledAt: iso(3), status: "scheduled", now: NOW });
    expect(r.allowed).toBe(true);
    expect(r.shortNotice).toBe(true);
  });

  it("stops once the start time has passed", () => {
    const r = changeEligibility({ scheduledAt: iso(-1), status: "scheduled", now: NOW });
    expect(r.allowed).toBe(false);
    expect(r.blockedReason).toContain("has passed");
  });

  it("renders nothing before an interview exists", () => {
    expect(changeEligibility({ scheduledAt: null, status: "requested", now: NOW })).toEqual({
      allowed: false,
      shortNotice: false,
      blockedReason: null,
    });
  });

  it("is closed for cancelled and completed interviews", () => {
    expect(changeEligibility({ scheduledAt: iso(5), status: "cancelled", now: NOW }).allowed).toBe(false);
    expect(changeEligibility({ scheduledAt: iso(5), status: "completed", now: NOW }).allowed).toBe(false);
  });
});
