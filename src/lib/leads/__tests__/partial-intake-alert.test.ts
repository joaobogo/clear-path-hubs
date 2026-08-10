import { describe, expect, it, vi, beforeEach } from "vitest";

const { processLeadEvent } = vi.hoisted(() => ({
  processLeadEvent: vi.fn(async (_event: unknown) => undefined),
}));
vi.mock("../lead-pipeline.server", () => ({ processLeadEvent }));

import { alertPartialIntake } from "../partial-intake-alert.server";

describe("alertPartialIntake", () => {
  beforeEach(() => processLeadEvent.mockClear());

  it("stays silent when nothing identifiable has been entered", async () => {
    await alertPartialIntake({
      draftKey: "draft-1",
      payload: { notes: "just typing" },
      lastStep: 0,
      source: "intake_anonymous_draft",
    });
    expect(processLeadEvent).not.toHaveBeenCalled();
  });

  it.each(["firstName", "workEmail", "companyName", "roleTitle"])(
    "fires as soon as %s is present",
    async (field) => {
      await alertPartialIntake({
        draftKey: "draft-2",
        payload: { [field]: "value" },
        lastStep: 1,
        source: "intake_anonymous_draft",
      });
      expect(processLeadEvent).toHaveBeenCalledTimes(1);
    },
  );

  it("keys idempotency per draft AND per step so autosaves do not spam", async () => {
    const payload = { companyName: "Acme", roleTitle: "Head of Ops" };
    await alertPartialIntake({ draftKey: "d3", payload, lastStep: 1, source: "s" });
    await alertPartialIntake({ draftKey: "d3", payload, lastStep: 1, source: "s" });
    await alertPartialIntake({ draftKey: "d3", payload, lastStep: 2, source: "s" });

    const keys = processLeadEvent.mock.calls.map(
      (c) => (c[0] as unknown as { sourceId: string }).sourceId,
    );
    expect(keys).toEqual(["d3:1", "d3:1", "d3:2"]);
    expect(new Set(keys).size).toBe(2);
  });

  it("reports the furthest step reached and never-submitted status", async () => {
    await alertPartialIntake({
      draftKey: "d4",
      payload: { companyName: "Acme" },
      lastStep: 3,
      source: "s",
    });
    const event = processLeadEvent.mock.calls[0]?.[0] as unknown as {
      leadType: string;
      facts: { label: string; value: string | null }[];
    };
    expect(event.leadType).toBe("partial_intake");
    expect(event.facts).toEqual(
      expect.arrayContaining([
        { label: "Status", value: "Started, not submitted" },
        { label: "Furthest step reached", value: "Step 4 — review and submit" },
      ]),
    );
  });

  it("never throws when the pipeline fails", async () => {
    processLeadEvent.mockRejectedValueOnce(new Error("pipeline down"));
    await expect(
      alertPartialIntake({
        draftKey: "d5",
        payload: { companyName: "Acme" },
        lastStep: 0,
        source: "s",
      }),
    ).resolves.toBeUndefined();
  });
});
