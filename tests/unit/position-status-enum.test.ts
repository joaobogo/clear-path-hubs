/**
 * POSITION_STATUS_VALUES must equal the database enum.
 *
 * POSITION_STATUS_VOCABULARY is a display registry carrying legacy and alias
 * keys ("open", "published", "intake", "cancelled"…) so old rows still render
 * as English. It was read as the domain, which is how `p.status === "open"`
 * reached the client weekly-update draft: "open" is a label in that map but has
 * never been a value of the enum, so the draft reported "Open roles: 0" to
 * every client, always.
 *
 * This parses the migrations and pins the constant to them, so a value added to
 * the database without being added here fails the build.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { POSITION_STATUS_VALUES } from "@/lib/vocabulary";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** The enum as the database actually defines it: CREATE TYPE plus ADD VALUEs. */
function positionStatusFromMigrations(): Set<string> {
  const values = new Set<string>();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are timestamps, so this is chronological

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");

    const created = sql.match(
      /CREATE TYPE\s+public\.position_status\s+AS ENUM\s*\(([^)]*)\)/is,
    );
    if (created) {
      for (const m of created[1]!.matchAll(/'([a-z_]+)'/gi)) values.add(m[1]!);
    }

    for (const m of sql.matchAll(
      /ALTER TYPE\s+public\.position_status\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([a-z_]+)'/gi,
    )) {
      values.add(m[1]!);
    }
  }
  return values;
}

describe("position status domain", () => {
  const fromDb = positionStatusFromMigrations();

  it("finds the enum in the migrations", () => {
    expect(fromDb.size).toBeGreaterThan(5);
    expect(fromDb.has("active")).toBe(true);
  });

  it("matches the database exactly", () => {
    expect([...POSITION_STATUS_VALUES].sort()).toEqual([...fromDb].sort());
  });

  it("does not contain the display-only labels that caused the bug", () => {
    for (const notAStatus of ["open", "published", "intake", "cancelled", "pending_review"]) {
      expect(
        (POSITION_STATUS_VALUES as readonly string[]).includes(notAStatus),
        `"${notAStatus}" is a display label, not a position status`,
      ).toBe(false);
    }
  });
});
