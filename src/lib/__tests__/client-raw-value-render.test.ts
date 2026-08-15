import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDateTime, looksLikeIsoTimestamp } from "@/lib/format/datetime";
import { formatEnumLabel } from "@/lib/human-labels";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes("__tests__") ? [full] : [];
  });
}

const CLIENT_FILES = [
  ...walk("src/components/client"),
  ...readdirSync("src/routes/_authenticated")
    .filter((f) => f.startsWith("client") && f.endsWith(".tsx"))
    .map((f) => join("src/routes/_authenticated", f)),
];

describe("client workspace value rendering", () => {
  it("renders the repro instant in workspace time, not as an ISO string", () => {
    const iso = "2026-08-15T01:25:06.186+00:00";
    expect(looksLikeIsoTimestamp(iso)).toBe(true);
    expect(formatDateTime(iso)).toBe("14/08/2026, 22:25:06");
    expect(looksLikeIsoTimestamp(formatDateTime(iso))).toBe(false);
  });

  it("renders employment-type enums as labels", () => {
    expect(formatEnumLabel("full_time")).toBe("Full time");
    expect(formatEnumLabel("part_time")).toBe("Part time");
    expect(formatEnumLabel("remote")).toBe("Remote");
    expect(formatEnumLabel("", "—")).toBe("—");
  });

  it("never renders raw dates with toLocaleString in client views", () => {
    const offenders = CLIENT_FILES.filter((f) =>
      /toLocaleString\(\)/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("never de-underscores enums inline instead of using the shared formatter", () => {
    const offenders = CLIENT_FILES.filter((f) => {
      const src = readFileSync(f, "utf8");
      // timezone identifiers are legitimately de-underscored for display
      return /replace\(\/_\/g, " "\)/.test(src) && !/timezone|tz\b/i.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
