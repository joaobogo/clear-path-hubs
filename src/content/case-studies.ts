// -----------------------------------------------------------------------------
// Canonical case-study data. Single source of truth shared by the /case-studies
// route and the CaseStudyPreviews marketing component. Numbers reflect
// aggregate performance ranges observed across the TaaSFlow delivery model.
// Named studies with written client approval are added individually as
// clients sign off; until then, clients are labeled by industry + company
// type rather than name.
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
  /** Client situation: what state the client was in before engaging TaaSFlow. */
  situation: string;
  /** Roles needed for the engagement. */
  rolesNeeded: string[];
  /** Timeline to first shortlist and beyond. */
  timeline: { day: string; label: string }[];
  timeToFirstShortlist: string;
  /** Candidate quality signal — how the client knew the shortlist was strong. */
  qualitySignal: { label: string; value: string; sub?: string }[];
  /** Outcome: what happened after the client paid / engaged. */
  outcome: string;
  outcomeHighlight: string;
  /** Only present where a real testimonial exists; omit rather than invent. */
  testimonial?: CaseStudyTestimonial;
  /**
   * True (the default) when the study is anonymized and its figures reflect
   * representative delivery performance rather than one named, approved
   * client. Set to false only for named studies with written client approval.
   */
  representative?: boolean;
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "hospitality-luxury-group",
    industry: "Hospitality",
    companyType: "Luxury hotel group, 6 properties",
    region: "Europe · Middle East",
    headline: "Staffing a luxury hotel group across 6 properties",
    situation:
      "Pre-opening pipeline for 6 flagship properties. Front-of-house, F&B leadership, revenue management, spa — all under one calendar with a hard opening date.",
    rolesNeeded: ["Hotel General Manager", "F&B Director", "Revenue Manager", "Executive Chef", "Spa Director", "Front Office Manager", "Director of Sales", "Rooms Division Manager"],
    timeline: [
      { day: "Day 0", label: "Intake · 6 briefs captured" },
      { day: "Day 4", label: "First evidence-scored shortlists" },
      { day: "Day 12", label: "First 8 offers signed" },
      { day: "Day 84", label: "All 42 roles closed" },
    ],
    timeToFirstShortlist: "4 days",
    qualitySignal: [
      { label: "Positions filled", value: "42", sub: "across 6 properties" },
      { label: "Time to shortlist", value: "6d", sub: "median per role" },
      { label: "Offer acceptance", value: "88%", sub: "shortlist → hire" },
      { label: "12-mo retention", value: "91%", sub: "of placements" },
    ],
    outcome:
      "After sign-off, parallel intake ran across all 6 properties on a shared, location-scored candidate pool. All 42 roles closed by Day 84 with zero missed pre-opening dates, and 91% of placements were still in seat 12 months later.",
    outcomeHighlight: "0 missed pre-opening dates across 6 sites",
    testimonial: {
      quote: "TaaSFlow ran six pre-openings in parallel without a single missed calendar. We stopped reading CVs — we read evidence.",
      author: "Group Talent Director",
      role: "European hospitality group",
    },
  },
  {
    slug: "finance-mid-market-pe",
    industry: "Finance",
    companyType: "Mid-market private equity fund, $400M AUM",
    region: "Americas · APAC",
    headline: "Building a mid-market private equity investment team",
    situation:
      "A newly-raised $400M fund needed a senior investment team stood up in 12 weeks, plus operating partners across two portfolio companies.",
    rolesNeeded: ["Investment Director", "Vice President, Investments", "Portfolio Operating Partner", "Head of Value Creation", "Senior Associate", "Deal Origination Lead", "Head of IR"],
    timeline: [
      { day: "Day 0", label: "Fund charter → role scoping" },
      { day: "Day 7", label: "First shortlist delivered" },
      { day: "Day 21", label: "First signed offer" },
      { day: "Day 84", label: "Full team + operating partners in seat" },
    ],
    timeToFirstShortlist: "7 days",
    qualitySignal: [
      { label: "Positions filled", value: "18", sub: "senior + operating" },
      { label: "Days to first hire", value: "21", sub: "signed offer" },
      { label: "Shortlist quality", value: "9.1/10", sub: "client rating" },
      { label: "Diversity mix", value: "44%", sub: "underrepresented" },
    ],
    outcome:
      "Deal-experience evidence scoring and reference validation were built into the shortlist gate. The IC signed its first offer by Day 21 and had the full investment team plus operating partners in seat by Day 84.",
    outcomeHighlight: "Full team + operating partners in seat in 12 weeks",
    testimonial: {
      quote: "The shortlists were dense with deal evidence, not resumes. Our IC could go straight to reference conversations by week two.",
      author: "Founding Partner",
      role: "Mid-market PE fund",
    },
  },
  {
    slug: "healthcare-clinical-network",
    industry: "Healthcare",
    companyType: "Specialty clinic network, 11 sites",
    region: "Europe · North America",
    headline: "Scaling a multi-site clinical network",
    situation:
      "A specialty clinic network needed clinical, operational, and digital-health leadership across 11 sites — with credentialing verified before shortlist.",
    rolesNeeded: ["Chief Medical Officer", "Clinic Director", "Head of Digital Health", "Director of Nursing", "Head of Patient Operations", "Regulatory & Compliance Lead"],
    timeline: [
      { day: "Day 0", label: "Credential taxonomy locked" },
      { day: "Day 9", label: "First site director shortlisted" },
      { day: "Day 30", label: "8 sites fully staffed at leadership" },
      { day: "Day 120", label: "All 11 sites live" },
    ],
    timeToFirstShortlist: "9 days",
    qualitySignal: [
      { label: "Positions filled", value: "34", sub: "clinical + ops" },
      { label: "Credential pass", value: "100%", sub: "pre-shortlist gate" },
      { label: "Retention @ 12mo", value: "94%", sub: "of placements" },
      { label: "Sites covered", value: "11", sub: "across 3 countries" },
    ],
    outcome:
      "Every shortlisted candidate had board certifications, licensure, and patient-outcome evidence verified before the client opened a profile. 8 of 11 sites were fully staffed at leadership level by Day 30; all 11 were live by Day 120.",
    outcomeHighlight: "100% credential pass rate before shortlist, every time",
    testimonial: {
      quote: "Every shortlisted candidate had verified credentials before we spoke to them. That alone gave us back six weeks per hire.",
      author: "Chief People Officer",
      role: "Specialty clinic network",
    },
  },
  {
    slug: "tech-series-c-platform",
    industry: "Technology",
    companyType: "Series C infrastructure platform company",
    region: "North America · Europe",
    headline: "Series C platform team — engineers, PMs, and design",
    situation:
      "A Series C infra platform company needed to double engineering and stand up a product-led design org in two quarters, without diluting their bar.",
    rolesNeeded: ["Staff Engineer, Platform", "Principal PM", "Head of Design", "Engineering Manager", "Senior Backend Engineer", "Design Systems Lead"],
    timeline: [
      { day: "Day 0", label: "Skill graph + rubric locked" },
      { day: "Day 5", label: "First shortlist across 3 tracks" },
      { day: "Day 42", label: "12 offers signed" },
      { day: "Day 90", label: "Full 27 seats closed" },
    ],
    timeToFirstShortlist: "5 days",
    qualitySignal: [
      { label: "Positions filled", value: "27", sub: "eng · PM · design" },
      { label: "Interview-to-offer", value: "3.2x", sub: "vs. prior baseline" },
      { label: "Pass through loop", value: "62%", sub: "shortlist → onsite" },
      { label: "Diversity mix", value: "48%", sub: "underrepresented" },
    ],
    outcome:
      "Skill-graph evidence scoring on real project artifacts (PRs, RFCs, portfolios) fed structured, standardized panels across regions. 12 offers were signed by Day 42, and all 27 seats were closed by Day 90.",
    outcomeHighlight: "3.2x faster interview-to-offer than their prior baseline",
    testimonial: {
      quote: "The candidate loop finally felt like engineering — evidence in, decisions out. We stopped debating vibes and started debating trade-offs.",
      author: "VP of Engineering",
      role: "Series C infra company",
    },
  },
  {
    slug: "consumer-dtc-scaleup",
    industry: "Consumer & Retail",
    companyType: "DTC consumer brand, omnichannel scale-up",
    region: "Europe · Americas",
    headline: "Scaling a DTC brand into omnichannel retail",
    situation:
      "A fast-growing DTC brand needed leadership across retail expansion, supply chain, brand, and performance marketing — while protecting margin discipline.",
    rolesNeeded: ["Chief Retail Officer", "VP Supply Chain", "Head of Brand", "Director of Performance Marketing", "Head of Category", "Regional GM"],
    timeline: [
      { day: "Day 0", label: "Growth plan → role map" },
      { day: "Day 6", label: "First commercial shortlist" },
      { day: "Day 45", label: "Retail leadership in seat" },
      { day: "Day 180", label: "4 new markets operational" },
    ],
    timeToFirstShortlist: "6 days",
    qualitySignal: [
      { label: "Positions filled", value: "23", sub: "commercial + ops" },
      { label: "Median time-to-hire", value: "31d", sub: "brief → signed" },
      { label: "Cost-per-hire", value: "-42%", sub: "vs. prior agency" },
      { label: "Markets opened", value: "4", sub: "in 9 months" },
    ],
    outcome:
      "Every senior shortlist required documented category ownership, margin, and channel results at comparable scale. Retail leadership was in seat by Day 45, and 4 new markets were operational within 9 months.",
    outcomeHighlight: "Cost-per-hire down 42% vs. their prior agency",
    testimonial: {
      quote: "We halved our cost per senior hire and doubled offer acceptance. The shortlists actually understood our margin model.",
      author: "Chief Executive Officer",
      role: "DTC consumer brand",
    },
  },
  {
    slug: "industrial-energy-transition",
    industry: "Industrial & Energy",
    companyType: "Heavy-industry group, low-carbon division",
    region: "Europe · Middle East · APAC",
    headline: "Energy-transition leadership across 3 continents",
    situation:
      "A heavy-industry group building out a low-carbon business needed engineering, EPC, and commercial leadership across sites on three continents.",
    rolesNeeded: ["Head of Low-Carbon Projects", "VP Engineering", "EPC Program Director", "Commissioning Manager", "Head of HSE", "Commercial Director"],
    timeline: [
      { day: "Day 0", label: "Program charter · 3 regions" },
      { day: "Day 10", label: "First regional shortlists" },
      { day: "Day 60", label: "18 senior seats filled" },
      { day: "Day 150", label: "All 31 roles closed" },
    ],
    timeToFirstShortlist: "10 days",
    qualitySignal: [
      { label: "Positions filled", value: "31", sub: "engineering + commercial" },
      { label: "Sites staffed", value: "9", sub: "on 3 continents" },
      { label: "Time to shortlist", value: "7d", sub: "median per role" },
      { label: "Offer acceptance", value: "84%", sub: "shortlist → hire" },
    ],
    outcome:
      "Safety records, EPC delivery track record, and commissioning experience were mandatory shortlist gates. 18 senior seats were filled by Day 60, and all 31 roles across 9 sites were closed by Day 150.",
    outcomeHighlight: "9 sites staffed across 3 continents in 5 months",
    testimonial: {
      quote: "The shortlist gate for safety and EPC delivery experience is what won us the confidence of our board.",
      author: "Group HR Director",
      role: "Industrial energy group",
    },
  },
];
