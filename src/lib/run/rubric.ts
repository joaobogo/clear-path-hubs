/**
 * The Brief chapter's rubric arithmetic. Dragging one weight rebalances the
 * other sliders so the whole rubric always totals 100; the chips keep their
 * weights. Integers only, so the numbers on screen add up exactly.
 */

/**
 * Set slider `index` to `next` and spread the difference across the other
 * sliders in proportion to their current weights. `fixed` is the total held
 * by weights that do not move (the chips).
 */
export function rebalance(sliders: readonly number[], index: number, next: number, fixed: number): number[] {
  const budget = 100 - fixed;
  const others = sliders.map((w, i) => (i === index ? 0 : w));
  const othersTotal = others.reduce((a, b) => a + b, 0);
  const value = Math.max(0, Math.min(budget, Math.round(next)));
  const remaining = budget - value;
  const out = sliders.map((w, i) => {
    if (i === index) return value;
    if (othersTotal === 0) return 0;
    return Math.floor((remaining * w) / othersTotal);
  });
  // Rounding leaves a few points over: give them to the largest other weight.
  let left = budget - out.reduce((a, b) => a + b, 0);
  const order = others
    .map((w, i) => [w, i] as const)
    .filter(([, i]) => i !== index)
    .sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length) {
    out[order[k]![1]]! += 1;
    left -= 1;
  }
  return out;
}

/** A candidate's weighted score, 0 to 100, from per-requirement scores and weights that total 100. */
export function weightedScore(scores: readonly number[], weights: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < scores.length; i++) total += (scores[i] ?? 0) * (weights[i] ?? 0);
  return Math.round(total / 100);
}
