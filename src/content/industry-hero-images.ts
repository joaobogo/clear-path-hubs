/**
 * Industry hero image registry.
 *
 * Each entry maps an approved industry slug to a locally hosted hero image.
 * Images are commissioned per the 57-image manifest
 * (`docs/industries/industry-image-manifest.md`). Only slugs present here
 * render a hero image; other industries fall back to the text-only hero
 * until their hero is generated and approved.
 */

import techHero from "@/assets/industry-tech-hero.jpg";

export type IndustryHeroImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const INDUSTRY_HERO_IMAGES: Record<string, IndustryHeroImage> = {
  tech: {
    src: techHero,
    width: 1920,
    height: 960,
    alt: "Senior software engineer at a multi-monitor workstation in a contemporary engineering office at dusk — representative of Technology hiring at TaaSFlow.",
  },
};

export function getIndustryHeroImage(slug: string): IndustryHeroImage | undefined {
  return INDUSTRY_HERO_IMAGES[slug];
}
