import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INDUSTRY_ENTRIES } from "../../src/content/industries-v2";
import { getIndustryHeroImage } from "../../src/content/industry-hero-images";

describe("Industry pictures", () => {
  it("provides a distinct picture and description for every industry", () => {
    const images = INDUSTRY_ENTRIES.map((entry) => getIndustryHeroImage(entry.slug));
    for (const image of images) {
      expect(image?.src).toBeTruthy();
      expect(image?.src).not.toMatch(/^https:\/\/images\.unsplash\.com/);
      expect(image?.alt.length).toBeGreaterThan(20);
      expect(image?.width).toBeGreaterThanOrEqual(1600);
    }
    expect(new Set(images.map((image) => image?.src)).size).toBe(INDUSTRY_ENTRIES.length);
  });

  it("uses the shared photo registry on industry cards", () => {
    const source = readFileSync("src/routes/industries.index.tsx", "utf8");
    expect(source).toContain("getIndustryHeroImage(tile.slug)");
    expect(source).toContain("<HeroPicture");
    expect(source).not.toContain("FamilyMotif");
  });

  it("extends chapter surfaces without increasing layout width", () => {
    const css = readFileSync("src/styles/run.css", "utf8");
    expect(css).toContain(".run-chapters .run-chapter::before");
    expect(css).toContain("clip-path: inset(0 -100vmax)");
    expect(css).toContain("pointer-events: none");
  });
});