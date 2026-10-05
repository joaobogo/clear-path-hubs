// -----------------------------------------------------------------------------
// Public engagement examples.
//
// These are illustrative scenarios, not client results. We deliberately keep
// performance figures out until a named or anonymised client engagement has a
// documented source and publication approval.
// -----------------------------------------------------------------------------

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
  situation: string;
  rolesNeeded: string[];
  timeline: { day: string; label: string }[];
  timeToFirstShortlist: string;
  qualitySignal: { label: string; value: string; sub?: string }[];
  outcome: string;
  outcomeHighlight: string;
  testimonial?: CaseStudyTestimonial;
  representative?: boolean;
};

const STANDARD_TIMELINE = [
  { day: "Step 1", label: "Role brief and scoring criteria confirmed" },
  { day: "Step 2", label: "Multi-channel sourcing and outreach begins" },
  { day: "Step 3", label: "Candidates are scored against the approved criteria" },
  { day: "Step 4", label: "Senior recruiter reviews before client delivery" },
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "hospitality-luxury-group",
    industry: "Hospitality",
    companyType: "Multi-property hospitality operator",
    region: "Global",
    headline: "Example: multi-property hospitality hiring",
    situation:
      "A hospitality group needs leadership and operations roles across several properties while keeping one consistent evidence bar.",
    rolesNeeded: ["Hotel General Manager", "F&B Director", "Revenue Manager", "Executive Chef"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example shows how TaaSFlow can organise several hospitality searches around one role brief, one scoring method and one client-owned workspace.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
  {
    slug: "finance-mid-market-pe",
    industry: "Finance",
    companyType: "Private-equity and investment team",
    region: "Global",
    headline: "Example: investment-team recruiting",
    situation:
      "An investment team needs candidates assessed against deal experience, sector exposure, seniority and geography rather than generic finance keywords.",
    rolesNeeded: ["Investment Director", "Vice President", "Operating Partner", "Senior Associate"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example illustrates an evidence-led search where every candidate is scored against the investment criteria the client approves.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
  {
    slug: "healthcare-clinical-network",
    industry: "Healthcare",
    companyType: "Multi-site healthcare operator",
    region: "Global",
    headline: "Example: healthcare leadership hiring",
    situation:
      "A healthcare operator needs clinical and operational leadership while keeping licensing and credential checks explicit in the role brief.",
    rolesNeeded: ["Clinic Director", "Director of Nursing", "Operations Lead", "Compliance Lead"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example shows how required credentials can be captured as explicit criteria while the client retains responsibility for final verification and hiring decisions.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
  {
    slug: "tech-series-c-platform",
    industry: "Technology",
    companyType: "Scaling software company",
    region: "Global",
    headline: "Example: product and engineering hiring",
    situation:
      "A scaling software company needs technical candidates compared consistently across experience, scope, architecture and leadership requirements.",
    rolesNeeded: ["Staff Engineer", "Engineering Manager", "Product Manager", "Design Lead"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example illustrates a role-specific search with evidence attached to each score so hiring managers can compare candidates side by side.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
  {
    slug: "consumer-dtc-scaleup",
    industry: "Consumer & Retail",
    companyType: "Omnichannel consumer brand",
    region: "Global",
    headline: "Example: commercial and operations hiring",
    situation:
      "A consumer brand needs leaders across retail, supply chain and growth while keeping the search tied to business scale and channel experience.",
    rolesNeeded: ["Retail Director", "Supply Chain Lead", "Head of Brand", "Growth Director"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example shows how TaaSFlow can turn business context into role criteria, source broadly and return a scored candidate view.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
  {
    slug: "industrial-energy-transition",
    industry: "Industrial & Energy",
    companyType: "Industrial and energy business",
    region: "Global",
    headline: "Example: technical and project leadership hiring",
    situation:
      "An industrial business needs project, engineering and commercial leaders with specific delivery environments, safety experience and geographic constraints.",
    rolesNeeded: ["Engineering Director", "Program Director", "HSE Lead", "Commercial Director"],
    timeline: STANDARD_TIMELINE,
    timeToFirstShortlist: "the published pilot timeline",
    qualitySignal: [],
    outcome:
      "This example illustrates how technical constraints become explicit scoring criteria instead of being buried in recruiter notes.",
    outcomeHighlight: "Illustrative engagement — not a reported client result",
    representative: true,
  },
];
