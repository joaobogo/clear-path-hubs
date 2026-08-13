/**
 * Guard: every authenticated dashboard route must be able to render all four
 * read states — loading skeleton, empty, error with a retry, and populated.
 *
 * The cheap structural proxy for that is: any route that reads data must reach
 * an error path (directly, or through a shared helper that owns one), and the
 * authenticated subtree must always have a route-level error boundary so a
 * thrown error never blanks the workspace.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/routes/_authenticated");
const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));

/** Helpers that already render loading + error + empty + retry internally. */
const STATE_OWNERS = [
  "QueryState",
  "panelState",
  "SurfaceState",
  "useStuckAfter",
  "loadFailed",
];

function read(file: string) {
  return readFileSync(join(DIR, file), "utf8");
}

describe("authenticated route read states", () => {
  it("finds route files to audit", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("gives the authenticated subtree a route-level error boundary", () => {
    const gate = readFileSync(join(DIR, "route.tsx"), "utf8");
    expect(gate).toContain("errorComponent");
    expect(gate).toContain("notFoundComponent");
  });

  it.each(files.filter((f) => read(f).includes("useQuery(")))(
    "%s handles a failed read",
    (file) => {
      const src = read(file);
      const handled =
        STATE_OWNERS.some((owner) => src.includes(owner)) ||
        src.includes("isError") ||
        src.includes("query.error");
      expect(handled, `${file} renders no error state for its read`).toBe(true);
    },
  );

  it.each(files.filter((f) => read(f).includes("useQuery(")))(
    "%s offers a way to recover from a failed read",
    (file) => {
      const src = read(file);
      const recoverable =
        STATE_OWNERS.some((owner) => src.includes(owner)) ||
        src.includes("refetch") ||
        src.includes("invalidateQueries");
      expect(recoverable, `${file} has no retry path`).toBe(true);
    },
  );
});
