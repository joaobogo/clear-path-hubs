/**
 * PROCESSING_STATE_VALUES must equal the database enum.
 *
 * Filters over processing_state were written by hand against a domain nothing
 * pinned. The client overview's "in review with TaaSFlow" count listed eight
 * states and omitted ocr_required, so a candidate blocked on an unreadable CV
 * was counted in no bucket the client could see — not visible, not in review,
 * nowhere. Admin reported 15 candidates for that org; the client saw 12 in
 * review against 13 hidden, and the missing one was excluded by omission
 * rather than by decision (audit 1 Sep, F2 and F8).
 *
 * This mirrors position-status-enum.test.ts, which was written after the same
 * mistake on the position_status axis.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PROCESSING_STATE_VALUES,
  PROCESSING_STATES_BLOCKED,
  PROCESSING_STATES_IN_PROGRESS,
  PROCESSING_STATES_SETTLED,
} from "@/lib/vocabulary";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function processingStateFromMigrations(): Set<string> {
  const values = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");

    const created = sql.match(
      /CREATE TYPE\s+public\.processing_state\s+AS ENUM\s*\(([^)]*)\)/is,
    );
    if (created) for (const m of created[1]!.matchAll(/'([a-z_]+)'/gi)) values.add(m[1]!);

    for (const m of sql.matchAll(
      /ALTER TYPE\s+public\.processing_state\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([a-z_]+)'/gi,
    )) {
      values.add(m[1]!);
    }
  }
  return values;
}

describe("processing state domain", () => {
  const fromDb = processingStateFromMigrations();

  it("finds the enum in the migrations", () => {
    expect(fromDb.size).toBeGreaterThan(5);
    expect(fromDb.has("ocr_required")).toBe(true);
  });

  it("matches the database exactly", () => {
    expect([...PROCESSING_STATE_VALUES].sort()).toEqual([...fromDb].sort());
  });
});

describe("the derived sets account for every state", () => {
  it("splits cleanly into settled and in-progress", () => {
    const all = new Set(PROCESSING_STATE_VALUES);
    const covered = new Set([...PROCESSING_STATES_SETTLED, ...PROCESSING_STATES_IN_PROGRESS]);
    expect([...covered].sort()).toEqual([...all].sort());
  });

  it("counts a blocked candidate as still in progress", () => {
    // The whole point of F2: a candidate needing OCR is not finished, and must
    // not vanish from a count of what we are working on.
    for (const state of PROCESSING_STATES_BLOCKED) {
      expect(
        (PROCESSING_STATES_IN_PROGRESS as readonly string[]).includes(state),
        `${state} is not counted as in progress`,
      ).toBe(true);
    }
  });

  it("does not treat a finished state as in progress", () => {
    expect((PROCESSING_STATES_IN_PROGRESS as readonly string[]).includes("scored")).toBe(false);
    expect((PROCESSING_STATES_IN_PROGRESS as readonly string[]).includes("failed")).toBe(false);
  });
});

describe("no hand-written processing_state list survives", () => {
  it("client-overview derives its in-review filter from the domain", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "client-overview.functions.ts"),
      "utf8",
    );
    // The literal array is what dropped ocr_required.
    expect(src).not.toMatch(/\.in\(\s*"processing_state"\s*,\s*\[\s*\n?\s*"queued"/);
    expect(src).toMatch(/PROCESSING_STATES_IN_PROGRESS|PROCESSING_STATES_BLOCKED/);
  });
});
