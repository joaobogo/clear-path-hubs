import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PIXELS = readFileSync(join(process.cwd(), "src/lib/tracking/pixels.ts"), "utf8");
const CODE = PIXELS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("consent gating", () => {
  it("boots no marketing tracker from the server-rendered head", () => {
    const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).not.toMatch(/rb2bHeadScripts\(/);
    expect(root).not.toMatch(/rb2bHeadLinks\(/);

    const head = CODE.slice(
      CODE.indexOf("export const HEAD_BOOT_SNIPPETS"),
      CODE.indexOf("function alreadyInDocument"),
    );
    expect(head).not.toMatch(/reb2b|facebook|fbevents|licdn|clarity\.ms|hotjar/i);
  });

  it("exempts only GA4 from the client consent loop", () => {
    const loop = CODE.slice(CODE.indexOf("for (const key of Object.keys(INITIALISERS)"));
    const exempted = [...loop.matchAll(/key === "([a-z0-9]+)"/g)].map((m) => m[1]);
    expect(exempted).toEqual(["ga4"]);
  });

  it("has no hard-coded always-on marketing tracker", () => {
    const consent = readFileSync(join(process.cwd(), "src/lib/tracking/consent.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const list = /ALWAYS_ON_TRACKERS\s*=\s*\[([^\]]*)\]/.exec(consent)?.[1] ?? "";
    const keys = [...list.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual([]);
  });

  it("keeps every optional tracker in a consent category", () => {
    const block = CODE.slice(
      CODE.indexOf("TRACKER_CATEGORY"),
      CODE.indexOf("const INITIALISERS"),
    );
    for (const key of ["rb2b", "meta", "linkedin", "clarity", "hotjar"]) {
      expect(block, `${key} has no consent category`).toMatch(
        new RegExp(`${key}:\\s*"(analytics|marketing)"`),
      );
    }
  });

  it("special-cases RB2B so an admin cannot promote it to essential", () => {
    const consent = readFileSync(join(process.cwd(), "src/lib/tracking/consent.ts"), "utf8");
    expect(consent).toMatch(/if \(key === "rb2b"\) return isAllowed\("marketing"\)/);
  });
});
