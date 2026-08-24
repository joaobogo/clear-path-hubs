import { describe, expect, it } from "vitest";
import { normalizeOfferRecord } from "@/lib/hires/confirmed";

describe("offer record coherence", () => {
  it("a confirmed hire never carries a close reason or decline date", () => {
    const r = normalizeOfferRecord({
      status: "hire_confirmed",
      close_reason: "candidate_declined",
      close_reason_notes: "note",
      declined_at: "2026-08-22T00:00:00Z",
      closed_at: "2026-08-22T00:00:00Z",
      hired_at: "2026-08-22T20:51:02Z",
    });
    expect(r.status).toBe("hire_confirmed");
    expect(r.close_reason).toBeNull();
    expect(r.declined_at).toBeNull();
    expect(r.closed_at).toBeNull();
  });

  it("a hire date with no close evidence outranks a closed status", () => {
    const r = normalizeOfferRecord({
      status: "closed_lost",
      close_reason: null,
      declined_at: null,
      hired_at: "2026-08-22T20:51:02Z",
    });
    expect(r.status).toBe("hire_confirmed");
  });

  it("a genuine close with a recorded reason is left alone", () => {
    const r = normalizeOfferRecord({
      status: "closed_lost",
      close_reason: "budget",
      declined_at: null,
      hired_at: null,
    });
    expect(r.status).toBe("closed_lost");
    expect(r.close_reason).toBe("budget");
  });
});
