/**
 * Keeping a candidate for the future refreshes every tab that shows it.
 *
 * One record, four readers: the talent pool tab, the resurface panel on a role,
 * the memory sheet, and the indicator on the candidate's own profile. Each
 * mutation site invalidated whichever keys its author remembered — the tag
 * dialog refreshed all four, while the resurface panel and the memory sheet
 * refreshed only `["talent-memory"]`. So a consent, reason or archive change
 * made from those two never reached the talent pool, and the tabs disagreed
 * until a hard reload.
 *
 * The keys now live in one helper, and this holds every mutation site to it —
 * the drift happened because each site was free to choose.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { invalidateTalentMemory } from "@/lib/talent-memory/invalidate";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Every component that writes talent memory. */
const MUTATION_SITES = [
  "src/components/client/tag-silver-medalist-dialog.tsx",
  "src/components/client/resurface-panel.tsx",
  "src/components/client/talent-memory/memory-sheet.tsx",
];

describe("the shared invalidation covers every reader", () => {
  it("refreshes the pool, the memory lists and the archived count", () => {
    const invalidateQueries = vi.fn();
    invalidateTalentMemory({ invalidateQueries } as never);

    const keys = invalidateQueries.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(keys).toContain('["talent-memory"]');
    expect(keys, "the pool tab is the one that was being missed").toContain('["talent-pool"]');
    expect(keys).toContain('["talent-memory-archived-count"]');
  });

  it("refreshes the candidate's own indicator when the write came from a profile", () => {
    const invalidateQueries = vi.fn();
    invalidateTalentMemory({ invalidateQueries } as never, "match-1");
    const keys = invalidateQueries.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(keys).toContain('["memory-by-match","match-1"]');
  });

  it("skips the per-match key when there is no match in scope", () => {
    // The pool and sheet edit a memory, not a match — inventing a key there
    // would invalidate nothing and read as though it had.
    const invalidateQueries = vi.fn();
    invalidateTalentMemory({ invalidateQueries } as never);
    const keys = invalidateQueries.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(keys.some((k) => k.includes("memory-by-match"))).toBe(false);
  });
});

describe("no mutation site rolls its own", () => {
  it.each(MUTATION_SITES)("%s calls the shared helper", (file) => {
    expect(read(file)).toMatch(/invalidateTalentMemory\(/);
  });

  it.each(MUTATION_SITES)("%s does not hand-pick talent-memory keys", (file) => {
    // Hand-picking is how the pool tab got left out of two of the three.
    const src = read(file);
    expect(
      src,
      "invalidate through the helper so a new reader is picked up everywhere at once",
    ).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\["talent-(memory|pool)"/);
  });
});
