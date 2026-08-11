/**
 * Industry hero image registry.
 *
 * Each entry maps an approved industry slug to a commissioned hero image.
 * Images follow the 57-image manifest
 * (`docs/industries/industry-image-manifest.md`) — one unique visual per
 * industry, no reuse. Industries without an entry here render the text-only
 * hero until their commissioned image is approved.
 *
 * Alt text describes the subject, action, environment and light so screen
 * readers convey the emotional tone, not just "person working". Every hero
 * uses `object-cover` with a top-biased focal point so mobile crops preserve
 * the human subject rather than sliding it off-screen.
 */

import techHero from "@/assets/industry-tech-hero.jpg";
import saasHero from "@/assets/industry-saas-hero.jpg";
import dataAnalyticsHero from "@/assets/industry-data-analytics-hero.jpg";
import cybersecurityHero from "@/assets/industry-cybersecurity-hero.jpg";
import financeHero from "@/assets/industry-finance-hero.jpg";
import healthcareHero from "@/assets/industry-healthcare-hero.jpg";
import hospitalityHero from "@/assets/industry-hospitality-hero.jpg";
import retailHero from "@/assets/industry-retail-hero.jpg";
import energyHero from "@/assets/industry-energy-hero.jpg";
import legalHero from "@/assets/industry-legal-hero.jpg";
import constructionHero from "@/assets/industry-construction-hero.jpg";
import logisticsHero from "@/assets/industry-logistics-hero.jpg";
import renewableEnergyHero from "@/assets/industry-renewable-energy-hero.jpg";

export type IndustryHeroImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** CSS object-position keeping the subject in-frame on mobile crops. */
  focal?: string;
};

export const INDUSTRY_HERO_IMAGES: Record<string, IndustryHeroImage> = {
  tech: {
    src: techHero,
    width: 1600,
    height: 900,
    alt: "Senior software engineer at a multi-monitor workstation in a contemporary engineering office at dusk — representative of Technology hiring at TaaSFlow.",
    focal: "50% 30%",
  },
  saas: {
    src: saasHero,
    width: 1600,
    height: 900,
    alt: "Product manager and engineer whiteboarding a release plan next to a laptop showing a clean product dashboard — representative of SaaS hiring at TaaSFlow.",
    focal: "50% 35%",
  },
  "data-analytics": {
    src: dataAnalyticsHero,
    width: 1600,
    height: 900,
    alt: "Analyst standing before a wall of layered dashboards and time-series charts in a dim data-ops room — representative of Data & Analytics hiring at TaaSFlow.",
    focal: "50% 40%",
  },
  cybersecurity: {
    src: cybersecurityHero,
    width: 1600,
    height: 900,
    alt: "Security analyst at the centre of a low-lit SOC bay, monitors flanking their silhouette in cold blue light — representative of Cybersecurity hiring at TaaSFlow.",
    focal: "50% 40%",
  },
  finance: {
    src: financeHero,
    width: 1600,
    height: 900,
    alt: "Senior finance leader reviewing a ledger and printed portfolio brief on a wooden desk in a warm-lit corner office — representative of Finance hiring at TaaSFlow.",
    focal: "50% 35%",
  },
  healthcare: {
    src: healthcareHero,
    width: 1600,
    height: 900,
    alt: "Emergency-department physician and nurse practitioner reviewing a bedside monitor together in a bright hospital corridor — representative of Healthcare hiring at TaaSFlow.",
    focal: "50% 35%",
  },
  hospitality: {
    src: hospitalityHero,
    width: 1600,
    height: 900,
    alt: "Senior hotel general manager walking the lobby at morning check-in as guests are greeted at the desk — representative of Hospitality hiring at TaaSFlow.",
    focal: "50% 40%",
  },
  retail: {
    src: retailHero,
    width: 1600,
    height: 900,
    alt: "Retail operations lead reviewing daily performance on a tablet on the floor of a modern flagship store — representative of Retail hiring at TaaSFlow.",
    focal: "50% 35%",
  },
  energy: {
    src: energyHero,
    width: 1600,
    height: 900,
    alt: "Energy operations engineer in high-visibility gear inspecting a wind-turbine control cabinet at golden hour — representative of Energy hiring at TaaSFlow.",
    focal: "50% 45%",
  },
  legal: {
    src: legalHero,
    width: 1600,
    height: 900,
    alt: "Senior corporate attorney reviewing a matter file at a wood-panelled desk in a warm-lit law library — representative of Legal hiring at TaaSFlow.",
    focal: "50% 35%",
  },
  construction: {
    src: constructionHero,
    width: 1600,
    height: 900,
    alt: "Construction project manager and superintendent reviewing rolled drawings on a mid-rise commercial jobsite at sunrise — representative of Construction hiring at TaaSFlow.",
    focal: "50% 45%",
  },
  logistics: {
    src: logisticsHero,
    width: 1600,
    height: 912,
    alt: "Logistics operations manager on an elevated walkway reviewing a tablet above a freight distribution floor as forklifts move pallets in hazy morning light — representative of Logistics & Supply Chain hiring at TaaSFlow.",
    focal: "50% 40%",
  },
  "renewable-energy": {
    src: renewableEnergyHero,
    width: 1600,
    height: 912,
    alt: "Field engineer in high-visibility gear inspecting a solar inverter cabinet at the edge of a photovoltaic array at golden hour, wind turbines faint on the horizon — representative of Renewable Energy hiring at TaaSFlow.",
    focal: "50% 45%",
  },
};

import { getIndustryHeroPhoto } from "./industry-hero-photos";

export function getIndustryHeroImage(slug: string): IndustryHeroImage | undefined {
  return INDUSTRY_HERO_IMAGES[slug] ?? getIndustryHeroPhoto(slug);
}
