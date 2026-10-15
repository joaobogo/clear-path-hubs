/**
 * Fallback real-photo registry for industry landing pages.
 *
 * Each of the 57 canonical industries gets a distinct, editorial-grade
 * editorial photo so every landing page has vertical-specific imagery
 * (hospitality → hotel, healthcare → clinical, finance → trading floor…).
 *
 * These are used by `getIndustryHeroImage` only when there is no
 * commissioned in-repo hero image. Photos are served from managed media
 * storage, not a third-party image host.
 */

import type { IndustryHeroImage } from "./industry-hero-images";

const assets = import.meta.glob<{ default: { url: string } }>(
  "../assets/industries/*.jpg.asset.json",
  { eager: true },
);
const managedPhotos = Object.fromEntries(
  Object.entries(assets).map(([path, asset]) => [
    path.split("/").pop()?.replace(".jpg.asset.json", ""),
    asset.default.url,
  ]),
);

type Entry = Omit<IndustryHeroImage, "width" | "height"> & {
  width?: number;
  height?: number;
};

const RAW: Record<string, Entry> = {
  // Technology cluster
  "ai-ml": { src: managedPhotos["ai-ml"], alt: "Neural network visualisation on a dark studio monitor — AI & ML hiring.", focal: "50% 40%" },
  fintech: { src: managedPhotos["fintech"], alt: "Fintech engineer beside a wall of live market and payment dashboards.", focal: "50% 35%" },
  healthtech: { src: managedPhotos["healthtech"], alt: "Clinician reviewing patient data on a modern healthtech tablet interface.", focal: "50% 35%" },
  edtech: { src: managedPhotos["edtech"], alt: "Small cohort of learners around a bright collaborative workspace.", focal: "50% 40%" },
  proptech: { src: managedPhotos["proptech"], alt: "Modern high-rise glass facade at golden hour — PropTech hiring.", focal: "50% 45%" },
  gaming: { src: managedPhotos["gaming"], alt: "Game studio workstation with multi-monitor engine and character art.", focal: "50% 40%" },
  web3: { src: managedPhotos["web3"], alt: "Abstract blockchain ledger visualisation with soft cyan light.", focal: "50% 40%" },
  devops: { src: managedPhotos["devops"], alt: "Server room aisle with cool blue LEDs — infrastructure & DevOps.", focal: "50% 40%" },
  ecommerce: { src: managedPhotos["ecommerce"], alt: "Warehouse fulfilment desk with product photography and packaging.", focal: "50% 40%" },

  // Finance & professional services
  "investment-banking": { src: managedPhotos["investment-banking"], alt: "Wall Street era stone facade with morning light — investment banking.", focal: "50% 40%" },
  "private-equity": { src: managedPhotos["private-equity"], alt: "Executive team reviewing a deal model on a large boardroom monitor.", focal: "50% 35%" },
  "venture-capital": { src: managedPhotos["venture-capital"], alt: "Founder pitching to a VC partner over espresso and a laptop.", focal: "50% 35%" },
  "wealth-management": { src: managedPhotos["wealth-management"], alt: "Advisor and client reviewing a portfolio at a wood-panelled desk.", focal: "50% 35%" },
  accounting: { src: managedPhotos["accounting"], alt: "Ledger, laptop and calculator on a warm oak desk with reading light.", focal: "50% 45%" },
  insurance: { src: managedPhotos["insurance"], alt: "Umbrella of daylight across a modern corporate atrium — insurance.", focal: "50% 40%" },
  consulting: { src: managedPhotos["consulting"], alt: "Consultants at a whiteboard sketching a value tree — advisory work.", focal: "50% 35%" },

  // Healthcare & life sciences
  biotech: { src: managedPhotos["biotech"], alt: "Bench scientist pipetting into a rack in a clean, warm-lit lab.", focal: "50% 40%" },
  pharmaceuticals: { src: managedPhotos["pharmaceuticals"], alt: "Blister-pack production line under soft factory light — pharma.", focal: "50% 40%" },
  "medical-devices": { src: managedPhotos["medical-devices"], alt: "Precision-machined medical device on a bright inspection bench.", focal: "50% 40%" },

  // Public / education
  education: { src: managedPhotos["education"], alt: "Sunlit classroom with warm wood desks and open notebooks.", focal: "50% 40%" },
  "higher-education": { src: managedPhotos["higher-education"], alt: "Historic university quadrangle in late afternoon light.", focal: "50% 45%" },
  nonprofit: { src: managedPhotos["nonprofit"], alt: "Community volunteers packing supplies at a warm-lit distribution hub.", focal: "50% 40%" },
  "public-sector": { src: managedPhotos["public-sector"], alt: "Neoclassical civic building steps at soft morning light.", focal: "50% 45%" },
  defense: { src: managedPhotos["defense"], alt: "Aerospace hangar interior with dawn light across polished floor.", focal: "50% 45%" },

  // Industrial / physical
  manufacturing: { src: managedPhotos["manufacturing"], alt: "Modern robotic assembly cell with orange-arm robots and clean floor.", focal: "50% 45%" },
  automotive: { src: managedPhotos["automotive"], alt: "Automotive design studio with clay model and daylight from skylights.", focal: "50% 40%" },
  aviation: { src: managedPhotos["aviation"], alt: "Wide-body aircraft on tarmac at soft dawn — aviation hiring.", focal: "50% 50%" },
  "oil-gas": { src: managedPhotos["oil-gas"], alt: "Refinery skyline silhouetted against golden-hour light.", focal: "50% 55%" },
  agriculture: { src: managedPhotos["agriculture"], alt: "Rolling farmland at golden hour with a lone tractor track.", focal: "50% 55%" },
  "food-beverage": { src: managedPhotos["food-beverage"], alt: "Chef plating a refined course under warm kitchen pass light.", focal: "50% 40%" },

  // Consumer & lifestyle
  fashion: { src: managedPhotos["fashion"], alt: "Atelier rack of curated garments in soft daylight.", focal: "50% 40%" },
  travel: { src: managedPhotos["travel"], alt: "Coastal traveller viewpoint at golden hour with soft ocean light.", focal: "50% 55%" },
  sports: { src: managedPhotos["sports"], alt: "Empty modern stadium lit for the evening kickoff.", focal: "50% 45%" },
  media: { src: managedPhotos["media"], alt: "Broadcast studio with warm key lights and camera on a jib.", focal: "50% 40%" },
  marketing: { src: managedPhotos["marketing"], alt: "Creative team reviewing campaign boards on a warm-toned wall.", focal: "50% 35%" },
  design: { src: managedPhotos["design"], alt: "Designer's desk with sketches, swatches and a large iMac.", focal: "50% 40%" },
  architecture: { src: managedPhotos["architecture"], alt: "Modern architectural interior with concrete, timber and daylight.", focal: "50% 45%" },
  "real-estate": { src: managedPhotos["real-estate"], alt: "Modern residential home exterior at dusk with warm interior glow.", focal: "50% 50%" },
  telecom: { src: managedPhotos["telecom"], alt: "Fibre-optic backbone glowing across a data corridor at night.", focal: "50% 40%" },

  // People / functions
  "human-resources": { src: managedPhotos["human-resources"], alt: "HR partner in a one-to-one at a bright meeting nook.", focal: "50% 30%" },
  sales: { src: managedPhotos["sales"], alt: "Sales team on a call with a pipeline board in soft afternoon light.", focal: "50% 35%" },
  "customer-success": { src: managedPhotos["customer-success"], alt: "Customer success manager on a call with a warm-lit dual-monitor desk.", focal: "50% 35%" },
  "product-management": { src: managedPhotos["product-management"], alt: "PM at a wall of sticky-notes mapping a release plan.", focal: "50% 35%" },
  "staffing-agencies": { src: managedPhotos["staffing-agencies"], alt: "Recruiter interviewing a candidate in a warm meeting room.", focal: "50% 30%" },

};

const PHOTO_ENTRIES: Record<string, IndustryHeroImage> = Object.fromEntries(
  Object.entries(RAW).map(([slug, e]) => [
    slug,
    { width: 1600, height: 900, ...e },
  ]),
);

export function getIndustryHeroPhoto(slug: string): IndustryHeroImage | undefined {
  return PHOTO_ENTRIES[slug];
}
