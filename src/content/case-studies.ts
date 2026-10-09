// -----------------------------------------------------------------------------
// Example engagements. Single source of truth shared by the /case-studies
// route and the CaseStudyPreviews marketing component.
//
// Every entry here is a scenario written to show how an engagement runs. None
// of them is a client result, and none carries a performance figure. Scope
// numbers (positions, sites) describe the example brief, not an outcome.
// Results figures belong in `src/config/case-study-metrics.ts`, where a number
// does not render until its source is written down.
//
// Named case studies are added only with the client's written approval.
// -----------------------------------------------------------------------------

import { FIRST_SHORTLIST_BUSINESS_DAYS } from "@/config/offer-facts";

/** Shown once on every example engagement card. */
export const EXAMPLE_ENGAGEMENT_LABEL =
  "Example engagement — representative data, not a client result" as const;

export type CaseStudyTestimonial = {
  quote: string;
  author: string;
  role: string;
};

export type CaseStudy = {
  slug: string;
  industry: string;
  companyType: string;
  region: string;
  headline: string;
  /** The situation the example brief starts from. */
  situation: string;
  /** Roles in the example brief. */
  rolesNeeded: string[];
  /** How the engagement runs, in order. Process steps only, never results. */
  timeline: { day: string; label: string }[];
  /** Usual timing to a first shortlist, from the offer facts. Not a guarantee. */
  timeToFirstShortlist: string;
  /** Scope of the example brief. These are inputs, not outcomes. */
  qualitySignal: { label: string; value: string; sub?: string }[];
  /** What the example shows about how the work is run. */
  outcome: string;
  outcomeHighlight: string;
  /** Only present where a real, approved testimonial exists; omit rather than invent. */
  testimonial?: CaseStudyTestimonial;
  /**
   * True (the default) while the study is an example. Set to false only for a
   * named study with written client approval.
   */
  representative?: boolean;
};

const USUAL_FIRST_SHORTLIST = `${FIRST_SHORTLIST_BUSINESS_DAYS} business days, usually`;

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "hospitality-luxury-group",
    industry: "Hospitality",
    companyType: "Luxury hotel group, several properties",
    region: "Europe · Middle East",
    headline: "Staffing a hotel group ahead of several openings",
    situation:
      "Pre-opening hiring for several flagship properties. Front-of-house, F&B leadership, revenue management and spa roles all run to one calendar with a fixed opening date.",
    rolesNeeded: ["Hotel General Manager", "F&B Director", "Revenue Manager", "Executive Chef", "Spa Director", "Front Office Manager", "Director of Sales", "Rooms Division Manager"],
    timeline: [
      { day: "Step 1", label: "One role brief captured per property" },
      { day: "Step 2", label: "Criteria approved before sourcing starts" },
      { day: "Step 3", label: "Ranked shortlists reviewed by a recruiter" },
      { day: "Step 4", label: "The client interviews and decides" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Properties", value: "6", sub: "in the example brief" },
      { label: "Role families", value: "4", sub: "front of house, F&B, revenue, spa" },
    ],
    outcome:
      "The example shows parallel intake across properties on one location-scored candidate pool, so a candidate considered for one property is visible for the next. Opening dates are the client's constraint; TaaSFlow does not promise a hiring outcome against them.",
    outcomeHighlight: "Illustrates parallel intake across several properties",
  },
  {
    slug: "finance-mid-market-pe",
    industry: "Finance",
    companyType: "Mid-market private equity fund",
    region: "Americas · APAC",
    headline: "Building an investment team for a new fund",
    situation:
      "A newly raised fund needs a senior investment team in a fixed window, plus operating partners across portfolio companies.",
    rolesNeeded: ["Investment Director", "Vice President, Investments", "Portfolio Operating Partner", "Head of Value Creation", "Senior Associate", "Deal Origination Lead", "Head of IR"],
    timeline: [
      { day: "Step 1", label: "Fund mandate translated into role criteria" },
      { day: "Step 2", label: "Deal-experience evidence extracted from each CV" },
      { day: "Step 3", label: "Ranked shortlist reviewed by a recruiter" },
      { day: "Step 4", label: "The client checks references and decides" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Role types", value: "7", sub: "senior and operating" },
      { label: "Workspaces", value: "1", sub: "private to the mandate" },
    ],
    outcome:
      "The example shows deal experience quoted from the CV line by line, so the investment committee can verify each claim through references or data-room history. TaaSFlow surfaces what the CV states; it does not verify deal-tape claims.",
    outcomeHighlight: "Illustrates evidence-quoted shortlists for senior searches",
  },
  {
    slug: "healthcare-clinical-network",
    industry: "Healthcare",
    companyType: "Specialty clinic network, multiple sites",
    region: "Europe · North America",
    headline: "Recruiting leadership for a multi-site clinic network",
    situation:
      "A specialty clinic network needs clinical, operational and digital-health leadership across several sites. The client's own team handles licensure and credentialing.",
    rolesNeeded: ["Chief Medical Officer", "Clinic Director", "Head of Digital Health", "Director of Nursing", "Head of Patient Operations", "Regulatory & Compliance Lead"],
    timeline: [
      { day: "Step 1", label: "Licensure and scope requirements captured at intake" },
      { day: "Step 2", label: "Licence and certification claims quoted from each CV" },
      { day: "Step 3", label: "Ranked shortlist reviewed by a recruiter" },
      { day: "Step 4", label: "The client's team verifies licences and credentials" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Sites", value: "11", sub: "in the example brief" },
      { label: "Role types", value: "6", sub: "clinical and operational" },
    ],
    outcome:
      "The example shows licensure claims surfaced with the CV line beside them so the client's credentialing team can verify each one at the source. TaaSFlow does not verify licensure, perform clinical credentialing or run background checks unless separately agreed.",
    outcomeHighlight: "Illustrates how licensure claims are surfaced for your team to verify",
  },
  {
    slug: "tech-series-c-platform",
    industry: "Technology",
    companyType: "Series C infrastructure platform company",
    region: "North America · Europe",
    headline: "Growing engineering, product and design in parallel",
    situation:
      "A growth-stage infrastructure company needs to expand engineering and stand up a product-led design organisation without lowering its bar.",
    rolesNeeded: ["Staff Engineer, Platform", "Principal PM", "Head of Design", "Engineering Manager", "Senior Backend Engineer", "Design Systems Lead"],
    timeline: [
      { day: "Step 1", label: "Skill criteria and rubric agreed per track" },
      { day: "Step 2", label: "Evidence extracted from CVs and linked work" },
      { day: "Step 3", label: "Ranked shortlists reviewed by a recruiter" },
      { day: "Step 4", label: "Interview panels run by the client" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Tracks", value: "3", sub: "engineering, product, design" },
      { label: "Role types", value: "6", sub: "in the example brief" },
    ],
    outcome:
      "The example shows one rubric per track with the evidence behind each score, so interview panels across regions start from the same written criteria. Scores support a person's decision; they do not make it.",
    outcomeHighlight: "Illustrates one rubric per track across regions",
  },
  {
    slug: "consumer-dtc-scaleup",
    industry: "Consumer & Retail",
    companyType: "DTC consumer brand, omnichannel scale-up",
    region: "Europe · Americas",
    headline: "Hiring leadership for a move into omnichannel retail",
    situation:
      "A fast-growing direct-to-consumer brand needs leadership across retail expansion, supply chain, brand and performance marketing while protecting margin discipline.",
    rolesNeeded: ["Chief Retail Officer", "VP Supply Chain", "Head of Brand", "Director of Performance Marketing", "Head of Category", "Regional GM"],
    timeline: [
      { day: "Step 1", label: "Growth plan translated into a role map" },
      { day: "Step 2", label: "Category, margin and channel evidence defined" },
      { day: "Step 3", label: "Ranked shortlist reviewed by a recruiter" },
      { day: "Step 4", label: "The client interviews and decides" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Role types", value: "6", sub: "commercial and operations" },
      { label: "Markets", value: "4", sub: "in the example plan" },
    ],
    outcome:
      "The example shows senior shortlists that require documented category ownership, margin and channel results at comparable scale, quoted from the CV for the client to check.",
    outcomeHighlight: "Illustrates evidence of ownership at comparable scale",
  },
  {
    slug: "industrial-energy-transition",
    industry: "Industrial & Energy",
    companyType: "Heavy-industry group, low-carbon division",
    region: "Europe · Middle East · APAC",
    headline: "Leadership hiring across regions for a low-carbon division",
    situation:
      "A heavy-industry group building a low-carbon business needs engineering, EPC and commercial leadership across sites on three continents.",
    rolesNeeded: ["Head of Low-Carbon Projects", "VP Engineering", "EPC Program Director", "Commissioning Manager", "Head of HSE", "Commercial Director"],
    timeline: [
      { day: "Step 1", label: "Programme charter split into regional briefs" },
      { day: "Step 2", label: "Safety and delivery requirements set as shortlist gates" },
      { day: "Step 3", label: "Ranked regional shortlists reviewed by a recruiter" },
      { day: "Step 4", label: "Regional leads interview and decide" },
    ],
    timeToFirstShortlist: USUAL_FIRST_SHORTLIST,
    qualitySignal: [
      { label: "Regions", value: "3", sub: "in the example brief" },
      { label: "Role types", value: "6", sub: "engineering and commercial" },
    ],
    outcome:
      "The example shows safety records, EPC delivery history and commissioning experience set as gates before ranking, with the CV evidence shown beside each candidate for the client to confirm.",
    outcomeHighlight: "Illustrates regional briefs with shared shortlist gates",
  },
];
