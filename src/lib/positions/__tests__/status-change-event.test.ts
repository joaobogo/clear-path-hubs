/**
 * A role's status change raises one notification event. It used to raise two,
 * so a client was emailed "Your role is live" twice, the first linking to an
 * admin page (24 Nov 2026).
 */
import { describe, expect, it } from "vitest";
import { statusChangeEvent } from "@/lib/positions/status-change-event";

const ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-24T17:38:47.000Z");

describe("statusChangeEvent", () => {
  it("one event for an activation, each side linked to its own page", () => {
    const e = statusChangeEvent({
      positionId: ID,
      action: "activate",
      beforeStatus: "approved",
      nextStatus: "active",
      title: "Enterprise Sales Director",
      now: NOW,
    })!;
    expect(e.event).toBe("position_activated");
    expect(e.link_path_by_audience).toEqual({
      client: `/client/positions/${ID}`,
      admin: `/admin/positions/${ID}`,
    });
    expect(e.scope).toBe(`${ID}:activate:${NOW.getTime()}`);
    expect(e.payload).toEqual({ title: "Enterprise Sales Director", reason: null, note: null });
  });

  it("names the event for every announced action", () => {
    const events = [
      ["submit", "draft", "submitted", "intake_submitted"],
      ["approve", "submitted", "approved", "position_approved"],
      ["reopen", "paused", "active", "position_reopened"],
      ["pause", "active", "paused", "position_paused"],
      ["close", "active", "closed", "position_closed"],
      ["mark_filled", "active", "filled", "position_filled"],
      ["request_clarification", "submitted", "needs_clarification", "clarification_requested"],
    ] as const;
    for (const [action, from, to, event] of events) {
      expect(
        statusChangeEvent({ positionId: ID, action, beforeStatus: from, nextStatus: to })?.event,
      ).toBe(event);
    }
  });

  it("carries the reason when one was written", () => {
    const e = statusChangeEvent({
      positionId: ID,
      action: "approve",
      beforeStatus: "submitted",
      nextStatus: "approved",
      reason: "Spec reviewed with the client.",
    })!;
    expect(e.payload.reason).toBe("Spec reviewed with the client.");
    expect(e.payload.note).toBe("Spec reviewed with the client.");
  });

  it("a later pause after a resume is a new event", () => {
    const first = statusChangeEvent({
      positionId: ID,
      action: "pause",
      beforeStatus: "active",
      nextStatus: "paused",
      now: NOW,
    })!;
    const later = statusChangeEvent({
      positionId: ID,
      action: "pause",
      beforeStatus: "active",
      nextStatus: "paused",
      now: new Date(NOW.getTime() + 86_400_000),
    })!;
    expect(first.scope).not.toBe(later.scope);
  });

  it("a second click that changes nothing announces nothing", () => {
    expect(
      statusChangeEvent({
        positionId: ID,
        action: "activate",
        beforeStatus: "active",
        nextStatus: "active",
      }),
    ).toBeNull();
  });

  it("actions with no announcement stay silent", () => {
    for (const action of ["start_review", "archive", "unarchive"]) {
      expect(
        statusChangeEvent({
          positionId: ID,
          action,
          beforeStatus: "draft",
          nextStatus: "archived",
        }),
      ).toBeNull();
    }
  });
});
