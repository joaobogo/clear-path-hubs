import { describe, expect, it, vi } from "vitest";
import { drainRescore, MAX_RESCORE_PASSES, type RescoreBatch } from "@/lib/scoring/rescore-drain";

const batch = (over: Partial<RescoreBatch> = {}): RescoreBatch => ({
  rescored: 0,
  examined: 0,
  failed: [],
  ...over,
});

/** Returns each scripted batch in turn, then empty batches forever. */
function scripted(batches: RescoreBatch[]) {
  let i = 0;
  return vi.fn(async () => batches[i++] ?? batch({ examined: 7 }));
}

describe("drainRescore", () => {
  it("keeps going until a pass re-scores nothing", async () => {
    const run = scripted([
      batch({ rescored: 50, examined: 50 }),
      batch({ rescored: 50, examined: 50 }),
      batch({ rescored: 12, examined: 50 }),
      batch({ rescored: 0, examined: 38 }),
    ]);
    const totals = await drainRescore(run);
    expect(run).toHaveBeenCalledTimes(4);
    expect(totals.rescored).toBe(112);
    expect(totals.passes).toBe(4);
    expect(totals.hitPassLimit).toBe(false);
  });

  /**
   * The subtle one. The server keeps EXAMINING rows it skips because they are
   * already on the current engine, so a loop that stopped on `examined === 0`
   * would never terminate once only up-to-date candidates remained.
   */
  it("stops on rescored, not examined — skipped rows must not keep it looping", async () => {
    const run = scripted([batch({ rescored: 0, examined: 50 })]);
    const totals = await drainRescore(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(totals.rescored).toBe(0);
    expect(totals.examined).toBe(50);
  });

  it("does one pass and stops when everything is already current", async () => {
    const run = scripted([batch({ rescored: 0, examined: 0 })]);
    const totals = await drainRescore(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(totals).toMatchObject({ rescored: 0, failed: 0, passes: 1, hitPassLimit: false });
  });

  it("counts failures without stopping the drain", async () => {
    const run = scripted([
      batch({ rescored: 4, examined: 5, failed: [{ id: "a", error: "boom" }] }),
      batch({ rescored: 3, examined: 5, failed: [{ id: "b", error: "boom" }] }),
      batch({ rescored: 0, examined: 5 }),
    ]);
    const totals = await drainRescore(run);
    expect(totals.rescored).toBe(7);
    expect(totals.failed).toBe(2);
    expect(totals.passes).toBe(3);
  });

  it("cannot spin forever if the server always claims work", async () => {
    const run = vi.fn(async () => batch({ rescored: 50, examined: 50 }));
    const totals = await drainRescore(run, undefined, 5);
    expect(run).toHaveBeenCalledTimes(5);
    expect(totals.hitPassLimit).toBe(true);
  });

  it("reports running totals so a long sweep never looks hung", async () => {
    const seen: number[] = [];
    const run = scripted([
      batch({ rescored: 50, examined: 50 }),
      batch({ rescored: 20, examined: 50 }),
      batch({ rescored: 0, examined: 10 }),
    ]);
    await drainRescore(run, (t) => seen.push(t.rescored));
    expect(seen).toEqual([50, 70, 70]);
  });

  it("propagates a hard failure rather than reporting a false success", async () => {
    const run = vi.fn(async () => {
      throw new Error("forbidden");
    });
    await expect(drainRescore(run)).rejects.toThrow("forbidden");
  });

  it("ships a ceiling far above any real workspace", () => {
    expect(MAX_RESCORE_PASSES * 50).toBeGreaterThanOrEqual(10_000);
  });
});
