/**
 * An agent that has never run must not say it is working.
 *
 * "On and working." came from the enabled flag alone, so an agent with no
 * recorded action was presented identically to one that ran this morning — on
 * a page that promises to show "what it is doing now". Sourcing and Market
 * Research read "On and working." directly above "LAST THING IT DID: Nothing
 * yet" and "PRODUCED THIS WEEK: 0", and Operations attributed 33 of 33
 * candidates to the public job board, meaning Sourcing had never produced
 * anything on that account at all (audit 1 Sep, F21).
 *
 * Nothing about it was dishonest — the status was wired to the wrong signal.
 * But it told a paying customer that the part of the service they are buying
 * was running when it never had, on the page they are most likely to
 * screenshot in a dispute.
 */
import { describe, expect, it } from "vitest";
import { agentStateLine } from "@/lib/agents/registry";

const WINDOW = "2026-08-25T00:00:00.000Z";
const IN_WINDOW = "2026-08-28T09:00:00.000Z";
const BEFORE_WINDOW = "2026-07-01T09:00:00.000Z";

const base = { enabled: true, pausedAt: null, offConsequence: "Nothing is sourced." };

describe("agentStateLine", () => {
  it("does not claim to be working when it has never run", () => {
    const line = agentStateLine({ ...base, lastActionAt: null, windowStart: WINDOW });
    expect(line).not.toMatch(/On and working/);
    expect(line).toMatch(/has not run yet/i);
  });

  it("says it is working when it acted inside the window", () => {
    expect(agentStateLine({ ...base, lastActionAt: IN_WINDOW, windowStart: WINDOW })).toBe(
      "On and working.",
    );
  });

  it("says it is idle when it last acted before the window", () => {
    const line = agentStateLine({ ...base, lastActionAt: BEFORE_WINDOW, windowStart: WINDOW });
    expect(line).toMatch(/nothing to do/i);
    expect(line).not.toMatch(/On and working/);
  });

  it("gives the reason for being idle when there is one", () => {
    const line = agentStateLine({
      ...base,
      lastActionAt: BEFORE_WINDOW,
      windowStart: WINDOW,
      idleReason: "no open role needs sourcing",
    });
    expect(line).toContain("no open role needs sourcing");
  });

  it("still reports paused and off first", () => {
    expect(
      agentStateLine({ ...base, pausedAt: IN_WINDOW, lastActionAt: null }),
    ).toMatch(/Paused/);
    expect(
      agentStateLine({ ...base, enabled: false, lastActionAt: IN_WINDOW }),
    ).toMatch(/^Off\./);
  });

  it("never says working with no action, under any window", () => {
    // The property the whole finding reduces to.
    for (const windowStart of [WINDOW, null, undefined]) {
      const line = agentStateLine({ ...base, lastActionAt: null, windowStart });
      expect(line, String(windowStart)).not.toMatch(/On and working/);
    }
  });
});
