import { describe, expect, it } from "vitest";
import { bezierAt, buildField, seeded, survivorsPerGate, FIELD_LINES } from "@/lib/run/field";
import { PREVIEW_RUN_FUNNEL } from "@/lib/previews/representative-fixtures";

const counts = PREVIEW_RUN_FUNNEL.map((s) => s.count) as [number, number, number, number];
const targets = Array.from({ length: 10 }, (_, i) => ({ x: 1120, y: 180 + i * 44 }));

describe("the convergence field", () => {
  it("draws the run's proportions and exactly ten survivors", () => {
    const [all, g1, g2, g3] = survivorsPerGate(counts, FIELD_LINES);
    expect(all).toBe(FIELD_LINES);
    expect(g1).toBe(Math.round((FIELD_LINES * counts[1]) / counts[0]));
    expect(g2).toBe(Math.round((FIELD_LINES * counts[2]) / counts[0]));
    expect(g3).toBe(10);
    expect(g1).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(g3);
  });

  it("ends each survivor exactly on its list row, one per row", () => {
    const lines = buildField({ width: 1440, height: 960, targets, counts, seed: "Registered nurse" });
    expect(lines).toHaveLength(FIELD_LINES);
    const survivors = lines.filter((l) => l.passed === 3);
    expect(survivors).toHaveLength(10);
    expect(new Set(survivors.map((l) => l.target)).size).toBe(10);
    for (const l of survivors) {
      expect(l.p1).toEqual(targets[l.target!]);
      const end = bezierAt(l, 1);
      expect(end.x).toBeCloseTo(l.p1.x, 6);
      expect(end.y).toBeCloseTo(l.p1.y, 6);
    }
  });

  it("stops the others a little past their last gate", () => {
    const lines = buildField({ width: 1000, height: 600, targets, counts, seed: "Line cook" });
    for (const l of lines) {
      if (l.passed === 3) continue;
      const gate = 1000 * [0.4, 0.52, 0.62][l.passed];
      expect(l.p1.x).toBeGreaterThanOrEqual(gate);
      expect(l.p1.x).toBeLessThanOrEqual(gate + 60);
    }
  });

  it("is the same drawing for the same role, and a different one for another", () => {
    const a = buildField({ width: 1440, height: 960, targets, counts, seed: "Registered nurse" });
    const b = buildField({ width: 1440, height: 960, targets, counts, seed: "Registered nurse" });
    const c = buildField({ width: 1440, height: 960, targets, counts, seed: "Front desk agent" });
    expect(a).toEqual(b);
    expect(a[0]!.p0).not.toEqual(c[0]!.p0);
    const r = seeded("x");
    expect(r()).toBeGreaterThanOrEqual(0);
    expect(r()).toBeLessThan(1);
  });

  it("flows top to bottom on a phone", () => {
    const phoneTargets = Array.from({ length: 10 }, (_, i) => ({ x: 300, y: 700 + i * 44 }));
    const lines = buildField({
      width: 390,
      height: 1200,
      targets: phoneTargets,
      counts,
      seed: "Registered nurse",
      flow: "down",
    });
    for (const l of lines) {
      expect(l.p0.y).toBe(-2);
      if (l.passed < 3) expect(l.p1.y).toBeGreaterThanOrEqual(1200 * [0.4, 0.52, 0.62][l.passed]);
    }
  });
});
