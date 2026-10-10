/**
 * The convergence field, as geometry (The Run).
 *
 * Every line is a person who heard about the role. Lines enter on one edge,
 * thin at three gates (matched, scored, signed) and ten survive, ending
 * exactly on the ten list rows. This module only computes the lines; the
 * canvas component draws them and the tests check them.
 *
 * Pure and seeded: the same role name always draws the same field, so the
 * page can be rendered twice (or as a still) and look the same.
 */

export type Point = { x: number; y: number };

export type FieldLine = {
  /** Cubic bezier control points, in canvas pixels. */
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
  /** Gates this line passed: 0 ends at the first gate, 3 reaches a list row. */
  passed: 0 | 1 | 2 | 3;
  /** For survivors: which list row (0–9) the line ends on. */
  target?: number;
};

export type FieldOptions = {
  width: number;
  height: number;
  /** Where the ten survivors end, in canvas pixels, in list order. */
  targets: readonly Point[];
  /** The four counts of the run: reached, matched, scored, signed. */
  counts: readonly [number, number, number, number];
  /** Gate positions as a fraction of the flow axis. */
  gates?: readonly [number, number, number];
  /** How many drawn lines stand for `counts[0]` people. */
  lines?: number;
  /** "right": enter bottom-left and flow right (desktop). "down": enter top and flow down (phone). */
  flow?: "right" | "down";
  seed: string;
};

export const FIELD_GATES: readonly [number, number, number] = [0.4, 0.52, 0.62];
export const FIELD_LINES = 1700;

/** Small, fast, deterministic PRNG (mulberry32) seeded from a string. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many drawn lines pass each gate, so the drawing keeps the run's
 * proportions: matched/reached of the lines pass gate one, and so on. The
 * last gate always passes exactly ten, one per list row.
 */
export function survivorsPerGate(
  counts: readonly [number, number, number, number],
  lines: number,
): [number, number, number, number] {
  const [reached, matched, scored, signed] = counts;
  const g1 = Math.max(signed, Math.round((lines * matched) / reached));
  const g2 = Math.max(signed, Math.round((lines * scored) / reached));
  return [lines, g1, Math.min(g1, g2), Math.min(g2, signed)];
}

export function buildField(opts: FieldOptions): FieldLine[] {
  const { width, height, targets, counts } = opts;
  const gates = opts.gates ?? FIELD_GATES;
  const total = opts.lines ?? FIELD_LINES;
  const flow = opts.flow ?? "right";
  const rand = seeded(opts.seed);

  // Work in flow coordinates: `a` along the flow (0..A), `b` across it (0..B).
  const A = flow === "right" ? width : height;
  const B = flow === "right" ? height : width;
  const toXY = (a: number, b: number): Point => (flow === "right" ? { x: a, y: b } : { x: b, y: a });
  const toAB = (p: Point): [number, number] => (flow === "right" ? [p.x, p.y] : [p.y, p.x]);

  const [, atGate1, atGate2, survivors] = survivorsPerGate(counts, total);
  const lines: FieldLine[] = [];

  for (let i = 0; i < total; i++) {
    const passed: 0 | 1 | 2 | 3 = i < survivors ? 3 : i < atGate2 ? 2 : i < atGate1 ? 1 : 0;

    // Entry: the lower half of the leading edge on desktop ("enter
    // bottom-left"), so the crowd runs under the headline and only the ten
    // survivors climb across it to the list; the full top edge on a phone.
    const entryB =
      flow === "right" ? B * (0.5 + 0.5 * rand()) : B * (0.05 + 0.9 * rand());
    const p0 = toXY(-2, entryB);

    let endA: number;
    let endB: number;
    let target: number | undefined;
    if (passed === 3) {
      target = i % targets.length;
      [endA, endB] = toAB(targets[target]!);
    } else {
      // Ends a little past its last gate, spread across the field so the
      // thinning reads as a band, not a wall.
      const gateA = A * gates[passed];
      endA = gateA + A * 0.06 * rand();
      endB = flow === "right" ? B * (0.45 + 0.53 * rand()) : B * (0.05 + 0.9 * rand());
    }

    // Two control points: the first keeps the entry heading, the second
    // bends toward the end so survivors arrive on the row from the left.
    const c1 = toXY(endA * (0.3 + 0.2 * rand()), entryB + (endB - entryB) * 0.15 * rand());
    const c2 = toXY(endA * (0.7 + 0.15 * rand()), endB + (entryB - endB) * 0.1 * rand());
    lines.push({ p0, c1, c2, p1: toXY(endA, endB), passed, target });
  }
  return lines;
}

/** A point on a cubic bezier at t in [0, 1]. */
export function bezierAt(l: FieldLine, t: number): Point {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * l.p0.x + w1 * l.c1.x + w2 * l.c2.x + w3 * l.p1.x,
    y: w0 * l.p0.y + w1 * l.c1.y + w2 * l.c2.y + w3 * l.p1.y,
  };
}
