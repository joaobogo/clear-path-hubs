/**
 * Industry hero image registry.
 *
 * Each entry maps an approved industry slug to a commissioned hero image.
 * Images follow the 57-image manifest
 * (`docs/industries/industry-image-manifest.md`) — one unique visual per
 * industry, no reuse. Industries without an entry here render the text-only
 * hero until their commissioned image is approved.
 */

import techHero from "@/assets/industry-tech-hero.jpg";
import saasHero from "@/assets/industry-saas-hero.jpg";
import dataAnalyticsHero from "@/assets/industry-data-analytics-hero.jpg";
import cybersecurityHero from "@/assets/industry-cybersecurity-hero.jpg";
import financeHero from "@/assets/industry-finance-hero.jpg";

export type IndustryHeroImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const INDUSTRY_HERO_IMAGES: Record<string, IndustryHeroImage> = {
  tech: {
    src: techHero,
    width: 1600,
    height: 900,
    alt: "Senior software engineer at a multi-monitor workstation in a contemporary engineering office at dusk — representative of Technology hiring at TaaSFlow.",
  },
  saas: {
    src: saasHero,
    width: 1600,
    height: 900,
    alt: "Product manager and engineer whiteboarding a release plan next to a laptop showing a clean product dashboard — representative of SaaS hiring at TaaSFlow.",
  },
  "data-analytics": {
    src: dataAnalyticsHero,
    width: 1600,
    height: 900,
    alt: "Analyst standing before a wall of layered dashboards and time-series charts in a dim data-ops room — representative of Data & Analytics hiring at TaaSFlow.",
  },
  cybersecurity: {
    src: cybersecurityHero,
    width: 1600,
    height: 900,
    alt: "Security analyst at the centre of a low-lit SOC bay, monitors flanking their silhouette in cold blue light — representative of Cybersecurity hiring at TaaSFlow.",
  },
  finance: {
    src: financeHero,
    width: 1600,
    height: 900,
    alt: "Senior finance leader reviewing a ledger and printed portfolio brief on a wooden desk in a warm-lit corner office — representative of Finance hiring at TaaSFlow.",
  },
};

export function getIndustryHeroImage(slug: string): IndustryHeroImage | undefined {
  return INDUSTRY_HERO_IMAGES[slug];
}
