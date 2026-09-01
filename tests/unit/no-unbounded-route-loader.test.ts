/**
 * A read that never settles must not render as a page that is merely slow.
 *
 * /admin/settings awaited ensureQueryData in its route loader, and the panel
 * it was loading for reads the same query through useSuspenseQuery. When that
 * read did not settle, the page rendered its shell and then grey skeletons
 * indefinitely — three visits at 6s, 10s and 12s, no h1, no content, no error,
 * no retry, nothing in the console. An entire desk in the sidebar was
 * unreachable (audit 1 Sep, F11).
 *
 * errorComponent does not cover this: it catches a REJECTED read, not a hung
 * one. A permanent skeleton is the worst of both worlds — it looks healthy and
 * never resolves.
 *
 * So every route that blocks on a query must bound the wait, either with a
 * pendingComponent that times out or by not blocking at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const BLOCKING_LOADER = /loader:\s*(async\s*)?\(\{[^}]*\}\)\s*=>\s*(await\s+)?context\.queryClient\.ensureQueryData/;

describe("route loaders", () => {
  const files = routeFiles(join(process.cwd(), "src", "routes"));

  it("finds the loaders it is meant to be guarding", () => {
    const blocking = files.filter((f) => BLOCKING_LOADER.test(readFileSync(f, "utf8")));
    expect(blocking.length).toBeGreaterThan(0);
  });

  it("the router-wide pending default is bounded", () => {
    // Fifteen routes block on ensureQueryData, and this is what the router
    // shows while they wait. Bounding it here covers all of them, which is why
    // this is one assertion rather than fifteen route-by-route ones.
    const pending = readFileSync(
      join(process.cwd(), "src", "components", "workspace", "route-pending.tsx"),
      "utf8",
    );
    expect(pending).toMatch(/setTimeout/);
    expect(pending).toMatch(/did not finish loading/i);
    expect(pending).toMatch(/Reload/);

    const router = readFileSync(join(process.cwd(), "src", "router.tsx"), "utf8");
    expect(router).toContain("defaultPendingComponent: RoutePendingSkeleton");
  });

  it("routes with their own pending component bound it too", () => {
    // A route-specific pendingComponent REPLACES the default, so it has to
    // carry its own timeout or it reintroduces the unbounded skeleton.
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!/pendingComponent/.test(src)) continue;
      const bounded = /SkeletonTimeout|makeWorkspacePending|RoutePendingSkeleton/.test(src);
      if (!bounded) offenders.push(file.replace(process.cwd(), ""));
    }
    expect(offenders).toEqual([]);
  });

  it("admin/settings no longer blocks on the panel it renders", () => {
    // The registry table on this page is static and had no reason to wait on
    // a network read at all.
    const src = readFileSync(
      join(process.cwd(), "src", "routes", "_authenticated", "admin.settings.tsx"),
      "utf8",
    );
    expect(BLOCKING_LOADER.test(src)).toBe(false);
    expect(src).toContain("DeferredBlock");
  });
});
