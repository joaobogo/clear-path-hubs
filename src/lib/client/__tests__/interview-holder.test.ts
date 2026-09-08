/**
 * A client can only confirm a time that is on the table.
 *
 * The Interviews page headed every pending interview "Waiting on you to
 * confirm a time" while each row read "No times sent yet". Admin's work queue
 * listed the same three as "Interviews to coordinate" owned by TaaSFlow, and
 * the SLA desk showed the breach at 267.5h against a 24-hour commitment — so
 * the client was shown our eleven-day miss as their own inaction
 * (audit 1 Sep, F16).
 */
import { describe, expect, it } from "vitest";
import { interviewHolder } from "@/lib/client/interview-holder";

// Anchored to the real clock, because the code under test is. A fixed anchor
// ("2026-09-01") made every "future" slot silently past once that date went
// by, and the test began failing without anything having changed.
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const past = (days: number) => future(-days);

describe("interviewHolder", () => {
  it("is ours when no times have ever been sent", () => {
    // The observed case.
    const r = interviewHolder({ proposed_times: [], availability_expires_at: null });
    expect(r.holder).toBe("us");
    expect(r.status).toMatch(/not sent times yet/i);
  });

  it("is ours when nothing was ever proposed and the field is null", () => {
    expect(interviewHolder({}).holder).toBe("us");
    expect(interviewHolder({ proposed_times: null }).holder).toBe("us");
  });

  it("is the client's when live times are on the table", () => {
    const r = interviewHolder({
      proposed_times: [future(2), future(3)],
      availability_expires_at: future(5),
    });
    expect(r.holder).toBe("client");
    expect(r.status).toMatch(/pick one/i);
  });

  it("returns to us when every proposed time has passed", () => {
    const r = interviewHolder({
      proposed_times: [past(3), past(2)],
      availability_expires_at: null,
    });
    expect(r.holder).toBe("us");
    expect(r.status).toMatch(/have passed/i);
  });

  it("returns to us when the availability window has expired", () => {
    const r = interviewHolder({
      proposed_times: [future(2)],
      availability_expires_at: past(1),
    });
    expect(r.holder).toBe("us");
  });

  it("never tells the client to confirm when there is nothing to confirm", () => {
    // The property the whole finding reduces to.
    const nothingOnTheTable = [
      { proposed_times: [] },
      { proposed_times: null },
      {},
      { proposed_times: [past(1)] },
      { proposed_times: [future(1)], availability_expires_at: past(1) },
    ];
    for (const iv of nothingOnTheTable) {
      expect(interviewHolder(iv).holder, JSON.stringify(iv)).toBe("us");
    }
  });

  it("gives one status per record, never two that contradict", () => {
    // "No times still available — we will send new ones" and "No times sent
    // yet" were both shown for the same interview.
    const never = interviewHolder({ proposed_times: [] }).status;
    const lapsed = interviewHolder({ proposed_times: [past(1)] }).status;
    expect(never).not.toBe(lapsed);
    expect(never).not.toMatch(/send new ones/i);
    expect(lapsed).toMatch(/send new ones/i);
  });
});
