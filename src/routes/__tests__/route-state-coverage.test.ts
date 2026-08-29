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

/**
 * Source with comments stripped.
 *
 * The checks below are substring matches, so a comment that merely NAMES a
 * hook used to count as calling it — a note reading "the guard only matched
 * useQuery(" pulled its own file into the audit and failed the build. The
 * guard measures code, not prose.
 */
function read(file: string) {
  return readFileSync(join(DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
    "%s can render a failed read with a way out",
    (file) => {
      const src = read(file);

      // Loader-seeded reads: the loader owns the first render, so a failure
      // lands on the route error boundary and the query is only a refresh.
      const loaderSeeded = src.includes("loader:") && src.includes("errorComponent");

      const showsFailure =
        STATE_OWNERS.some((owner) => src.includes(owner)) ||
        src.includes("isError") ||
        /\berror\b/.test(src);

      const recoverable =
        STATE_OWNERS.some((owner) => src.includes(owner)) ||
        src.includes("refetch") ||
        src.includes("invalidateQueries");

      expect(
        loaderSeeded || (showsFailure && recoverable),
        `${file} cannot present a failed read with a retry`,
      ).toBe(true);
    },
  );

  /**
   * The case above only matched `useQuery(`. A route reading through
   * `useSuspenseQuery` has no isError branch to find — the hook THROWS — so it
   * passed the audit by having nothing to audit, and one route shipped with no
   * error component at all: a failed read blanked the workspace instead of
   * offering a retry.
   */
  it.each(files.filter((f) => read(f).includes("useSuspenseQuery(")))(
    "%s handles a thrown read with a route error component",
    (file) => {
      const src = read(file);
      expect(
        src.includes("errorComponent"),
        `${file} reads with useSuspenseQuery, which throws on failure, but declares no errorComponent`,
      ).toBe(true);
    },
  );
});
