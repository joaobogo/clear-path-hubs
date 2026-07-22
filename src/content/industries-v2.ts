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
];

export function getIndustryEntry(slug: string): IndustryEntry | undefined {
  return INDUSTRY_ENTRIES.find((e) => e.slug === slug);
}
