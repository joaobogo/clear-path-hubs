import { describe, it, expect } from "vitest";
import { shortlistCommitment } from "@/lib/client-commitment";

const P = "2026-07-10T09:00:00.000Z";

describe("shortlistCommitment", () => {
  it("reports a miss as plainly as a win", () => {
    const late = shortlistCommitment({
      promisedShortlistBy: P,
      shortlistDeliveredAt: "2026-07-13T09:00:00.000Z",
    });
    expect(late.state).toBe("missed");
    expect(late.varianceDays).toBe(3);
    expect(late.varianceLabel).toBe("3 days late");
  });

  it("marks early delivery", () => {
    const early = shortlistCommitment({
      promisedShortlistBy: P,
      shortlistDeliveredAt: "2026-07-09T09:00:00.000Z",
    });
    expect(early.state).toBe("met");
    expect(early.varianceLabel).toBe("1 day early");
  });

  it("counts overdue days while still open", () => {
    const open = shortlistCommitment({
      promisedShortlistBy: P,
      shortlistDeliveredAt: null,
      now: new Date("2026-07-12T09:00:00.000Z").getTime(),
    });
    expect(open.state).toBe("overdue");
    expect(open.varianceLabel).toBe("2 days late so far");
  });

  it("shows remaining time before the promise date", () => {
    const waiting = shortlistCommitment({
      promisedShortlistBy: P,
      shortlistDeliveredAt: null,
      now: new Date("2026-07-08T09:00:00.000Z").getTime(),
    });
    expect(waiting.state).toBe("waiting");
    expect(waiting.varianceLabel).toBe("2 days remaining");
  });

  it("never invents a promise", () => {
    const none = shortlistCommitment({ promisedShortlistBy: null, shortlistDeliveredAt: null });
    expect(none.state).toBe("none");
    expect(none.varianceLabel).toBe("—");
  });
});
