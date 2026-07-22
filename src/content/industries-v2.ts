/**
 * TaaSFlow V2 — Industry template data.
 *
 * Structured, verified copy for each industry page. All quantitative claims
 * from the legacy scrape (placement counts, cost savings %, delivery-day
 * counts) are intentionally excluded until approved. Every industry gets a
 * unique title, description, hero, challenge set, role list and CTA.
 */

export type IndustryEntry = {
  slug: string;
  eyebrow: string;
  name: string;
  meta: { title: string; description: string };
  hero: { title: string; subtitle: string };
  challenges: { title: string; body: string }[];
  roles: string[];
  signals: string[];
  cta: { title: string; description: string };
};

export const INDUSTRY_ENTRIES: IndustryEntry[] = [
  {
    slug: "tech",
    eyebrow: "Technology",
    name: "Technology",
    meta: {
      title: "Technology hiring — TaaSFlow",
      description:
        "Structured, evidence-based sourcing for engineering, platform, product and IT teams. Ranked shortlists in your workspace, with evidence tied to the CV.",
    },
    hero: {
      title: "Engineering and product hiring, on one transparent workflow.",
      subtitle:
        "TaaSFlow gives tech leaders a single workspace for every engineering search — with role-specific scoring rubrics, evidence extracted from the CV, and a ranked shortlist reviewed before it reaches you.",
    },
    challenges: [
      {
        title: "Signal is buried in the CV",
        body: "Great engineers describe their impact in prose, not keywords. Our scoring extracts the specific evidence — architecture decisions, systems owned, scale handled — instead of matching buzzwords.",
      },
      {
        title: "Volume vs precision",
        body: "Junior funnels flood inboxes while senior roles stall. We tune the rubric per level so the shortlist you see is calibrated to the seniority you are actually hiring for.",
      },
      {
        title: "Remote, hybrid and on-site trade-offs",
        body: "Every tech role has a location model. We capture it in intake and use it as a first-class filter so time zone and location mismatches never reach the shortlist.",
      },
    ],
    roles: [
      "Full-stack engineers",
      "Backend & platform engineers",
      "Frontend engineers",
      "DevOps & site reliability",
      "Mobile engineers",
      "Data & ML engineers",
      "Engineering managers",
      "Product managers",
      "IT & infrastructure specialists",
    ],
    signals: [
      "Rubric per role level",
      "Evidence quotes from the CV",
      "Ranked shortlist in your workspace",
    ],
    cta: {
      title: "Hiring for a tech team?",
      description:
        "Submit the role in our guided intake — draft saving is on, and your workspace is ready as soon as you finish.",
    },
  },
  {
    slug: "saas",
    eyebrow: "SaaS & Cloud",
    name: "SaaS",
    meta: {
      title: "SaaS hiring — TaaSFlow",
      description:
        "Ranked, evidence-backed candidates for SaaS teams: product, customer success, revenue operations, GTM and implementation. One workspace, transparent scoring.",
    },
    hero: {
      title: "Talent for SaaS teams who live and breathe recurring revenue.",
      subtitle:
        "TaaSFlow helps SaaS operators hire people who genuinely understand recurring revenue mechanics — from PLG motions to enterprise expansion — with evidence tied to what they actually did in prior roles.",
    },
    challenges: [
      {
        title: "SaaS titles hide very different jobs",
        body: "A “Customer Success Manager” at a self-serve tool is a different job to one at an enterprise platform. We calibrate the rubric to the motion (PLG, mid-market, enterprise) so shortlists reflect the reality of your business.",
      },
      {
        title: "Metrics fluency matters",
        body: "We evaluate evidence of working with the metrics that matter — ARR, NRR, activation, expansion — instead of accepting the words on a CV at face value.",
      },
      {
        title: "GTM specialisation is fragmenting",
        body: "RevOps, sales engineering, lifecycle and product marketing are increasingly distinct crafts. Our rubrics are role-specific so the wrong specialist never lands on your shortlist.",
      },
    ],
    roles: [
      "Product managers",
      "Customer success managers",
      "Revenue operations",
      "Product marketing",
      "Sales engineers",
      "Implementation & onboarding",
      "Lifecycle & growth",
      "Solutions architects",
    ],
    signals: [
      "Motion-specific rubric (PLG, mid-market, enterprise)",
      "Metrics evidence from the CV",
      "Ranked shortlist per role",
    ],
    cta: {
      title: "Growing a SaaS team?",
      description: "Submit the role and we’ll return a ranked, evidence-backed shortlist in your workspace.",
    },
  },
  {
    slug: "cybersecurity",
    eyebrow: "Cybersecurity",
    name: "Cybersecurity",
    meta: {
      title: "Cybersecurity hiring — TaaSFlow",
      description:
        "Security engineers, GRC leads, SOC analysts and cloud security specialists — sourced with structured rubrics and evidence-based scoring in one workspace.",
    },
    hero: {
      title: "Security hiring that actually verifies the security part.",
      subtitle:
        "TaaSFlow builds role-specific rubrics for every security domain — offensive, defensive, cloud, GRC and application security — and captures evidence from the CV so you can trust the shortlist you review.",
    },
    challenges: [
      {
        title: "Certifications aren’t the same as capability",
        body: "Certifications are a floor, not a ceiling. We score against real evidence — incidents handled, controls implemented, tooling owned — rather than treating a certificate as a substitute for it.",
      },
      {
        title: "Security roles are highly specialised",
        body: "AppSec, cloud security, detection engineering and GRC are different disciplines. Our rubrics are per-role so a generalist doesn’t get short-listed for a specialist opening.",
      },
      {
        title: "Trust and discretion matter",
        body: "Security hiring processes deserve tight access controls. TaaSFlow runs on row-level tenant isolation and private CV storage with short-lived signed URLs.",
      },
    ],
    roles: [
      "Security engineers",
      "Cloud & infrastructure security",
      "Application security",
      "Detection & response (SOC)",
      "Offensive security & red team",
      "Governance, risk & compliance",
      "Security architects",
      "CISOs & security leaders",
    ],
    signals: [
      "Domain-specific rubric",
      "Evidence quotes from the CV",
      "Private, tenant-isolated workspace",
    ],
    cta: {
      title: "Hiring a security specialist?",
      description: "Submit the role and receive a discreetly reviewed, evidence-backed shortlist.",
    },
  },
  {
    slug: "data-analytics",
    eyebrow: "Data & Analytics",
    name: "Data & Analytics",
    meta: {
      title: "Data & analytics hiring — TaaSFlow",
      description:
        "Data engineers, analysts, scientists and analytics leaders — sourced with rubric-based scoring and evidence extracted directly from the CV.",
    },
    hero: {
      title: "Data hires you can actually evaluate before the interview.",
      subtitle:
        "TaaSFlow builds a rubric for every data role — pipeline builders, analysts, scientists, ML engineers — and captures evidence of the modelling, tooling and business outcomes each candidate has delivered.",
    },
    challenges: [
      {
        title: "The data stack keeps changing",
        body: "Warehouses, orchestration, BI and ML tools shift constantly. We rebuild the rubric per search to reflect your actual stack — not last year’s.",
      },
      {
        title: "Analyst, engineer, or scientist?",
        body: "Titles blur between analytics engineering, data science and BI. We calibrate the rubric to the outcomes you need so the right specialist reaches your shortlist.",
      },
      {
        title: "Business fluency is the differentiator",
        body: "The best data hires move a business metric, not just a dashboard. We evaluate evidence of decisions influenced and metrics moved — not model choice trivia.",
      },
    ],
    roles: [
      "Data engineers",
      "Analytics engineers",
      "Data analysts",
      "BI developers",
      "Data scientists",
      "ML engineers",
      "Analytics leads",
      "Data governance & platform",
    ],
    signals: [
      "Stack-specific rubric",
      "Business-outcome evidence",
      "Ranked shortlist in your workspace",
    ],
    cta: {
      title: "Building a data team?",
      description:
        "Submit the role and we’ll return a ranked, evidence-backed shortlist calibrated to your stack.",
    },
  },
  {
    slug: "consulting",
    eyebrow: "Consulting",
    name: "Consulting",
    meta: {
      title: "Consulting hiring — TaaSFlow",
      description:
        "Consultants, analysts, and delivery specialists for firms and advisory practices — sourced through structured rubrics and evidence-based scoring.",
    },
    hero: {
      title: "Extend your delivery capacity without diluting your standard.",
      subtitle:
        "TaaSFlow helps consulting firms and advisory practices scale delivery: structured intake per engagement type, rubrics per level, and evidence of the outcomes each candidate has actually delivered.",
    },
    challenges: [
      {
        title: "Every engagement type wants a different profile",
        body: "Strategy, operations, technology and change work each favour different backgrounds. We calibrate rubrics per practice so the shortlist matches the engagement, not just the title.",
      },
      {
        title: "Consulting CVs read alike",
        body: "Case-count and firm names look similar on paper. Our scoring extracts specific evidence: the industries served, the problems owned, the outcomes delivered.",
      },
      {
        title: "Leverage without losing quality",
        body: "The whole point is more capacity at your standard. Every candidate we surface has been reviewed against your rubric before publication — no unranked pipes.",
      },
    ],
    roles: [
      "Management consultants",
      "Strategy advisors",
      "Operations consultants",
      "Technology consultants",
      "Change & transformation leads",
      "Project & programme managers",
      "Implementation consultants",
      "Practice & engagement leads",
    ],
    signals: [
      "Rubric per practice and level",
      "Outcome evidence from the CV",
      "Human review before publication",
    ],
    cta: {
      title: "Scaling a consulting practice?",
      description:
        "Submit the role — one workspace, one rubric, one accountable delivery team.",
    },
  },
  {
    slug: "legal",
    eyebrow: "Legal",
    name: "Legal",
    meta: {
      title: "Legal hiring — TaaSFlow",
      description:
        "Structured sourcing for law firms and in-house legal teams. Ranked shortlists with practice-area evidence extracted directly from the CV.",
    },
    hero: {
      title: "Legal hiring with evidence tied to practice area.",
      subtitle:
        "TaaSFlow gives general counsel and firm leaders a workspace for every legal search — rubrics tuned per practice area, jurisdiction and level, with a human-reviewed shortlist.",
    },
    challenges: [
      {
        title: "Practice-area precision",
        body: "Legal CVs blur across practice groups. Our rubric captures the specific matters, deal types and jurisdictions worked on so shortlists match the mandate — not the label.",
      },
      {
        title: "Jurisdiction and qualification",
        body: "Bar admissions, qualification routes and regulatory exposure are captured in intake and treated as first-class filters, not free-text notes.",
      },
      {
        title: "Confidentiality by default",
        body: "Every requisition sits in a private workspace scoped to your team. Candidate context stays inside the mandate it was collected for.",
      },
    ],
    roles: [
      "General counsel",
      "Corporate & commercial lawyers",
      "M&A and private equity counsel",
      "Litigation and disputes",
      "Regulatory and compliance counsel",
      "Employment lawyers",
      "IP and technology lawyers",
      "Legal operations leads",
      "Paralegals and legal analysts",
    ],
    signals: [
      "Practice-area rubric per requisition",
      "Jurisdiction and qualification as filters",
      "Evidence traced to the CV",
    ],
    cta: {
      title: "Hiring for a legal mandate?",
      description:
        "Submit the role — one workspace, one rubric, one reviewed shortlist.",
    },
  },
  {
    slug: "finance",
    eyebrow: "Finance",
    name: "Finance",
    meta: {
      title: "Finance hiring — TaaSFlow",
      description:
        "Structured sourcing for corporate finance, FP&A, treasury and controllership teams. Ranked shortlists with evidence extracted from the CV.",
    },
    hero: {
      title: "Finance hiring with rubrics tuned per function.",
      subtitle:
        "TaaSFlow gives CFOs and finance leaders a workspace for every hire — from FP&A analysts to VP-level controllers — with role-specific scoring and human-reviewed shortlists.",
    },
    challenges: [
      {
        title: "Function-specific signal",
        body: "FP&A, treasury, controllership and corporate development each need a different rubric. We build one per requisition instead of matching a generic 'finance' keyword set.",
      },
      {
        title: "Systems and reporting stack",
        body: "ERP, consolidation tools and reporting stack are captured in intake so shortlists reflect the operating environment the hire will actually work in.",
      },
      {
        title: "Level calibration",
        body: "Senior finance roles need judgement evidence, not tool lists. Rubrics per level surface the decision scope and ownership the CV actually describes.",
      },
    ],
    roles: [
      "CFOs and finance directors",
      "Financial controllers",
      "FP&A leads and analysts",
      "Corporate development and M&A",
      "Treasury and cash management",
      "Financial reporting and consolidation",
      "Business partners",
      "Investor relations",
    ],
    signals: [
      "Rubric per finance function and level",
      "Systems and reporting stack captured",
      "Human review before publication",
    ],
    cta: {
      title: "Building the finance team?",
      description:
        "Submit the role — one workspace per requisition, ranked and reviewed.",
    },
  },
  {
    slug: "accounting",
    eyebrow: "Accounting",
    name: "Accounting",
    meta: {
      title: "Accounting hiring — TaaSFlow",
      description:
        "Structured sourcing for accounting firms and in-house accounting teams. Ranked shortlists with evidence of the standards, cycles and systems worked on.",
    },
    hero: {
      title: "Accounting hiring, calibrated per standard and cycle.",
      subtitle:
        "TaaSFlow gives accounting leaders a workspace for every hire — audit, tax, statutory, technical accounting — with rubrics tuned to the standards and cycles the role actually owns.",
    },
    challenges: [
      {
        title: "Standards and framework fit",
        body: "IFRS, US GAAP, local statutory work — each requires distinct evidence. Our rubric captures the frameworks the candidate has actually applied, not just listed.",
      },
      {
        title: "Cycle ownership",
        body: "Month-end close, year-end audit, tax season — we capture the cycles owned end-to-end so shortlists match the operating rhythm of your team.",
      },
      {
        title: "Firm and in-house context",
        body: "Firm-side and in-house roles reward different signals. Rubrics adjust so a controller search doesn't get audit-firm-shaped CVs at the top.",
      },
    ],
    roles: [
      "Audit managers and seniors",
      "Tax managers and advisors",
      "Statutory and technical accountants",
      "Financial accountants",
      "Group and consolidation accountants",
      "Management accountants",
      "Bookkeepers and assistant accountants",
      "Accounting operations leads",
    ],
    signals: [
      "Standards and frameworks captured in intake",
      "Cycle ownership evidence from the CV",
      "Rubric per role and level",
    ],
    cta: {
      title: "Hiring for an accounting seat?",
      description:
        "Submit the role — one workspace, one rubric, one reviewed shortlist.",
    },
  },
  {
    slug: "insurance",
    eyebrow: "Insurance",
    name: "Insurance",
    meta: {
      title: "Insurance hiring — TaaSFlow",
      description:
        "Structured sourcing for carriers, brokers and MGAs. Ranked shortlists with evidence of the lines of business, product and distribution experience.",
    },
    hero: {
      title: "Insurance hiring, calibrated per line of business.",
      subtitle:
        "TaaSFlow gives insurance leaders a workspace for every hire — underwriting, claims, actuarial, distribution — with rubrics tuned to the line of business and product.",
    },
    challenges: [
      {
        title: "Line-of-business precision",
        body: "P&C, life, specialty and reinsurance each need distinct signal. Our rubric captures the lines and products actually handled instead of generic 'insurance experience'.",
      },
      {
        title: "Distribution and channel context",
        body: "Direct, broker, MGA and bancassurance change the shape of the role. We capture the channel in intake so shortlists reflect it.",
      },
      {
        title: "Technical and quantitative depth",
        body: "Underwriting authority, reserving methods and pricing exposure are captured as structured signals — not searched for in prose.",
      },
    ],
    roles: [
      "Underwriters and senior underwriters",
      "Claims managers and adjusters",
      "Actuaries and pricing analysts",
      "Product managers and portfolio leads",
      "Broking and distribution leads",
      "Risk and compliance officers",
      "Operations and transformation leads",
      "Reinsurance specialists",
    ],
    signals: [
      "Line-of-business rubric per requisition",
      "Channel and distribution captured",
      "Human review before publication",
    ],
    cta: {
      title: "Hiring in insurance?",
      description:
        "Submit the role — one workspace per requisition, ranked and reviewed.",
    },
  },
  {
    slug: "private-equity",
    eyebrow: "Private Equity",
    name: "Private Equity",
    meta: {
      title: "Private equity hiring — TaaSFlow",
      description:
        "Structured sourcing for funds and portfolio companies. Ranked shortlists with evidence of deal experience, sector focus and value-creation work.",
    },
    hero: {
      title: "PE hiring, from deal team to portfolio operators.",
      subtitle:
        "TaaSFlow gives partners and talent leads a workspace for every search — fund-side investment roles and portfolio-company leadership hires — with rubrics tuned per mandate.",
    },
    challenges: [
      {
        title: "Deal and sector evidence",
        body: "PE CVs need to show the deals actually worked on and the sector depth behind them. Our rubric extracts deal roles, cheque sizes and sector coverage — not just firm names.",
      },
      {
        title: "Fund vs portfolio context",
        body: "Investment-team hires and portfolio-company operators need different signals. We build the rubric per mandate instead of treating both as the same search.",
      },
      {
        title: "Confidentiality and discretion",
        body: "Every mandate sits in a private workspace scoped to the sponsor. Candidate context stays inside the search it was collected for.",
      },
    ],
    roles: [
      "Investment associates and VPs",
      "Investment principals and partners",
      "Portfolio operations leads",
      "Value creation and transformation leads",
      "Portfolio CFOs and finance directors",
      "Portfolio CEOs and general managers",
      "Fund operations and investor relations",
      "Sector specialists and operating advisors",
    ],
    signals: [
      "Deal and sector evidence extracted",
      "Rubric per fund or portfolio mandate",
      "Private workspace per requisition",
    ],
    cta: {
      title: "Running a PE search?",
      description:
        "Submit the mandate — one private workspace, one rubric, one reviewed shortlist.",
    },
  },
];

export function getIndustryEntry(slug: string): IndustryEntry | undefined {
  return INDUSTRY_ENTRIES.find((e) => e.slug === slug);
}
