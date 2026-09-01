/**
 * One money formatter, and one place that knows about cents.
 *
 * money.ts opens with the rule and the reason: two scales exist in the database
 * and mixing them printed "€640" for a €64,000 offer, so "Never divide or
 * multiply by 100 at a call site — if you are reaching for / 100, you want
 * formatMoneyFromCents."
 *
 * Call sites did it anyway, and each drifted its own way:
 *   - the payments desk omitted maximumFractionDigits, printing "$1,234.00"
 *     where every other surface shows whole units, and threw a RangeError out
 *     of the render on an unrecognised currency code instead of falling back;
 *   - the client KPI service defaulted to USD while money.ts defaults to EUR,
 *     so the same unlabelled figure was dollars on one surface and euros on
 *     another.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatMoneyFromCents, formatMoneyMajor } from "@/lib/money";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Marketing calculators price hypothetical scenarios from user input rather
 * than rendering a stored amount, so they are not reading either database
 * scale. They are listed rather than pattern-matched so adding one is a
 * decision, not an accident.
 */
const NOT_STORED_AMOUNTS = [
  join("components", "marketing"),
  join("components", "product", "role-blueprint.tsx"),
  join("components", "client", "analytics", "primitives.tsx"),
];

describe("money formatting", () => {
  it("has no second implementation for stored amounts", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      if (file.endsWith(join("lib", "money.ts"))) continue;
      if (NOT_STORED_AMOUNTS.some((allowed) => file.includes(allowed))) continue;

      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/(^|[^:])\/\/.*$/gm, "$1");

      if (/style:\s*["']currency["']/.test(src)) {
        offenders.push(`${file.replace(process.cwd(), "")} formats currency itself`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("the two scales stay distinct", () => {
  it("reads cents as minor units", () => {
    expect(formatMoneyFromCents(6_400_000, "EUR")).toContain("64,000");
  });

  it("reads a major amount as-is", () => {
    expect(formatMoneyMajor(64_000, "EUR")).toContain("64,000");
  });

  it("does not print the same number two ways", () => {
    // The bug the module was written for: €640 shown for a €64,000 offer.
    expect(formatMoneyFromCents(64_000, "EUR")).not.toEqual(formatMoneyMajor(64_000, "EUR"));
  });

  it("shows a dash rather than NaN for a missing amount", () => {
    expect(formatMoneyFromCents(null)).toBe("—");
    expect(formatMoneyMajor(undefined)).toBe("—");
  });

  it("survives an unrecognised currency code instead of throwing", () => {
    // Intl throws a RangeError on an invalid code; a render must not.
    expect(() => formatMoneyMajor(1000, "XYZ!")).not.toThrow();
    expect(formatMoneyMajor(1000, "XYZ!")).toContain("1,000");
  });

  it("rounds to whole units on both scales", () => {
    expect(formatMoneyMajor(1234.56, "USD")).not.toContain(".");
    expect(formatMoneyFromCents(123_456, "USD")).not.toContain(".");
  });
});
