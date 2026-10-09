import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_REDIRECTS,
  LEGACY_REDIRECT_PATHS,
  legacyRedirectFor,
  legacyRedirectTarget,
} from "@/config/legacy-redirects";

const read = (rel: string) => readFileSync(rel, "utf8");

describe("legacy redirects", () => {
  it("covers every retired page", () => {
    expect([...LEGACY_REDIRECT_PATHS].sort()).toEqual(
      ["/employer-onboarding", "/journey", "/platform", "/system", "/trust"].sort(),
    );
  });

  it("resolves each legacy path to its target", () => {
    expect(legacyRedirectTarget("/platform")).toBe("/how-it-works#workspace");
    expect(legacyRedirectTarget("/system")).toBe("/how-it-works#scoring");
    expect(legacyRedirectTarget("/employer-onboarding")).toBe("/how-it-works#steps");
    expect(legacyRedirectTarget("/trust")).toBe("/security");
    expect(legacyRedirectTarget("/journey")).toBe("/about#story");
  });

  it("matches trailing slashes and case, and ignores live paths", () => {
    expect(legacyRedirectFor("/Platform/")?.to).toBe("/how-it-works");
    expect(legacyRedirectFor("/how-it-works")).toBeNull();
    expect(legacyRedirectFor("/solutions")).toBeNull();
  });

  it("never redirects to another redirect (no chains)", () => {
    for (const [from, { to }] of Object.entries(LEGACY_REDIRECTS)) {
      expect(LEGACY_REDIRECT_PATHS, `${from} -> ${to} is a chain`).not.toContain(to);
      expect(to).not.toBe(from);
    }
  });

  it("each retired route file issues a 301 to the same target", () => {
    for (const [from, { to, hash }] of Object.entries(LEGACY_REDIRECTS)) {
      const file = `src/routes/${from.slice(1)}.tsx`;
      const src = read(file);
      expect(src, file).toContain("statusCode: 301");
      expect(src, file).toContain(`to: "${to}"`);
      if (hash) expect(src, file).toContain(`hash: "${hash}"`);
    }
  });

  it("every redirect target is a page that exists", () => {
    for (const { to } of Object.values(LEGACY_REDIRECTS)) {
      expect(() => read(`src/routes/${to.slice(1)}.tsx`), to).not.toThrow();
    }
  });
});
