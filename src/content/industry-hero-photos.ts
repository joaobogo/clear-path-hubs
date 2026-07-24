/**
 * Fallback real-photo registry for industry landing pages.
 *
 * Each of the 57 canonical industries gets a distinct, editorial-grade
 * Unsplash photo so every landing page has vertical-specific imagery
 * (hospitality → hotel, healthcare → clinical, finance → trading floor…).
 *
 * These are used by `getIndustryHeroImage` only when there is no
 * commissioned in-repo hero image. Remote URLs are served from Unsplash's
 * stable CDN with fixed photo IDs, 1600w, `auto=format` and `q=80`.
 */

import type { IndustryHeroImage } from "./industry-hero-images";

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`;

type Entry = Omit<IndustryHeroImage, "width" | "height"> & {
  width?: number;
  height?: number;
};

const RAW: Record<string, Entry> = {
  // Technology cluster
  "ai-ml": { src: U("1677442136019-21780ecad995"), alt: "Neural network visualisation on a dark studio monitor — AI & ML hiring.", focal: "50% 40%" },
  fintech: { src: U("1611974789855-9c2a0a7236a3"), alt: "Fintech engineer beside a wall of live market and payment dashboards.", focal: "50% 35%" },
  healthtech: { src: U("1584982751601-97dcc096659c"), alt: "Clinician reviewing patient data on a modern healthtech tablet interface.", focal: "50% 35%" },
  edtech: { src: U("1522202176988-66273c2fd55f"), alt: "Small cohort of learners around a bright collaborative workspace.", focal: "50% 40%" },
  proptech: { src: U("1486406146926-c627a92ad1ab"), alt: "Modern high-rise glass facade at golden hour — PropTech hiring.", focal: "50% 45%" },
  gaming: { src: U("1542751371-adc38448a05e"), alt: "Game studio workstation with multi-monitor engine and character art.", focal: "50% 40%" },
  web3: { src: U("1639762681485-074b7f938ba0"), alt: "Abstract blockchain ledger visualisation with soft cyan light.", focal: "50% 40%" },
  devops: { src: U("1573164713714-d95e436ab8d6"), alt: "Server room aisle with cool blue LEDs — infrastructure & DevOps.", focal: "50% 40%" },
  ecommerce: { src: U("1607082349566-187342175e2f"), alt: "Warehouse fulfilment desk with product photography and packaging.", focal: "50% 40%" },

  // Finance & professional services
  "investment-banking": { src: U("1554224155-6726b3ff858f"), alt: "Wall Street era stone facade with morning light — investment banking.", focal: "50% 40%" },
  "private-equity": { src: U("1519389950473-47ba0277781c"), alt: "Executive team reviewing a deal model on a large boardroom monitor.", focal: "50% 35%" },
  "venture-capital": { src: U("1556761175-5973dc0f32e7"), alt: "Founder pitching to a VC partner over espresso and a laptop.", focal: "50% 35%" },
  "wealth-management": { src: U("1560520653-9e0e4c89eb11"), alt: "Advisor and client reviewing a portfolio at a wood-panelled desk.", focal: "50% 35%" },
  accounting: { src: U("1554224154-26032ffc0d07"), alt: "Ledger, laptop and calculator on a warm oak desk with reading light.", focal: "50% 45%" },
  insurance: { src: U("1450101499163-c8848c66ca85"), alt: "Umbrella of daylight across a modern corporate atrium — insurance.", focal: "50% 40%" },
  consulting: { src: U("1517502884422-41eaead166d4"), alt: "Consultants at a whiteboard sketching a value tree — advisory work.", focal: "50% 35%" },
  legal: { src: U("1589994965851-a8f479c573a9"), alt: "Law library shelves with rolling ladder and warm brass lamps.", focal: "50% 40%" },

  // Healthcare & life sciences
  biotech: { src: U("1581093588401-fbb62a02f120"), alt: "Bench scientist pipetting into a rack in a clean, warm-lit lab.", focal: "50% 40%" },
  pharmaceuticals: { src: U("1587854692152-cbe660dbde88"), alt: "Blister-pack production line under soft factory light — pharma.", focal: "50% 40%" },
  "medical-devices": { src: U("1580281657527-47f249e8f4df"), alt: "Precision-machined medical device on a bright inspection bench.", focal: "50% 40%" },

  // Public / education
  education: { src: U("1503676260728-1c00da094a0b"), alt: "Sunlit classroom with warm wood desks and open notebooks.", focal: "50% 40%" },
  "higher-education": { src: U("1541339907198-e08756dedf3f"), alt: "Historic university quadrangle in late afternoon light.", focal: "50% 45%" },
  nonprofit: { src: U("1593113646773-028c64a8f1b8"), alt: "Community volunteers packing supplies at a warm-lit distribution hub.", focal: "50% 40%" },
  "public-sector": { src: U("1541872703-74c5e44368f9"), alt: "Neoclassical civic building steps at soft morning light.", focal: "50% 45%" },
  defense: { src: U("1541185933-ef5d8ed016c2"), alt: "Aerospace hangar interior with dawn light across polished floor.", focal: "50% 45%" },

  // Industrial / physical
  manufacturing: { src: U("1565043666747-69f6646db940"), alt: "Modern robotic assembly cell with orange-arm robots and clean floor.", focal: "50% 45%" },
  automotive: { src: U("1493238792000-8113da705763"), alt: "Automotive design studio with clay model and daylight from skylights.", focal: "50% 40%" },
  aviation: { src: U("1436491865332-7a61a109cc05"), alt: "Wide-body aircraft on tarmac at soft dawn — aviation hiring.", focal: "50% 50%" },
  logistics: { src: U("1601584115197-04ecc0da31d1"), alt: "Container port cranes lit by amber sunset — logistics & freight.", focal: "50% 55%" },
  energy: { src: U("1466611653911-95081537e5b7"), alt: "Grid substation transmission towers under a wide open sky.", focal: "50% 45%" },
  "renewable-energy": { src: U("1509390874189-d75d5b71a9c9"), alt: "Rows of solar panels stretching toward a warm horizon.", focal: "50% 50%" },
  "oil-gas": { src: U("1518623489648-a173ef7824f3"), alt: "Refinery skyline silhouetted against golden-hour light.", focal: "50% 55%" },
  construction: { src: U("1541888946425-d81bb19240f5"), alt: "Superintendent on a mid-rise jobsite reviewing drawings at sunrise.", focal: "50% 40%" },
  agriculture: { src: U("1500595046743-cd271d694d30"), alt: "Rolling farmland at golden hour with a lone tractor track.", focal: "50% 55%" },
  "food-beverage": { src: U("1504674900247-0877df9cc836"), alt: "Chef plating a refined course under warm kitchen pass light.", focal: "50% 40%" },

  // Consumer & lifestyle
  retail: { src: U("1441986300917-64674bd600d8"), alt: "Elegant flagship retail interior with warm pendant lighting.", focal: "50% 40%" },
  fashion: { src: U("1490481651871-ab68de25d43d"), alt: "Atelier rack of curated garments in soft daylight.", focal: "50% 40%" },
  hospitality: { src: U("1566073771259-6a8506099945"), alt: "Boutique hotel lobby with warm brass fixtures and a lit reception.", focal: "50% 45%" },
  travel: { src: U("1507525428034-b723cf961d3e"), alt: "Coastal traveller viewpoint at golden hour with soft ocean light.", focal: "50% 55%" },
  sports: { src: U("1461896836934-ffe607ba8211"), alt: "Empty modern stadium lit for the evening kickoff.", focal: "50% 45%" },
  media: { src: U("1478737270239-2f02b77fc618"), alt: "Broadcast studio with warm key lights and camera on a jib.", focal: "50% 40%" },
  marketing: { src: U("1552664730-d307ca884978"), alt: "Creative team reviewing campaign boards on a warm-toned wall.", focal: "50% 35%" },
  design: { src: U("1558655146-9f40138edfeb"), alt: "Designer's desk with sketches, swatches and a large iMac.", focal: "50% 40%" },
  architecture: { src: U("1487958449943-2429e8be8625"), alt: "Modern architectural interior with concrete, timber and daylight.", focal: "50% 45%" },
  "real-estate": { src: U("1512917774080-9991f1c4c750"), alt: "Modern residential home exterior at dusk with warm interior glow.", focal: "50% 50%" },
  telecom: { src: U("1451187580459-43490279c0fa"), alt: "Fibre-optic backbone glowing across a data corridor at night.", focal: "50% 40%" },

  // People / functions
  "human-resources": { src: U("1573497019940-1c28c88b4f3e"), alt: "HR partner in a one-to-one at a bright meeting nook.", focal: "50% 30%" },
  sales: { src: U("1552581234-26160f608093"), alt: "Sales team on a call with a pipeline board in soft afternoon light.", focal: "50% 35%" },
  "customer-success": { src: U("1560264280-88b68371db39"), alt: "Customer success manager on a call with a warm-lit dual-monitor desk.", focal: "50% 35%" },
  "product-management": { src: U("1531403009284-440f080d1e12"), alt: "PM at a wall of sticky-notes mapping a release plan.", focal: "50% 35%" },
  "staffing-agencies": { src: U("1600880292203-757bb62b4baf"), alt: "Recruiter interviewing a candidate in a warm meeting room.", focal: "50% 30%" },

  // Core tech / data / horizontal verticals (previously missing)
  tech: { src: U("1517430816045-df4b7de11d1d"), alt: "Software engineers pair-programming under warm studio pendants.", focal: "50% 40%" },
  saas: { src: U("1551288049-bebda4e38f71"), alt: "Product analytics dashboard on a large curved monitor at a modern desk.", focal: "50% 40%" },
  cybersecurity: { src: U("1550751827-4bd374c3f58b"), alt: "Security operations centre with dark-mode dashboards and warm accent lights.", focal: "50% 40%" },
  "data-analytics": { src: U("1543286386-713bdd548da4"), alt: "Analyst reviewing cohort charts and pivot tables on a wide monitor.", focal: "50% 40%" },
  finance: { src: U("1554224155-8d04cb21cd6c"), alt: "Trading floor at dawn with rows of quote monitors glowing warm.", focal: "50% 40%" },
  healthcare: { src: U("1519494026892-80bbd2d6fd0d"), alt: "Clinician team consulting at a bright hospital nurse-station corridor.", focal: "50% 35%" },
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
