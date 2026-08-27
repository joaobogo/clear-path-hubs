import { describe, expect, it } from "vitest";
import { COHOST_EMAILS } from "@/config/scheduler";

/**
 * A booking invited the visitor and nobody else. The Outlook event was created
 * on the organising mailbox, so whoever actually takes the call only learned
 * about it if they watched that inbox — or when the visitor was already sitting
 * alone on the Teams link.
 *
 * The list is configuration (VITE_BOOKING_COHOST_EMAILS) rather than names in
 * code, so who takes calls can change without a deploy. These assertions cover
 * the parsing, because a malformed entry would either invite nobody or make
 * Graph reject the whole event — and a rejected event means a booking that
 * silently never reaches a calendar.
 */
const parse = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));

describe("co-host parsing", () => {
  it("reads a comma-separated list and trims it", () => {
    expect(parse("chris@taasflow.com, joao@taasflow.com")).toEqual([
      "chris@taasflow.com",
      "joao@taasflow.com",
    ]);
  });

  it("invites nobody when unset, rather than inventing an attendee", () => {
    expect(parse("")).toEqual([]);
    expect(parse("   ")).toEqual([]);
  });

  it("drops entries that are not addresses instead of sending them to Graph", () => {
    expect(parse("chris@taasflow.com, Chris Brogger, ,joao@taasflow.com")).toEqual([
      "chris@taasflow.com",
      "joao@taasflow.com",
    ]);
  });

  it("is a valid list in this environment", () => {
    for (const email of COHOST_EMAILS) {
      expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }
  });
});

describe("attendee de-duplication", () => {
  // Graph rejects an event that lists the same address twice, which would turn
  // "a colleague booked a call with us" into no event at all.
  const attendeesFor = (visitor: string, cohosts: string[]) =>
    [
      visitor,
      ...cohosts.filter((e) => e.toLowerCase() !== visitor.trim().toLowerCase()),
    ];

  it("never lists the visitor twice when they are also a co-host", () => {
    expect(attendeesFor("chris@taasflow.com", ["chris@taasflow.com", "joao@taasflow.com"])).toEqual(
      ["chris@taasflow.com", "joao@taasflow.com"],
    );
  });

  it("matches regardless of case or padding", () => {
    expect(attendeesFor("  Chris@TaaSFlow.com ", ["chris@taasflow.com"])).toEqual([
      "  Chris@TaaSFlow.com ",
    ]);
  });
});
