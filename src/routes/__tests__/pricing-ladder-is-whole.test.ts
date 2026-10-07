/**
 * Every page that publishes the package ladder publishes all of it.
 *
 * The ladder gained two bands in August — 40 positions at $27,200 and 100 at
 * $64,000 — and three marketing pages were not updated with it. For weeks
 * /pricing offered six packages while /enterprise, /pitch and /trust stopped
 * at $21,600, so a large buyer landing on the page written for large buyers was
 * shown no price for their volume at all. /trust went further and asserted
 * something untrue about our own pricing: "Thirty positions is the maximum."
 * (audit 17 Sep, item 4.)
 *
 * Each page hand-maintains its own array — they are different shapes, with
 * different columns, so one shared component is not the answer. What IS
 * enforceable is that none of them may omit a published package, and none may
 * hardcode a ceiling that the config can move.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_POSITIONS, PACKAGES } from "@/config/pricing-core";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * Source with comments removed.
 *
 * A comment explaining which price used to be missing is not a rendered price,
 * and the literal-price check below would otherwise fail on the note that
 * documents the fix.
 */
const code = (rel: string) =>
  src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Pages that publish the whole ladder, not just a headline price. */
const LADDER_PAGES = [
  "src/routes/enterprise.tsx",
  "src/routes/pitch.tsx",
  "src/content/pricing.ts",
];

/** The constant each published package is exported as. */
const PACKAGE_CONSTANTS = ["PACKAGE_10", "PACKAGE_20", "PACKAGE_30", "PACKAGE_40", "PACKAGE_100"];

describe("no page publishes a shorter ladder than the config", () => {
  it("the config still has six packages", () => {
    // If this changes, the lists below need revisiting rather than silently
    // passing against a ladder that moved.
    expect(PACKAGES).toHaveLength(6);
    expect(MAX_POSITIONS).toBe(100);
  });

  for (const page of LADDER_PAGES) {
    it(`${page} renders every package`, () => {
      // Stripped, so a package named only in a comment cannot pass for one
      // the page actually renders.
      const rendered = code(page);
      const missing = PACKAGE_CONSTANTS.filter((c) => !new RegExp(`\\b${c}\\b`).test(rendered));
      expect(
        missing,
        `${page} omits ${missing.join(", ")} — a buyer at that volume is shown no price`,
      ).toEqual([]);
    });
  }
});

describe("no page hardcodes a ceiling the config owns", () => {
  for (const page of LADDER_PAGES) {
    it(`${page} states no fixed maximum`, () => {
      const rendered = code(page);
      // "More than 30 positions" and "Thirty positions is the maximum" both
      // shipped, and both went stale the moment MAX_POSITIONS moved.
      expect(rendered, "hardcoded ceiling — use ABOVE_MAX_ROLES_LABEL").not.toMatch(
        /More than \d+ positions/,
      );
      expect(rendered, "hardcoded ceiling in prose").not.toMatch(
        /(Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety|One hundred) positions is the maximum/i,
      );
    });
  }

  it("the above-maximum label is derived, so it moves with the config", () => {
    // Guards the fix itself: these pages must read the label rather than
    // restate it.
    for (const page of ["src/routes/pitch.tsx"]) {
      expect(src(page), `${page} should use ABOVE_MAX_ROLES_LABEL`).toContain(
        "ABOVE_MAX_ROLES_LABEL",
      );
    }
    expect(src("src/routes/enterprise.tsx")).toContain("MAX_POSITIONS");
  });
});

describe("the prices themselves are never typed by hand", () => {
  for (const page of LADDER_PAGES) {
    it(`${page} writes no literal package price`, () => {
      const rendered = code(page);
      // Every published total must come from the config. A typed "$27,200"
      // is how two pages disagree about the same package.
      for (const pkg of PACKAGES) {
        if (pkg.id === "pilot") continue;
        expect(
          rendered,
          `${page} hardcodes ${pkg.totalDisplay} — read it from pricing-core instead`,
        ).not.toContain(pkg.totalDisplay);
      }
    });
  }
});
