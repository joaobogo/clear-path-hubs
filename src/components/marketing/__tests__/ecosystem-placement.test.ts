import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";

import {
  allowsCrossSell,
  isConversionPath,
} from "@/components/marketing/ecosystem-footer-row";
import {
  claimCrossSellSlot,
  resetCrossSellSlots,
} from "@/components/marketing/ecosystem-cross-sell";

const ROUTES_DIR = join(process.cwd(), "src/routes");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return routeFiles(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });
}

describe("ecosystem placement", () => {
  beforeEach(() => resetCrossSellSlots());

  it("renders at most one cross-sell module per route file", () => {
    const offenders = routeFiles(ROUTES_DIR).filter((f) => {
      const uses = readFileSync(f, "utf8").match(/<EcosystemCrossSell\b/g);
      return (uses?.length ?? 0) > 1;
    });
    expect(offenders).toEqual([]);
  });

  it("only uses triggers that are defined in the ecosystem config", async () => {
    const { CROSS_SELLS } = await import("@/config/ecosystem");
    const used = routeFiles(ROUTES_DIR).flatMap((f) =>
      [
        ...readFileSync(f, "utf8").matchAll(
          /<EcosystemCrossSell\s+trigger="([^"]+)"/g,
        ),
      ].map((m) => m[1]),
    );
    expect(used.length).toBeGreaterThan(0);
    for (const t of used) expect(Object.keys(CROSS_SELLS)).toContain(t);
  });

  it("suppresses sibling links on conversion paths", () => {
    for (const p of ["/intake", "/pricing", "/apply/123", "/contact"]) {
      expect(isConversionPath(p)).toBe(true);
    }
    expect(isConversionPath("/global-talent")).toBe(false);
  });

  it("allows the deflection cross-sell only on pricing, not other conversion paths", () => {
    expect(allowsCrossSell("/pricing")).toBe(true);
    expect(allowsCrossSell("/intake")).toBe(false);
    expect(allowsCrossSell("/apply/abc")).toBe(false);
    expect(allowsCrossSell("/talent-network")).toBe(true);
  });

  it("gives the page slot to the first module only", () => {
    expect(claimCrossSellSlot("/talent-network", "a")).toBe(true);
    expect(claimCrossSellSlot("/talent-network", "b")).toBe(false);
    expect(claimCrossSellSlot("/talent-network", "a")).toBe(true);
    expect(claimCrossSellSlot("/global-talent", "b")).toBe(true);
  });
});
