/**
 * Industry Profiles — vertical-specific personalization catalog.
 *
 * A single client's `organizations.industry` string resolves to one entry
 * here. Consumers (dashboards, intake, evidence review) read the returned
 * profile to render vertical-appropriate:
 *   • default filters
 *   • sample requirement libraries
 *   • role families
 *   • evidence templates
 *   • certification checks (where regulated)
 *   • hero accent + short copy strapline
 *
 * Adding a new vertical: add an entry, keep shape identical, update
 * `INDUSTRY_ALIASES` if the raw string in `organizations.industry` differs
 * from the canonical key.
 */

export type IndustryKey =
  | "hospitality"
  | "healthcare"
  | "finance"
  | "technology"
  | "retail"
  | "manufacturing"
  | "legal"
  | "education"
  | "logistics"
  | "energy"
  | "generic";

export type IndustryProfile = {
  key: IndustryKey;
  label: string;
  strapline: string;
  accent: "sunset" | "clinical" | "trading" | "code" | "commerce" | "steel" | "gavel" | "chalk" | "route" | "grid" | "neutral";
  defaultFilters: {
    stage: readonly string[];
    languages?: readonly string[];
    experienceYears?: { min: number; max: number };
  };
  sampleRequirements: readonly string[];
  roleFamilies: readonly string[];
  evidenceTemplates: readonly string[];
  certifications: readonly string[];
  copy: {
    overviewIntro: string;
    scoringHint: string;
  };
};

const P = <T extends IndustryProfile>(x: T) => x;

export const INDUSTRY_PROFILES: Record<IndustryKey, IndustryProfile> = {
  hospitality: P({
    key: "hospitality",
    label: "Hospitality",
    strapline: "Guest-facing operations, seasonal peaks, service standards.",
    accent: "sunset",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      languages: ["English"],
      experienceYears: { min: 1, max: 15 },
    },
    sampleRequirements: [
      "3+ years front-of-house or F&B leadership",
      "Multilingual (English + one European language)",
      "Proven guest satisfaction score (NPS or GSS)",
      "Comfortable with rotating shifts and weekend coverage",
      "Familiar with Opera, Micros, or a comparable PMS/POS",
      "Right to work in the property's country",
    ],
    roleFamilies: [
      "Front Office & Guest Services",
      "Food & Beverage",
      "Housekeeping & Rooms",
      "Culinary Leadership",
      "Revenue & Reservations",
      "Property Management",
    ],
    evidenceTemplates: [
      "Guest-satisfaction lift owned by the candidate (numeric, source)",
      "Team size directly managed and turnover trend",
      "Peak-season coverage and shift-planning ownership",
      "Multilingual customer interaction — languages + fluency signal",
    ],
    certifications: [
      "Food-handler / HACCP",
      "Alcohol service (where required by jurisdiction)",
      "First aid",
    ],
    copy: {
      overviewIntro: "Roles are ranked with service standards, language fit, and peak-season readiness in mind.",
      scoringHint: "Evidence emphasises guest impact and shift ownership, not job titles alone.",
    },
  }),

  healthcare: P({
    key: "healthcare",
    label: "Healthcare",
    strapline: "Regulated, credential-first, patient outcomes matter.",
    accent: "clinical",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 2, max: 25 },
    },
    sampleRequirements: [
      "Active professional licence in operating country",
      "Documented clinical hours in the relevant setting",
      "Familiarity with EMR/EHR (Epic, Cerner, or equivalent)",
      "Comfortable with on-call rotations",
      "Patient-safety / quality-improvement track record",
      "Fluent in the working language of the ward",
    ],
    roleFamilies: [
      "Nursing & Advanced Practice",
      "Physicians & Consultants",
      "Allied Health",
      "Clinical Operations",
      "Compliance & Quality",
      "Health IT",
    ],
    evidenceTemplates: [
      "Licence number and issuing body (verified against register)",
      "Clinical setting and case-mix seniority",
      "Patient-safety incidents owned and remediation",
      "Continuing-education hours in the last 24 months",
    ],
    certifications: [
      "Country-specific clinical licence (RN, MD, MBBS, etc.)",
      "BLS / ACLS / ATLS (as role requires)",
      "Specialty board certification",
      "Background check + immunisation status",
    ],
    copy: {
      overviewIntro: "Every shortlist starts from a licence check and a clinical-setting match.",
      scoringHint: "Contradictions between claimed licences and registers block auto-publish.",
    },
  }),

  finance: P({
    key: "finance",
    label: "Financial services",
    strapline: "Regulated, quantitative, controlled environments.",
    accent: "trading",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 3, max: 25 },
    },
    sampleRequirements: [
      "5+ years in a regulated firm (IB, AM, fintech, or Big-4 audit)",
      "Quantitative degree or CFA / FRM / ACA / CPA",
      "Familiar with the relevant reg regime (MiFID II, Basel, SOX)",
      "Comfortable with Python / SQL for analysis",
      "Trade or portfolio-level P&L attribution experience",
      "Clean background and regulatory-history disclosure",
    ],
    roleFamilies: [
      "Investment Banking",
      "Asset & Wealth Management",
      "Risk & Compliance",
      "Quant & Data Science",
      "Corporate Finance",
      "Audit & Controls",
    ],
    evidenceTemplates: [
      "P&L, AUM, or deal-size ownership (with attribution)",
      "Regulatory scope handled and remediation outcomes",
      "Quant / model output shipped into production",
      "Series / SIE / regulatory-exam status",
    ],
    certifications: [
      "CFA / FRM / CAIA",
      "ACA / ACCA / CPA",
      "Series 7 / 63 / 79 (US) or FCA SMCR-relevant certifications (UK)",
      "Fit-and-proper / background screening",
    ],
    copy: {
      overviewIntro: "Ranking leans on regulated tenure, quantitative rigour, and clean attestation history.",
      scoringHint: "Regulatory contradictions surface before shortlist, never after.",
    },
  }),

  technology: P({
    key: "technology",
    label: "Technology",
    strapline: "Systems-thinking, shipped work, calibrated seniority.",
    accent: "code",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 2, max: 20 },
    },
    sampleRequirements: [
      "4+ years shipping production code in a modern stack",
      "Owned a service end-to-end (design, ship, on-call)",
      "Comfortable with distributed systems or cloud-native architecture",
      "Contributed to a codebase used by 50k+ users OR OSS with adoption",
      "Async collaboration across time zones",
      "Fluent in the working language of the team",
    ],
    roleFamilies: [
      "Software Engineering",
      "Platform & SRE",
      "Data & ML",
      "Product & Design",
      "Security",
      "Engineering Leadership",
    ],
    evidenceTemplates: [
      "Specific systems owned (repo scale, traffic, uptime)",
      "Incidents led and post-mortem outcomes",
      "Recent open-source, talks, or public artefacts",
      "Level calibration vs. leveling.fyi-style ladder",
    ],
    certifications: [
      "Cloud (AWS/GCP/Azure) role-based certifications where relevant",
      "Security certifications (CISSP / OSCP) for security roles",
    ],
    copy: {
      overviewIntro: "Ranking prefers concrete shipped work over titles, and calibrates seniority against your ladder.",
      scoringHint: "GitHub, talks, and RFCs feed evidence — not just the CV.",
    },
  }),

  retail: P({
    key: "retail",
    label: "Retail & consumer",
    strapline: "Store-level operations, seasonal cycles, customer metrics.",
    accent: "commerce",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 1, max: 15 },
    },
    sampleRequirements: [
      "Store or district management with P&L ownership",
      "Familiar with WFM / labour-planning tools",
      "Loss-prevention or shrink-reduction track record",
      "Comfortable with peak-season staffing surges",
      "Omni-channel (in-store + digital) experience",
      "Right to work in operating country",
    ],
    roleFamilies: [
      "Store Operations",
      "Merchandising & Buying",
      "Supply Chain",
      "E-commerce & Digital",
      "Marketing & CRM",
      "Loss Prevention",
    ],
    evidenceTemplates: [
      "Same-store sales lift owned (%, source)",
      "Team size and turnover metrics",
      "Shrink or margin recovery outcomes",
      "Peak-season staffing plans executed",
    ],
    certifications: [
      "Health & safety officer certification",
      "Payment / PCI-DSS awareness (finance-adjacent roles)",
    ],
    copy: {
      overviewIntro: "Shortlists prioritise operators with measured store-level impact and clean scale-up records.",
      scoringHint: "Same-store metrics and shrink outcomes weigh more than generic 'management experience'.",
    },
  }),

  manufacturing: P({
    key: "manufacturing",
    label: "Manufacturing & industrial",
    strapline: "Safety, throughput, and Lean/Six-Sigma discipline.",
    accent: "steel",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 3, max: 30 },
    },
    sampleRequirements: [
      "5+ years on a production line at scale",
      "Lean, Six-Sigma, or TPM certification with applied projects",
      "OEE / cycle-time improvement owned",
      "Comfortable with unionised workforces (where applicable)",
      "Familiar with the relevant safety regime (OSHA, ISO 45001)",
      "Willing to work rotating shifts",
    ],
    roleFamilies: [
      "Production & Line Leadership",
      "Quality & Continuous Improvement",
      "Maintenance & Reliability",
      "Supply Chain & Planning",
      "Health, Safety & Environment",
      "Plant Management",
    ],
    evidenceTemplates: [
      "OEE / yield lift owned (numeric, source)",
      "Safety-incident reduction and root-cause work",
      "Six-Sigma project savings ($, timeframe)",
      "Union / works-council interactions handled",
    ],
    certifications: [
      "Six-Sigma Green / Black Belt",
      "ISO 9001 / 14001 / 45001 lead auditor",
      "Country-specific safety officer certification",
    ],
    copy: {
      overviewIntro: "Roles rank by throughput lift, safety record, and continuous-improvement rigour.",
      scoringHint: "Safety and CI evidence must be quantified — no unsupported claims.",
    },
  }),

  legal: P({
    key: "legal",
    label: "Legal & professional services",
    strapline: "Bar admissions, deal experience, judgement.",
    accent: "gavel",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 3, max: 25 },
    },
    sampleRequirements: [
      "Active bar admission in operating jurisdiction",
      "Matter-lead or partner-track experience in the practice area",
      "Familiar with a leading DMS (iManage, NetDocs)",
      "Client-development track record",
      "Cross-border work (where relevant)",
      "Conflict-check-clean history",
    ],
    roleFamilies: [
      "Corporate & M&A",
      "Disputes & Litigation",
      "Regulatory & Compliance",
      "Tax & Employment",
      "IP & Technology",
      "General Counsel & In-house",
    ],
    evidenceTemplates: [
      "Matter list with value and role (lead / co-lead)",
      "Bar admissions with verification date",
      "Client-development / origination revenue",
      "Publications, speaking, or thought-leadership signal",
    ],
    certifications: [
      "Bar admission (jurisdiction-specific)",
      "Solicitors Regulation Authority / equivalent standing certificate",
    ],
    copy: {
      overviewIntro: "Every ranking begins with bar-admission verification and matter-level attribution.",
      scoringHint: "Deal or matter attribution matters more than the firm name on the CV.",
    },
  }),

  education: P({
    key: "education",
    label: "Education",
    strapline: "Credential-verified educators and school leaders.",
    accent: "chalk",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 1, max: 30 },
    },
    sampleRequirements: [
      "Country-recognised teaching qualification",
      "Safeguarding / DBS-equivalent clearance",
      "Subject-specific knowledge at required level",
      "Comfortable with inclusive / differentiated instruction",
      "Familiar with common LMS (Canvas, Google Classroom, Moodle)",
      "Fluent in the medium of instruction",
    ],
    roleFamilies: [
      "Early Years & Primary",
      "Secondary Subject Teachers",
      "SEND & Inclusion",
      "Heads & Deputy Heads",
      "Higher Education",
      "EdTech & Learning Design",
    ],
    evidenceTemplates: [
      "Qualification (PGCE / QTS / equivalent) with issuing body",
      "Safeguarding clearance status and date",
      "Student-outcome data owned",
      "CPD hours in the last 24 months",
    ],
    certifications: [
      "QTS / PGCE / country teaching licence",
      "Safeguarding / Child protection",
      "SEND training (where role requires)",
    ],
    copy: {
      overviewIntro: "Every shortlist verifies teaching qualification and safeguarding status first.",
      scoringHint: "Student-outcome and CPD evidence outrank tenure-alone claims.",
    },
  }),

  logistics: P({
    key: "logistics",
    label: "Logistics & supply chain",
    strapline: "Network operations, SLAs, and moved units.",
    accent: "route",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 2, max: 25 },
    },
    sampleRequirements: [
      "3+ years operating a distribution centre or transport network",
      "Owned an on-time-in-full (OTIF) metric",
      "Familiar with a TMS / WMS (SAP EWM, Manhattan, Blue Yonder)",
      "Comfortable with hazardous or temperature-controlled goods (where relevant)",
      "Understanding of customs / cross-border compliance",
      "Right to work in operating country",
    ],
    roleFamilies: [
      "DC Operations",
      "Transport & Fleet",
      "Planning & S&OP",
      "Customs & Trade Compliance",
      "Continuous Improvement",
      "Network Leadership",
    ],
    evidenceTemplates: [
      "OTIF / DIFOT owned (%, source)",
      "Units shipped / peak-day throughput",
      "Cost-per-unit or cost-to-serve improvements",
      "Safety and incident record",
    ],
    certifications: [
      "APICS CPIM / CSCP",
      "Dangerous-goods (IATA / ADR)",
      "Country-specific driver / operator licences (fleet roles)",
    ],
    copy: {
      overviewIntro: "Shortlists rank by operators with measured OTIF, throughput, and cost-to-serve wins.",
      scoringHint: "Peak-day performance beats average-day claims.",
    },
  }),

  energy: P({
    key: "energy",
    label: "Energy & utilities",
    strapline: "Regulated, capital-intensive, safety-first.",
    accent: "grid",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 3, max: 30 },
    },
    sampleRequirements: [
      "5+ years in upstream, midstream, downstream, or utility operations",
      "Familiar with the regulator (Ofgem, FERC, ARERA — as relevant)",
      "Capital-project or asset-management experience",
      "HSE track record with incident-free tenure",
      "Comfortable with SCADA or EMS platforms (grid / utility roles)",
      "Willing to work at site / offshore (where role requires)",
    ],
    roleFamilies: [
      "Upstream & Field Ops",
      "Grid & Networks",
      "Renewables Development",
      "Trading & Origination",
      "Regulatory & Policy",
      "HSE & Sustainability",
    ],
    evidenceTemplates: [
      "Asset / project size owned (MW, bbl/day, capex)",
      "HSE record and lost-time-injury data",
      "Regulatory filings led",
      "Decarbonisation / renewables portfolio contributed to",
    ],
    certifications: [
      "IOSH / NEBOSH",
      "Offshore survival (BOSIET) for field roles",
      "Country-specific engineering registration (P.Eng, CEng)",
    ],
    copy: {
      overviewIntro: "Ranking prioritises operators with clean HSE records and quantified asset ownership.",
      scoringHint: "Every claimed certification is checked against register status.",
    },
  }),

  generic: P({
    key: "generic",
    label: "Cross-industry",
    strapline: "General knowledge-worker roles, no vertical specialisation.",
    accent: "neutral",
    defaultFilters: {
      stage: ["delivered", "shortlisted"],
      experienceYears: { min: 1, max: 25 },
    },
    sampleRequirements: [
      "Demonstrated ownership of a measurable outcome",
      "Relevant education or equivalent applied experience",
      "Comfortable with the working language of the team",
      "Right to work in the role's country",
    ],
    roleFamilies: [
      "Operations",
      "Commercial",
      "Product & Growth",
      "People & Talent",
      "Finance & Legal",
      "Support",
    ],
    evidenceTemplates: [
      "Outcome owned with source citation",
      "Team / budget scope",
      "Recent (24-month) achievements",
    ],
    certifications: [],
    copy: {
      overviewIntro: "General ranking uses evidence of shipped outcomes over titles.",
      scoringHint: "Add a vertical to unlock industry-specific rubric and certification checks.",
    },
  }),
};

/** Raw `organizations.industry` values users type → canonical key. */
const INDUSTRY_ALIASES: Record<string, IndustryKey> = {
  hospitality: "hospitality",
  hotel: "hospitality",
  hotels: "hospitality",
  restaurant: "hospitality",
  "food & beverage": "hospitality",
  "f&b": "hospitality",
  healthcare: "healthcare",
  health: "healthcare",
  hospital: "healthcare",
  clinical: "healthcare",
  pharma: "healthcare",
  finance: "finance",
  financial: "finance",
  banking: "finance",
  fintech: "finance",
  insurance: "finance",
  "asset management": "finance",
  technology: "technology",
  tech: "technology",
  software: "technology",
  saas: "technology",
  it: "technology",
  retail: "retail",
  ecommerce: "retail",
  consumer: "retail",
  "consumer goods": "retail",
  manufacturing: "manufacturing",
  industrial: "manufacturing",
  automotive: "manufacturing",
  legal: "legal",
  law: "legal",
  "professional services": "legal",
  education: "education",
  edtech: "education",
  school: "education",
  university: "education",
  logistics: "logistics",
  "supply chain": "logistics",
  transport: "logistics",
  shipping: "logistics",
  energy: "energy",
  utilities: "energy",
  oil: "energy",
  gas: "energy",
  renewables: "energy",
  power: "energy",
};

export function resolveIndustryProfile(raw: string | null | undefined): IndustryProfile {
  if (!raw) return INDUSTRY_PROFILES.generic;
  const key = raw.trim().toLowerCase();
  if (key in INDUSTRY_ALIASES) return INDUSTRY_PROFILES[INDUSTRY_ALIASES[key]!];
  // Substring match on canonical keys as a fallback.
  for (const k of Object.keys(INDUSTRY_PROFILES) as IndustryKey[]) {
    if (k !== "generic" && key.includes(k)) return INDUSTRY_PROFILES[k];
  }
  return INDUSTRY_PROFILES.generic;
}
