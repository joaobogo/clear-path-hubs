import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Foundation guard: a failed query must never render as an empty state.
 *
 * Every client route that fetches data has to surface a load failure through
 * the shared error component. This test fails if a route adds a query without
 * an error branch, so no route can quietly fall through to "no candidates".
 */

const ROUTES_DIR = join(process.cwd(), "src/routes/_authenticated");

const routeFiles = readdirSync(ROUTES_DIR)
  .filter((f) => f.startsWith("client") && f.endsWith(".tsx"))
  .sort();

function read(file: string) {
  return readFileSync(join(ROUTES_DIR, file), "utf8");
}

function hasQueries(src: string) {
  return /use(Suspense)?Query\s*\(/.test(src);
}

describe("client routes: error, loading and empty are mutually exclusive", () => {
  it("finds client routes to check", () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  for (const file of routeFiles) {
    const src = read(file);
    if (!hasQueries(src)) continue;

    describe(file, () => {
      it("renders a shared error surface for failed loads", () => {
        const usesSharedError =
          src.includes("QueryErrorCard") || src.includes("QueryView") || src.includes("useQueryState");
        expect(
          usesSharedError,
          `${file} fetches data but never renders QueryErrorCard/QueryView/useQueryState`,
        ).toBe(true);
      });

      it("branches on a query failure before rendering results", () => {
        const branchesOnError =
          /isError/.test(src) || src.includes("QueryView") || src.includes("useQueryState");
        expect(branchesOnError, `${file} has queries but no isError branch`).toBe(true);
      });

      it("does not use a toast as its only error surface", () => {
        const toastOnly =
          /toast\.error/.test(src) && !src.includes("QueryErrorCard") && !src.includes("QueryView");
        expect(toastOnly, `${file} reports load failures only through a toast`).toBe(false);
      });
    });
  }
});
