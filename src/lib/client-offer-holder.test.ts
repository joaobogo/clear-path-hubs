import { describe, expect, it } from "vitest";
import {
  buildOfferRow,
  expectedResponse,
  lastRecordedEvent,
  offerHolder,
} from "./client-offer-holder";

const NOW = new Date("2026-03-10T12:00:00Z");

describe("lastRecordedEvent", () => {
  it("picks the latest recorded timestamp, not the status", () => {
    const e = lastRecordedEvent({
      status: "offer_drafted",
      drafted_at: "2026-03-01T09:00:00Z",
      sent_at: "2026-03-05T09:00:00Z",
    });
    expect(e?.kind).toBe("sent");
  });

  it("returns null when nothing is recorded", () => {
    expect(lastRecordedEvent({ status: "offer_sent" })).toBeNull();
  });
});

describe("offerHolder — three seeded cases", () => {
  it("sent offer sits with the candidate", () => {
    const h = offerHolder({
      status: "offer_sent",
      drafted_at: "2026-03-01T09:00:00Z",
      sent_at: "2026-03-04T09:00:00Z",
    });
    expect(h.holder).toBe("candidate");
  });

  it("negotiation comes back to the client", () => {
    const h = offerHolder({
      status: "offer_negotiating",
      sent_at: "2026-03-04T09:00:00Z",
      negotiating_at: "2026-03-07T09:00:00Z",
    });
    expect(h.holder).toBe("you");
  });

  it("accepted with no start date sits with the recruiting team", () => {
    const h = offerHolder({
      status: "offer_accepted",
      sent_at: "2026-03-04T09:00:00Z",
      accepted_at: "2026-03-08T09:00:00Z",
    });
    expect(h.holder).toBe("taasflow");
    const withStart = offerHolder({
      status: "offer_accepted",
      accepted_at: "2026-03-08T09:00:00Z",
      start_date: "2026-04-01",
    });
    expect(withStart.holder).toBe("you");
  });

  it("finished offers hold nobody", () => {
    expect(
      offerHolder({ status: "hire_confirmed", hired_at: "2026-03-09T09:00:00Z" }).holder,
    ).toBe("none");
  });
});

describe("expectedResponse", () => {
  it("never invents a date", () => {
    const r = expectedResponse({ status: "offer_sent" }, NOW);
    expect(r.date).toBeNull();
    expect(r.label).toBe("No response date agreed");
    expect(r.overdue).toBe(false);
  });

  it("reads overdue in whole days", () => {
    const r = expectedResponse(
      { status: "offer_sent", expected_response_date: "2026-03-07" },
      NOW,
    );
    expect(r.overdue).toBe(true);
    expect(r.days_late).toBe(3);
  });

  it("reads a future date without alarm", () => {
    const r = expectedResponse(
      { status: "offer_sent", expected_response_date: "2026-03-12" },
      NOW,
    );
    expect(r.overdue).toBe(false);
    expect(r.label).toContain("expected in");
  });
});

describe("buildOfferRow", () => {
  it("flags only live overdue offers for attention", () => {
    const live = buildOfferRow(
      { status: "offer_sent", sent_at: "2026-03-01T09:00:00Z", expected_response_date: "2026-03-05" },
      NOW,
    );
    expect(live.needs_attention).toBe(true);
    const closed = buildOfferRow(
      { status: "offer_declined", declined_at: "2026-03-06T09:00:00Z", expected_response_date: "2026-03-05" },
      NOW,
    );
    expect(closed.needs_attention).toBe(false);
  });
});
