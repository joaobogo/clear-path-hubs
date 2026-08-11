/**
 * TaaSFlow V2 — Industry template data.
 *
 * Structured, verified copy for each industry page. All quantitative claims
 * from the legacy scrape (placement counts, cost savings %, delivery-day
 * counts) are intentionally excluded until approved. Every industry gets a
 * unique title, description, hero, challenge set, role list and CTA.
 */

export type IndustryFAQ = { q: string; a: string };
export type IndustryRoleFamily = { name: string; roles: string[]; blurb?: string };
export type IndustryResource = { title: string; kind: string; to: string; description?: string };
export type IndustryRelated = { slug: string; name: string; blurb?: string };

export type IndustryEntry = {
  slug: string;
  eyebrow: string;
  name: string;
  category?: string;
  aliases?: string[];
  summary?: string;
  meta: { title: string; description: string };
  hero: { title: string; subtitle: string };
  challenges: { title: string; body: string }[];
  solutions?: { title: string; body: string }[];
  roleFamilies?: IndustryRoleFamily[];
  roles: string[];
  candidateSignals?: { title: string; body: string }[];
  skills?: string[];
  tools?: string[];
  certifications?: string[];
  regulatedRequirements?: string[];
  signals: string[];
  relatedIndustries?: IndustryRelated[];
  resources?: IndustryResource[];
  faqs?: IndustryFAQ[];
  cta: { title: string; description: string };
};

const DEFAULT_RESOURCES: IndustryResource[] = [
  { title: "How TaaSFlow works", kind: "Product", to: "/how-it-works", description: "The full workflow, end to end." },
  { title: "Pricing", kind: "Pricing", to: "/pricing", description: "Subscription pricing without placement fees." },
  { title: "Submit a role", kind: "Get started", to: "/intake", description: "Guided intake with draft saving." },
];

export const INDUSTRY_ENTRIES: IndustryEntry[] = [
  // ============================================================
  // BATCH 1 — Technology, SaaS, Data & Analytics
  // ============================================================
  {
    slug: "tech",
    eyebrow: "Technology",
    name: "Technology",
    category: "Tech & Data",
    aliases: ["Tech", "Software", "Engineering", "IT", "Developers"],
    summary:
      "Software, cloud, security and IT-leadership hiring on one transparent workflow, with technical evidence pulled straight from the CV.",
    meta: {
      title: "Technology hiring — TaaSFlow",
      description:
        "Structured, evidence-based sourcing for software engineering, product, cloud, cybersecurity and IT leadership. Ranked shortlists with technical evidence tied to the CV.",
    },
    hero: {
      title: "Engineering, product and infrastructure hiring, on one transparent workflow.",
      subtitle:
        "One workspace for every engineering, product and IT search, with technical evidence pulled straight from the CV.",
    },
    challenges: [
      { title: "Signal is buried in the CV", body: "Great engineers describe impact in prose, not keywords. The rubric extracts architecture calls, systems owned and scale handled." },
      { title: "Stack fit vs transferable skill", body: "Stacks look similar on paper. We calibrate to the exact languages, frameworks and clouds the role needs, and flag adjacencies." },
      { title: "Volume vs precision at every level", body: "Junior funnels flood inboxes; senior searches stall. Rubrics tuned per level surface the seniority and specialisation you're hiring for." },
      { title: "Remote, hybrid and on-site trade-offs", body: "Every tech role has a location model. It becomes a first-class filter so time-zone mismatches never reach shortlist." },
    ],
    solutions: [
      { title: "Technical-evidence validation, not keyword matching", body: "Every CV is parsed for services owned, incidents led and systems scaled — each claim quoted with its source line." },
      { title: "Role rubrics per specialisation", body: "Separate rubrics for backend, frontend, platform/SRE, mobile, security, product and engineering management — scoring stays within a role." },
      { title: "Stack-aware scoring", body: "Node, Go, Python, Java, .NET, Rust, React, Next.js, AWS, GCP, Azure, Kubernetes, Postgres, Kafka, Snowflake — production use, not exposure." },
      { title: "One workspace per role", body: "Ranked shortlist, evidence side-by-side, Kanban pipeline, direct messaging and audit trail — your team owns the data." },
    ],
    roleFamilies: [
      { name: "Software engineering", blurb: "Backend, frontend, full-stack, mobile and embedded engineers across all levels.", roles: ["Backend engineers (Go, Node, Java, Python)", "Frontend engineers (React, Next.js, TypeScript)", "Full-stack engineers", "Mobile engineers (iOS, Android, React Native)", "Staff and principal engineers"] },
      { name: "Product", blurb: "Product managers, technical PMs and product operations.", roles: ["Product managers", "Technical product managers", "Group product managers", "Product operations"] },
      { name: "Infrastructure, cloud and DevOps", blurb: "Site reliability, platform, infrastructure and cloud specialists.", roles: ["Site reliability engineers", "Platform engineers", "DevOps engineers", "Cloud architects (AWS, GCP, Azure)", "Network and infrastructure engineers"] },
      { name: "Cybersecurity", blurb: "Application, cloud, product and offensive security across the stack.", roles: ["Application security engineers", "Cloud security engineers", "GRC and compliance analysts", "Detection & response engineers"] },
      { name: "IT leadership", blurb: "Enterprise IT, service delivery and technology leadership.", roles: ["IT managers and directors", "Heads of IT and service delivery", "CIOs and VP infrastructure", "Enterprise architects"] },
      { name: "Engineering leadership", blurb: "First-line managers to VPs of engineering.", roles: ["Engineering managers", "Senior engineering managers", "Directors of engineering", "VPs of engineering"] },
    ],
    roles: [
      "Full-stack engineers",
      "Backend & platform engineers",
      "Frontend engineers",
      "DevOps & site reliability",
      "Mobile engineers",
      "Security engineers",
      "Engineering managers",
      "Product managers",
      "IT & infrastructure specialists",
      "CIOs & CTOs",
    ],
    candidateSignals: [
      { title: "Systems owned end-to-end", body: "Named services with production ownership, on-call responsibility and measurable scale (RPS, data volume, users)." },
      { title: "Architecture decisions", body: "Trade-offs documented on the CV — chosen technology, rejected alternatives and the reason behind the choice." },
      { title: "Scale and reliability", body: "Concrete numbers on latency, availability, incident response and cost impact — not adjectives." },
      { title: "Stack depth vs breadth", body: "Years of production use per language, framework, cloud and database — separated from tools merely listed." },
      { title: "Delivery evidence", body: "Shipped features, migrations completed, teams led — with dates, scope and outcomes." },
      { title: "Collaboration and communication", body: "Cross-team programs, RFC authorship, mentorship footprint and public technical writing where present." },
    ],
    skills: ["TypeScript", "Python", "Go", "Java", "Rust", "SQL", "System design", "Distributed systems", "API design", "Testing and CI/CD", "Observability", "Performance"],
    tools: ["AWS", "GCP", "Azure", "Kubernetes", "Terraform", "Docker", "React", "Next.js", "Node.js", "Postgres", "Kafka", "Snowflake", "Datadog", "GitHub Actions"],
    certifications: ["AWS Solutions Architect", "AWS DevOps Engineer", "GCP Professional Cloud Architect", "Azure Solutions Architect Expert", "CKA / CKAD", "OSCP", "CISSP"],
    regulatedRequirements: [
      "SOC 2 program experience for platform/security hires",
      "PCI-DSS scope experience for payments-adjacent engineers",
      "HIPAA-aware handling for healthtech engineers",
      "GDPR-aware data handling for EU/UK-facing systems",
    ],
    signals: ["Rubric per role level", "Technical-evidence validation from the CV", "Ranked shortlist in your workspace"],
    relatedIndustries: [
      { slug: "saas", name: "SaaS", blurb: "Product, CS and RevOps for software companies." },
      { slug: "cybersecurity", name: "Cybersecurity", blurb: "Security engineers, GRC and compliance." },
      { slug: "data-analytics", name: "Data & Analytics", blurb: "Data engineering, analytics and ML." },
      { slug: "ai-ml", name: "AI & ML", blurb: "Applied AI, ML engineering and MLOps." },
      { slug: "devops", name: "DevOps & Platform", blurb: "SRE and platform engineering specialists." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "How is technical fit evaluated?", a: "A rubric is calibrated per role — backend, frontend, platform, mobile, security, product. Every score point cites a CV quote for defensible review." },
      { q: "Do you handle senior and staff-level roles?", a: "Yes. Staff, principal and engineering leadership rubrics weight architecture, scope and cross-team delivery over tooling breadth." },
      { q: "Can you match a specific stack?", a: "The exact stack is mapped in intake — languages, frameworks, cloud, data — and scored for production use. Adjacent stacks are flagged separately." },
      { q: "How do you handle remote vs hybrid vs on-site?", a: "Location model is a first-class intake field and a hard filter on the shortlist. Time-zone requirements are captured explicitly." },
      { q: "How does evidence validation work?", a: "Every CV is parsed for the role's technical claims. The exact CV line supporting each claim is quoted back for review." },
    ],
    cta: { title: "Hiring for a tech team?", description: "Submit the role in our guided intake — draft saving is on, and your workspace is ready as soon as you finish." },
  },

  {
    slug: "saas",
    eyebrow: "SaaS & Cloud",
    name: "SaaS",
    category: "Tech & Data",
    aliases: ["Software as a Service", "Recurring revenue", "PLG", "Cloud software"],
    summary:
      "Recurring-revenue hiring for product-led and enterprise SaaS teams — product, CS, RevOps, sales and implementation, calibrated to your motion and stage.",
    meta: {
      title: "SaaS hiring — TaaSFlow",
      description:
        "Ranked, evidence-backed candidates for SaaS teams: product, customer success, revenue operations, GTM, sales and implementation. Motion-aware scoring across PLG, mid-market and enterprise.",
    },
    hero: {
      title: "Talent for SaaS teams who live and breathe recurring revenue.",
      subtitle:
        "Hire people who understand recurring revenue, with evidence tied to what they actually did.",
    },
    challenges: [
      { title: "SaaS titles hide very different jobs", body: "A CSM at a self-serve tool is a different job to one at an enterprise platform. The rubric follows your motion, not the title." },
      { title: "Metrics fluency matters", body: "We evaluate evidence of working with ARR, NRR, activation, expansion and payback — instead of accepting CV words at face value." },
      { title: "GTM specialisation is fragmenting", body: "RevOps, sales engineering, lifecycle and partnerships are now distinct crafts. Role-specific rubrics stop the wrong specialist reaching shortlist." },
      { title: "Stage-fit is under-priced", body: "Seed, Series B and post-IPO operators optimise for different problems. Stage and headcount are captured in intake as first-class filters." },
    ],
    solutions: [
      { title: "Motion-aware scoring", body: "PLG, mid-market and enterprise rubrics grade candidates on the mechanics that apply — activation loops, sales-assist or enterprise deal architecture." },
      { title: "Metric evidence from the CV", body: "We surface ARR moved, NRR expanded, activation lifted or payback shortened — with the exact CV line for review." },
      { title: "Cross-functional coverage", body: "Product, CS, RevOps, sales, sales engineering, implementation and lifecycle — one workspace, one rubric family, one delivery team." },
      { title: "Ready-to-hire packaging", body: "Every profile arrives with role fit, motion fit, metrics evidence and reference-check prompts pre-drafted." },
    ],
    roleFamilies: [
      { name: "Product", blurb: "PMs and product operators who understand SaaS metrics.", roles: ["Product managers", "Senior and group PMs", "Product-led growth PMs", "Product operations"] },
      { name: "Customer success", blurb: "CS and onboarding for self-serve, mid-market and enterprise motions.", roles: ["CSMs (self-serve, mid-market, enterprise)", "Customer success leaders", "Onboarding and implementation specialists", "Renewal and expansion managers"] },
      { name: "Revenue operations", blurb: "The pipes and process behind ARR.", roles: ["RevOps analysts and managers", "Systems admins (Salesforce, HubSpot)", "Deal desk", "Compensation and territory analysts"] },
      { name: "SaaS sales", blurb: "AEs, BDRs, SEs across every motion.", roles: ["Account executives (SMB, mid-market, enterprise)", "SDRs and BDRs", "Sales engineers and solutions architects", "Partnerships and channel managers"] },
      { name: "Implementation & services", blurb: "Getting customers live and value-realising.", roles: ["Implementation consultants", "Professional services engineers", "Technical account managers", "Solutions architects"] },
      { name: "Growth & lifecycle marketing", blurb: "Product-led growth and lifecycle across the funnel.", roles: ["Growth marketers", "Lifecycle & CRM managers", "Product marketing managers"] },
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
      "Account executives",
    ],
    candidateSignals: [
      { title: "Motion fit", body: "Named products, ACVs and buying committees so we can validate PLG, mid-market or enterprise experience." },
      { title: "ARR & NRR movement", body: "Book of business owned with revenue moved, expansion won and churn reduced — with the CV line to prove it." },
      { title: "Systems footprint", body: "Salesforce, HubSpot, Gainsight, Outreach, Amplitude, Mixpanel — years of hands-on use, not just tool lists." },
      { title: "Cross-functional influence", body: "PMs shipping with growth, CS partnering with product, RevOps changing comp plans that stuck." },
      { title: "Stage-appropriate scope", body: "Pre-PMF vs post-PMF vs scale — surfaced explicitly." },
      { title: "Renewal & expansion evidence", body: "Retention rates, expansion multiples and net revenue outcomes." },
    ],
    skills: ["ARR forecasting", "Activation design", "Cohort analysis", "Pricing & packaging", "Enterprise deal architecture", "Customer health scoring", "Playbook design", "Product-led growth"],
    tools: ["Salesforce", "HubSpot", "Gainsight", "Outreach", "Salesloft", "Amplitude", "Mixpanel", "Pendo", "Segment", "Snowflake", "Looker", "Clari"],
    certifications: ["Pragmatic Institute (PMC)", "Reforge programs", "Gainsight Admin", "Salesforce Administrator"],
    signals: ["Motion-specific rubric (PLG, mid-market, enterprise)", "Metrics evidence from the CV", "Stage & headcount captured as filters"],
    relatedIndustries: [
      { slug: "tech", name: "Technology", blurb: "Engineering, platform and product for software companies." },
      { slug: "data-analytics", name: "Data & Analytics", blurb: "Analytics engineering and product analytics." },
      { slug: "sales", name: "Sales", blurb: "AE, AM, SDR and sales leadership hiring." },
      { slug: "customer-success", name: "Customer Success", blurb: "Post-sale ownership, retention and expansion." },
      { slug: "product-management", name: "Product Management", blurb: "PMs for SaaS and cloud products." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you handle PLG and enterprise motions the same way?", a: "No — separate rubrics. PLG hires are graded on activation and lifecycle experiments; enterprise hires on procurement cycles, buying committees and ACV." },
      { q: "How do you validate CS candidates when metrics vary widely?", a: "We anchor the rubric on your definitions — NRR, GRR, expansion, health — and score comparable ownership at prior companies, with CV evidence for each." },
      { q: "Can you hire for a pre-PMF startup?", a: "Yes. Stage is captured in intake and rubrics tilt toward zero-to-one evidence — closing without scripts, building playbooks and shipping without a full stack." },
      { q: "Do you support US, UK and EU SaaS hiring?", a: "Yes. Time-zone and jurisdiction are captured in intake and applied as filters before shortlist review." },
      { q: "What tools do you assume familiarity with?", a: "The rubric maps to your actual stack — Salesforce, HubSpot, Gainsight, Amplitude and so on — and rewards years of production use over surface exposure." },
    ],
    cta: { title: "Growing a SaaS team?", description: "Submit the role and we'll return a ranked, evidence-backed shortlist in your workspace." },
  },

  {
    slug: "data-analytics",
    eyebrow: "Data & Analytics",
    name: "Data & Analytics",
    category: "Tech & Data",
    aliases: ["Data", "Analytics", "BI", "Business Intelligence", "Data Science", "Machine Learning", "ML", "Data Governance"],
    summary:
      "Data engineering, analytics, BI, machine learning, governance and visualisation — sourced with stack-aware rubrics and business-outcome evidence.",
    meta: {
      title: "Data & analytics hiring — TaaSFlow",
      description:
        "Data engineers, analytics engineers, analysts, BI developers, data scientists, ML engineers and governance leads — sourced with rubric-based scoring and evidence from the CV.",
    },
    hero: {
      title: "Data hires you can actually evaluate before the interview.",
      subtitle:
        "A rubric per data role, with evidence of the modelling, tooling and outcomes each candidate delivered.",
    },
    challenges: [
      { title: "The data stack keeps changing", body: "Warehouses, orchestration, BI and ML tools shift constantly. The rubric rebuilds per search to reflect your actual stack." },
      { title: "Analyst, engineer, or scientist?", body: "Titles blur between analytics engineering, data science and BI. We calibrate to the outcomes you need so the right specialist reaches shortlist." },
      { title: "Business fluency is the differentiator", body: "The best data hires move a business metric, not just a dashboard. We evaluate decisions influenced — not model-choice trivia." },
      { title: "Governance is a first-class hire now", body: "Privacy, data contracts and lineage matter. Governance and platform hires get their own rubric, not a footnote to engineering." },
    ],
    solutions: [
      { title: "Stack-mapped rubrics", body: "The rubric maps to your warehouse, orchestrator, transformation layer, BI tool and ML platform — scoring reflects the actual environment." },
      { title: "Business-outcome evidence", body: "We extract decisions influenced, metrics moved and revenue or cost impact from the CV, with the source line quoted for review." },
      { title: "Role-specific scoring", body: "Analytics engineers on dbt discipline; scientists on experimental rigour; ML engineers on production ownership; BI developers on stakeholder outcomes." },
      { title: "Governance and platform coverage", body: "Governance, catalog, privacy and platform hires get a distinct rubric focused on contracts, lineage and access history." },
    ],
    roleFamilies: [
      { name: "Data engineering", blurb: "Batch, streaming and warehouse-native pipeline builders.", roles: ["Data engineers", "Senior and staff data engineers", "Streaming engineers", "Platform engineers"] },
      { name: "Analytics engineering", blurb: "dbt-native modellers between engineering and analytics.", roles: ["Analytics engineers", "Lead analytics engineers", "Data modellers"] },
      { name: "Analytics & BI", blurb: "Analysts, BI developers and product analysts moving decisions.", roles: ["Data analysts", "Product analysts", "BI developers", "Analytics managers"] },
      { name: "Data science & ML", blurb: "Applied science, experimentation and ML engineering.", roles: ["Data scientists", "Applied scientists", "Machine learning engineers", "MLOps engineers"] },
      { name: "Data governance & platform", blurb: "Catalog, contracts, lineage, privacy and platform.", roles: ["Data governance leads", "Data platform managers", "Data privacy specialists", "Metadata & catalog owners"] },
      { name: "Visualisation & storytelling", blurb: "BI leaders who make data legible for the business.", roles: ["BI leads", "Visualisation specialists", "Executive analytics partners"] },
    ],
    roles: [
      "Data engineers",
      "Analytics engineers",
      "Data analysts",
      "BI developers",
      "Data scientists",
      "ML engineers",
      "MLOps engineers",
      "Data governance leads",
      "Analytics leaders",
    ],
    candidateSignals: [
      { title: "Warehouse ownership", body: "Snowflake, BigQuery, Redshift or Databricks ownership with scale — TB moved, models governed, cost owned." },
      { title: "Modelling discipline", body: "dbt project ownership, tests written, contracts enforced, refactors led." },
      { title: "Experiment design", body: "A/B design, power calculations, causal inference and readouts that changed roadmap." },
      { title: "Production ML", body: "Deployed models with monitoring, drift alerting and retraining owned." },
      { title: "Governance footprint", body: "Data contracts, PII handling, catalog rollouts and access-control migrations." },
      { title: "Business impact", body: "Revenue moved, cost cut or process automated — with the CV line to prove it." },
    ],
    skills: ["SQL", "Python", "dbt", "Airflow", "Spark", "Statistics", "Causal inference", "Experimentation", "Data modelling", "Kimball & data vault", "Streaming (Kafka, Kinesis)", "MLOps"],
    tools: ["Snowflake", "BigQuery", "Databricks", "Redshift", "dbt", "Airflow", "Prefect", "Fivetran", "Segment", "Looker", "Tableau", "Power BI", "Metabase", "MLflow", "Vertex AI", "SageMaker"],
    certifications: ["Snowflake SnowPro", "Databricks Certified Data Engineer", "GCP Professional Data Engineer", "AWS Data Analytics Specialty", "Azure Data Engineer Associate"],
    regulatedRequirements: [
      "GDPR-aware data handling for EU/UK datasets",
      "HIPAA-aware handling for health data",
      "SOX-aware controls for financial reporting pipelines",
      "PCI-DSS scope for payments data",
    ],
    signals: ["Stack-specific rubric", "Business-outcome evidence", "Ranked shortlist in your workspace"],
    relatedIndustries: [
      { slug: "tech", name: "Technology", blurb: "Engineering and platform teams." },
      { slug: "saas", name: "SaaS", blurb: "Product analytics for recurring-revenue businesses." },
      { slug: "finance", name: "Finance", blurb: "Analytics leaders for FP&A and finance data." },
      { slug: "ai-ml", name: "AI & ML", blurb: "Applied ML and MLOps hiring." },
      { slug: "fintech", name: "Fintech", blurb: "Data platforms for payments and financial products." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you separate analytics engineers from data engineers?", a: "Yes. Analytics engineering weights dbt discipline and stakeholder outcomes; data engineering weights pipeline reliability, scale and platform ownership." },
      { q: "How do you score data scientists when CVs look alike?", a: "We look for evidence of experiment design, causal reasoning and decisions influenced — not model-name trivia. Every point cites a CV line." },
      { q: "Can you hire for a specific warehouse or BI tool?", a: "Yes. Warehouse and BI tool are intake fields and mapped into the rubric. Production years matter more than certificates." },
      { q: "How do you handle privacy-sensitive data domains?", a: "Governance and privacy exposure — GDPR, HIPAA, PCI-DSS — is captured as a structured signal and reviewed by a human before shortlist." },
      { q: "Do you cover data governance separately?", a: "Yes. Governance, catalog, contracts and platform roles have their own rubric family, distinct from engineering and analytics." },
    ],
    cta: { title: "Building a data team?", description: "Submit the role and we'll return a ranked, evidence-backed shortlist calibrated to your stack." },
  },

  // ============================================================
  // Cybersecurity
  // ============================================================
  {
    slug: "cybersecurity",
    eyebrow: "Cybersecurity",
    name: "Cybersecurity",
    category: "Tech & Data",
    aliases: ["Security", "InfoSec", "AppSec", "CloudSec", "GRC"],
    summary:
      "Offensive, defensive, cloud, application and GRC security hiring — with domain-specific rubrics, structured evidence and a private, auditable workspace.",
    meta: {
      title: "Cybersecurity hiring — TaaSFlow",
      description:
        "Security engineers, GRC leads, SOC analysts, cloud and application security specialists — sourced with per-domain rubrics, CV-quoted evidence and tenant-isolated delivery.",
    },
    hero: {
      title: "Security hiring that actually verifies the security part.",
      subtitle:
        "Rubrics per security domain, with evidence captured from the CV before the shortlist reaches you.",
    },
    challenges: [
      { title: "Certifications aren't the same as capability", body: "Certifications are a floor, not a ceiling. Scoring runs on incidents handled, controls implemented and tooling owned — not certificates alone." },
      { title: "Security is highly specialised", body: "AppSec, cloud security, detection engineering and GRC are different disciplines. Per-role rubrics stop generalists reaching a specialist shortlist." },
      { title: "Trust and discretion matter", body: "Security hiring deserves tight access controls. TaaSFlow runs row-level tenant isolation and short-lived signed URLs for every CV." },
      { title: "Signal from noise in the SOC funnel", body: "SOC hiring drowns in overlapping CVs. The rubric weights tuning, false-positive reduction and incident narrative — not tool bingo." },
    ],
    solutions: [
      { title: "Per-domain rubrics", body: "Separate rubrics for AppSec, cloud security, detection engineering, offensive security, GRC and security leadership — never cross-scored." },
      { title: "Evidence over acronyms", body: "The rubric quotes the CV line for each score point — incidents led, controls deployed, vulnerabilities validated, regulator interactions owned." },
      { title: "Cloud-stack awareness", body: "AWS, GCP, Azure security posture experience is mapped to the exact platform and services the seat will own." },
      { title: "Private, audit-ready delivery", body: "Every mandate lives in a workspace with row-level isolation, audit trail and access-scoped file storage." },
    ],
    roleFamilies: [
      { name: "Application security", blurb: "Product, SDLC and code-facing security engineers.", roles: ["Application security engineers", "Product security engineers", "AppSec architects", "Secure code reviewers"] },
      { name: "Cloud & infrastructure security", blurb: "Cloud posture, identity and workload defence.", roles: ["Cloud security engineers", "IAM specialists", "Kubernetes security engineers", "Cloud security architects"] },
      { name: "Detection & response", blurb: "SOC, threat detection and incident response.", roles: ["SOC analysts (L1–L3)", "Detection engineers", "Incident responders", "Threat hunters"] },
      { name: "Offensive security", blurb: "Red team, penetration testing and adversary emulation.", roles: ["Penetration testers", "Red team operators", "Purple team engineers", "Vulnerability researchers"] },
      { name: "GRC & compliance", blurb: "Governance, risk, controls and audit.", roles: ["GRC analysts and leads", "Compliance managers (SOC 2, ISO 27001)", "Third-party risk managers", "Privacy engineers"] },
      { name: "Security leadership", blurb: "Heads of security, BISOs and CISOs.", roles: ["Security engineering managers", "Heads of security", "BISOs", "CISOs and deputy CISOs"] },
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
    candidateSignals: [
      { title: "Incident ownership", body: "Incidents led end-to-end with scope, blast radius, response actions and lessons learned — quoted from the CV." },
      { title: "Controls implemented", body: "Named controls deployed — MFA, EDR tuning, SIEM detections, IAM baselines — with scale and outcome." },
      { title: "Cloud posture experience", body: "AWS, GCP, Azure posture programmes owned — services, findings closed and time-to-remediate." },
      { title: "Offensive evidence", body: "CVEs disclosed, engagements delivered, findings quantified and publications where present." },
      { title: "Framework fluency", body: "SOC 2, ISO 27001, NIST CSF, PCI-DSS, HIPAA programmes led — not just referenced." },
      { title: "Leadership footprint", body: "Team size grown, budget owned, board-level reporting delivered and cross-functional programmes led." },
    ],
    skills: ["Threat modelling", "Detection engineering", "IAM design", "Cryptography basics", "Cloud security architecture", "Vulnerability management", "Secure code review", "Incident response"],
    tools: ["Splunk", "Elastic", "Chronicle", "CrowdStrike", "SentinelOne", "Wiz", "Prisma Cloud", "AWS GuardDuty", "Snyk", "Semgrep", "Burp Suite", "Metasploit", "Okta", "HashiCorp Vault"],
    certifications: ["OSCP", "OSEP", "CISSP", "CCSP", "GCIH", "GPEN", "AWS Security Specialty", "ISO 27001 Lead Implementer", "SOC 2 auditor"],
    regulatedRequirements: [
      "SOC 2 programme experience",
      "ISO 27001 implementation ownership",
      "PCI-DSS scope experience for payments teams",
      "HIPAA-aware handling for health-related products",
      "GDPR / UK-GDPR privacy exposure",
    ],
    signals: ["Domain-specific rubric", "Evidence quotes from the CV", "Private, tenant-isolated workspace"],
    relatedIndustries: [
      { slug: "tech", name: "Technology", blurb: "Engineering and platform teams that build the systems security defends." },
      { slug: "devops", name: "DevOps & Platform", blurb: "SRE and platform engineers who own posture together." },
      { slug: "fintech", name: "Fintech", blurb: "Regulated financial products with high security stakes." },
      { slug: "healthtech", name: "Healthtech", blurb: "PHI-handling products with HIPAA obligations." },
      { slug: "defense", name: "Defense", blurb: "Clearance-heavy security and mission systems." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "How do you evaluate SOC candidates?", a: "By evidence of detection tuning, incident narrative and false-positive reduction — not tool lists. Every score point cites a CV quote." },
      { q: "Can you find security leaders (CISO, BISO)?", a: "Yes. Leadership rubrics weight programme scope, board reporting, budget owned and cross-functional influence over tooling breadth." },
      { q: "Do you cover GRC separately from engineering?", a: "Yes. GRC has its own rubric focused on SOC 2, ISO 27001, third-party risk and privacy — never mixed with engineering scoring." },
      { q: "How is candidate data protected?", a: "Row-level tenant isolation, short-lived signed URLs for CV files and an audit trail on every access." },
      { q: "Do you support cleared or regulated searches?", a: "Yes. Clearance level, jurisdiction and regulatory obligations are structured intake fields and applied as hard filters before shortlist." },
    ],
    cta: { title: "Hiring a security specialist?", description: "Submit the role and receive a discreetly reviewed, evidence-backed shortlist in a private workspace." },
  },



  // ============================================================
  // BATCH 2 — Finance, Accounting, Insurance
  // ============================================================
  {
    slug: "finance",
    eyebrow: "Finance",
    name: "Finance",
    category: "Financial Services",
    aliases: ["Banking", "Corporate Finance", "FP&A", "Investment", "Risk", "Compliance", "Treasury"],
    summary:
      "Banking, corporate finance, FP&A, investment, risk and compliance hiring — with regulated-environment evidence and function-specific rubrics.",
    meta: {
      title: "Finance hiring — TaaSFlow",
      description:
        "Structured sourcing for banking, corporate finance, FP&A, investment, risk and compliance teams. Ranked shortlists with regulated-environment evidence from the CV.",
    },
    hero: {
      title: "Finance hiring with rubrics tuned per function and regulatory context.",
      subtitle:
        "A workspace for every finance hire, with rubrics per function and evidence of the regulatory environments worked in.",
    },
    challenges: [
      { title: "Function-specific signal", body: "Banking, FP&A, treasury, investment, risk and compliance each need a different rubric. We build one per requisition." },
      { title: "Regulated-environment evidence", body: "Basel, MiFID II, Dodd-Frank, IFRS 9, CECL shape the seat. Regulatory exposure is a structured signal, not a keyword search." },
      { title: "Systems and reporting stack", body: "ERP, consolidation, treasury and risk platforms are captured in intake so shortlists reflect the actual operating environment." },
      { title: "Level calibration", body: "Senior finance roles need judgement evidence, not tool lists. Rubrics per level surface decision scope and ownership described on the CV." },
    ],
    solutions: [
      { title: "Function-mapped rubrics", body: "Distinct rubrics for banking, corporate finance, FP&A, investment, treasury, risk and compliance — no cross-scoring." },
      { title: "Regulated-environment scoring", body: "Basel III, MiFID II, Dodd-Frank, EMIR, IFRS 9, SOX and CECL exposure graded as first-class signals with CV lines quoted." },
      { title: "Systems-aware shortlists", body: "Oracle EPM, SAP, Anaplan, Adaptive, HFM, Kyriba, Bloomberg and Aladdin coverage mapped to the seat." },
      { title: "Discreet, workspace-scoped delivery", body: "Every mandate sits in a private workspace with row-level isolation and audit trails." },
    ],
    roleFamilies: [
      { name: "Banking", blurb: "Investment banking, corporate banking and coverage.", roles: ["Investment banking analysts and associates", "Corporate banking relationship managers", "Coverage bankers", "Capital markets"] },
      { name: "Corporate finance & FP&A", blurb: "In-house finance leadership and planning.", roles: ["CFOs and finance directors", "FP&A leads and managers", "Business partners", "Corporate development"] },
      { name: "Investment roles", blurb: "Buy-side and asset management.", roles: ["Portfolio managers", "Investment analysts", "Research analysts", "Traders"] },
      { name: "Treasury", blurb: "Cash, liquidity and funding.", roles: ["Group treasurers", "Cash and liquidity managers", "FX & funding specialists"] },
      { name: "Risk", blurb: "Market, credit and operational risk.", roles: ["Market risk managers", "Credit risk officers", "Operational risk leads", "Model risk / validation"] },
      { name: "Compliance & regulatory", blurb: "Compliance officers and regulatory reporting.", roles: ["Compliance officers", "MLROs and financial-crime leads", "Regulatory reporting managers", "Surveillance and controls"] },
    ],
    roles: [
      "CFOs and finance directors",
      "Investment bankers",
      "FP&A leads and analysts",
      "Corporate development and M&A",
      "Treasury and cash management",
      "Risk officers and analysts",
      "Compliance officers",
      "Portfolio managers",
      "Investor relations",
    ],
    candidateSignals: [
      { title: "Regulatory exposure", body: "Basel III/IV, MiFID II, EMIR, Dodd-Frank, SOX, IFRS 9 — with the CV line to prove ownership." },
      { title: "Deal or portfolio experience", body: "Deal size, portfolio value, coverage universe, market exposure — quantified where the CV allows." },
      { title: "Systems footprint", body: "Bloomberg, Aladdin, Murex, Kyriba, Oracle EPM, SAP, Anaplan — years of production use." },
      { title: "Model & control ownership", body: "Models built, controls implemented, regulator interactions led." },
      { title: "Level of judgement", body: "Committee membership, mandates approved, budgets set." },
    ],
    skills: ["Financial modelling", "Valuation", "Credit analysis", "Portfolio construction", "Market risk", "Liquidity management", "Regulatory reporting", "SOX controls", "Consolidation"],
    tools: ["Bloomberg", "Aladdin", "Murex", "Kyriba", "Oracle EPM", "SAP", "Anaplan", "Adaptive Planning", "Workday Adaptive", "HFM", "Tableau", "Power BI"],
    certifications: ["CFA", "FRM", "ACA / ACCA / CIMA", "CPA", "PRM", "CAIA"],
    regulatedRequirements: [
      "Basel III/IV exposure for banking risk hires",
      "MiFID II / EMIR exposure for markets roles",
      "SOX controls exposure for reporting hires",
      "SMCR (UK) / FINRA (US) history where relevant",
    ],
    signals: ["Rubric per finance function and level", "Regulatory exposure captured", "Systems and reporting stack captured"],
    relatedIndustries: [
      { slug: "accounting", name: "Accounting", blurb: "Audit, tax, controllership and reporting hiring." },
      { slug: "insurance", name: "Insurance", blurb: "Underwriting, actuarial, claims and broking." },
      { slug: "private-equity", name: "Private Equity", blurb: "Fund and portfolio hiring." },
      { slug: "investment-banking", name: "Investment Banking", blurb: "M&A, capital markets and coverage bankers." },
      { slug: "fintech", name: "Fintech", blurb: "Regulated financial products and platforms." },
    ],
    resources: DEFAULT_RESOURCES,

    faqs: [
      { q: "Do you cover both buy-side and sell-side?", a: "Yes. Buy-side portfolio and research hires get a distinct rubric focused on mandate style, benchmark and coverage universe; sell-side hires are scored on deal experience and coverage." },
      { q: "How do you handle regulated hires?", a: "Regulatory exposure — SMCR, FINRA, MiFID II, SOX — is captured as a structured signal with the CV line quoted back. We surface what the CV states so your team can verify through the appropriate channel." },
      { q: "Do you support US, UK and EU finance hiring?", a: "Yes. Jurisdiction and regulator are captured in intake and applied as filters before shortlist review." },
      { q: "Can you help hire a first CFO?", a: "Yes. First-CFO briefs weight scaleup evidence, board readiness and functional breadth — the rubric is calibrated accordingly." },
      { q: "What about certifications like CFA and CPA?", a: "Certifications are captured and scored where the role requires them, but they never substitute for evidence of ownership on the CV." },
    ],
    cta: { title: "Building the finance team?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  {
    slug: "accounting",
    eyebrow: "Accounting",
    name: "Accounting",
    category: "Financial Services",
    aliases: ["Audit", "Tax", "Controllership", "Reporting", "Bookkeeping", "CPA", "ACA", "ACCA"],
    summary:
      "Audit, tax, controllership, reporting and bookkeeping leadership hiring — with standards-fit evidence and professional qualification signals.",
    meta: {
      title: "Accounting hiring — TaaSFlow",
      description:
        "Structured sourcing for accounting firms and in-house accounting teams: audit, tax, controllership, reporting and bookkeeping leadership. Ranked shortlists with standards and cycle evidence.",
    },
    hero: {
      title: "Accounting hiring, calibrated per standard, cycle and qualification.",
      subtitle:
        "Audit, tax and controllership hires, scored on the standards, cycles and qualifications the role really needs.",
    },
    challenges: [
      { title: "Standards and framework fit", body: "IFRS, US GAAP, local statutory work and public-company reporting each require distinct evidence. The rubric captures the frameworks actually applied, not just listed." },
      { title: "Cycle ownership", body: "Month-end close, hard close, year-end audit, tax season — we capture the cycles the candidate has genuinely owned end-to-end." },
      { title: "Firm vs in-house context", body: "Firm-side and in-house roles reward different signals. Rubrics adjust so a controller search doesn't get audit-firm-shaped CVs at the top." },
      { title: "Qualifications matter, but not alone", body: "CPA, ACA, ACCA and CIMA are captured as qualifications signals — they are checked but do not substitute for evidence of ownership." },
    ],
    solutions: [
      { title: "Standards-aware scoring", body: "IFRS, US GAAP, FRS 102, tax code exposure and public-company reporting are graded as structured signals with CV evidence." },
      { title: "Cycle-ownership evidence", body: "Close cycles owned, audits led, tax seasons run, statutory sets filed — quantified where the CV allows." },
      { title: "Qualification calibration", body: "Qualified, part-qualified and qualified-by-experience routes are scored separately so shortlists match the mandate." },
      { title: "Firm and in-house rubrics", body: "Distinct rubrics for audit-firm work, in-house controllership and tax practices." },
    ],
    roleFamilies: [
      { name: "Audit", blurb: "External audit at Big 4, mid-tier and boutique firms.", roles: ["Audit managers and senior managers", "Audit seniors", "Audit partners", "Audit directors"] },
      { name: "Tax", blurb: "Corporate, indirect, personal and international tax.", roles: ["Corporate tax managers", "Indirect tax specialists (VAT/GST)", "Tax advisors", "Tax partners"] },
      { name: "Controllership", blurb: "Group and entity controllers.", roles: ["Financial controllers", "Group controllers", "Assistant controllers", "Divisional controllers"] },
      { name: "Reporting & technical accounting", blurb: "IFRS/US GAAP technical accountants and reporting managers.", roles: ["Technical accountants", "Group reporting managers", "Consolidation specialists", "Statutory reporting managers"] },
      { name: "Bookkeeping leadership", blurb: "Bookkeeping team leads and finance operations.", roles: ["Bookkeeping managers", "Accounts payable/receivable leaders", "Finance operations leads"] },
      { name: "Professional qualifications", blurb: "Trainees, part-qualified and newly qualified professionals.", roles: ["ACA / ACCA / CIMA trainees", "Part-qualified accountants", "Newly qualified accountants"] },
    ],
    roles: [
      "Audit managers and seniors",
      "Tax managers and advisors",
      "Statutory and technical accountants",
      "Financial controllers",
      "Group and consolidation accountants",
      "Management accountants",
      "Bookkeeping leaders",
      "Accounting operations leads",
    ],
    candidateSignals: [
      { title: "Standards applied", body: "IFRS, US GAAP or local GAAP genuinely applied on named engagements or entities." },
      { title: "Audit engagement scope", body: "Client size, complexity and industries covered — with role on the engagement." },
      { title: "Tax specialism", body: "Advisory vs compliance, transactions, international and specific jurisdictions." },
      { title: "Close cycle ownership", body: "Days to close, hard vs soft, entities consolidated." },
      { title: "Systems & ERP", body: "SAP, Oracle, NetSuite, Xero, QuickBooks — production years." },
      { title: "Qualification & progression", body: "Route to qualification, exam progress, PE hours." },
    ],
    skills: ["IFRS", "US GAAP", "Statutory reporting", "Audit planning", "Corporate tax", "Indirect tax", "Consolidation", "Close management", "Controls & SOX", "Working capital"],
    tools: ["SAP", "Oracle Financials", "NetSuite", "Xero", "QuickBooks", "Sage", "Workday", "OneStream", "BlackLine", "Alteryx"],
    certifications: ["CPA", "ACA (ICAEW)", "ACCA", "CIMA", "CTA (Chartered Tax Adviser)", "CFE"],
    regulatedRequirements: [
      "SOX controls exposure for US-listed reporting hires",
      "Public-company audit experience for PCAOB registrants",
      "IFRS conversion history for cross-border reporting",
    ],
    signals: ["Standards and frameworks captured in intake", "Cycle ownership evidence from the CV", "Qualification calibrated per role"],
    relatedIndustries: [
      { slug: "finance", name: "Finance", blurb: "FP&A, corporate finance and treasury." },
      { slug: "consulting", name: "Consulting", blurb: "Advisory practices and transformation." },
      { slug: "insurance", name: "Insurance", blurb: "Insurance-sector reporting and controllership." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you hire across Big 4 and mid-tier firms?", a: "Yes. Firm size, portfolio complexity and progression pace are captured in intake and used to calibrate the rubric." },
      { q: "Are qualifications weighted heavily?", a: "Weighted proportionally to the mandate — a technical accounting seat weights qualification; a bookkeeping-leader seat weights ownership evidence." },
      { q: "Can you hire for a first controller?", a: "Yes. First-controller briefs weight ERP implementation history, close process design and evidence of building a function from scratch." },
      { q: "Do you support IFRS conversion or SOX programmes?", a: "Yes. Programme-specific exposure — IFRS conversions, SOX rollouts, ERP migrations — is captured as a structured signal." },
      { q: "How do you handle qualified-by-experience candidates?", a: "QBE candidates are scored on evidence — years of ownership on the specific cycles the role needs — separately from qualification routes." },
    ],
    cta: { title: "Hiring for an accounting seat?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "insurance",
    eyebrow: "Insurance",
    name: "Insurance",
    category: "Financial Services",
    aliases: ["Underwriting", "Claims", "Actuarial", "Broking", "P&C", "Life", "Reinsurance"],
    summary:
      "Underwriting, claims, actuarial, broking, compliance and insurance operations — with line-of-business precision and regulated-environment evidence.",
    meta: {
      title: "Insurance hiring — TaaSFlow",
      description:
        "Structured sourcing for carriers, brokers, MGAs and reinsurers: underwriting, claims, actuarial, broking, compliance and operations. Ranked shortlists with line-of-business evidence.",
    },
    hero: {
      title: "Insurance hiring, calibrated per line, channel and regulator.",
      subtitle:
        "Underwriting, claims, actuarial and broking hires, scored on line of business, channel and regulator.",
    },
    challenges: [
      { title: "Line-of-business precision", body: "P&C, life, specialty and reinsurance each need distinct signal. Our rubric captures the lines and products actually handled instead of generic 'insurance experience'." },
      { title: "Distribution and channel context", body: "Direct, broker, MGA and bancassurance change the shape of the role. Channel is captured in intake so shortlists reflect it." },
      { title: "Technical and quantitative depth", body: "Underwriting authority, reserving methods and pricing exposure are captured as structured signals — not searched for in prose." },
      { title: "Regulated-environment operations", body: "Solvency II, IFRS 17, NAIC, FCA — regulatory exposure and reporting cycles are captured as first-class evidence." },
    ],
    solutions: [
      { title: "Line-of-business rubrics", body: "P&C, life, specialty and reinsurance graded separately with line-specific evidence." },
      { title: "Channel-aware scoring", body: "Direct, broker, MGA, bancassurance and digital channels get distinct rubrics." },
      { title: "Actuarial and quantitative signal", body: "Reserving methods, pricing models, capital and reinsurance structures evidenced from the CV." },
      { title: "Regulator-aware evidence", body: "Solvency II, IFRS 17, ORSA, NAIC and FCA exposure captured as structured signals." },
    ],
    roleFamilies: [
      { name: "Underwriting", blurb: "Personal, commercial, specialty and reinsurance underwriting.", roles: ["Underwriters", "Senior underwriters", "Underwriting managers", "Portfolio underwriters"] },
      { name: "Claims", blurb: "Claims handling, examining and complex-loss management.", roles: ["Claims handlers", "Claims examiners", "Claims managers", "Complex loss adjusters"] },
      { name: "Actuarial", blurb: "Pricing, reserving, capital and modelling.", roles: ["Pricing actuaries", "Reserving actuaries", "Capital modellers", "Chief actuaries"] },
      { name: "Broking & distribution", blurb: "Retail, commercial and reinsurance broking.", roles: ["Commercial brokers", "Wholesale brokers", "Reinsurance brokers", "Account executives"] },
      { name: "Compliance & risk", blurb: "Regulatory compliance and enterprise risk.", roles: ["Compliance officers", "Risk officers", "Financial-crime leads", "Regulatory reporting managers"] },
      { name: "Insurance operations", blurb: "Policy admin, claims ops and transformation.", roles: ["Operations managers", "Policy administration leads", "Transformation leads", "Customer operations leaders"] },
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
    candidateSignals: [
      { title: "Line and product ownership", body: "Products underwritten, portfolios owned, GWP handled." },
      { title: "Authority and delegated limits", body: "Underwriting authority, referral thresholds and binder scope." },
      { title: "Actuarial method depth", body: "Reserving methods (chain-ladder, BF, Cape Cod), pricing models and capital work." },
      { title: "Channel & distribution", body: "Direct vs broker vs MGA vs bancassurance — clearly evidenced." },
      { title: "Regulatory ownership", body: "Solvency II, IFRS 17, ORSA, NAIC filings owned or contributed to." },
    ],
    skills: ["Underwriting", "Reserving", "Pricing", "Reinsurance", "Claims adjudication", "Risk modelling", "Capital modelling", "Regulatory reporting", "Policy administration"],
    tools: ["Guidewire", "Duck Creek", "Sapiens", "SAS", "R", "Python", "Emblem / Radar", "Igloo", "Prophet", "MoSes"],
    certifications: ["ACAS / FCAS", "FIA / FFA", "IFoA fellowship", "CII (ACII / FCII)", "CPCU", "AICPCU"],
    regulatedRequirements: [
      "Solvency II exposure for EU/UK carriers",
      "IFRS 17 implementation history",
      "NAIC / state licensing awareness (US)",
      "FCA / SMCR history (UK)",
    ],
    signals: ["Line-of-business rubric per requisition", "Channel and distribution captured", "Regulator exposure evidenced"],
    relatedIndustries: [
      { slug: "finance", name: "Finance", blurb: "Risk, compliance and treasury hires." },
      { slug: "accounting", name: "Accounting", blurb: "IFRS 17 reporting and controllership." },
      { slug: "healthcare", name: "Healthcare", blurb: "Health insurance and payer operations." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover carriers, brokers and MGAs?", a: "Yes, with distinct rubrics for each. Channel is captured in intake and drives the scoring model." },
      { q: "How do you evaluate actuarial candidates?", a: "By method exposure (chain-ladder, BF, Cape Cod), model ownership (pricing, reserving, capital) and specific tools used — all evidenced from the CV." },
      { q: "Do you support Solvency II and IFRS 17 programmes?", a: "Yes. Programme exposure is captured as a first-class signal alongside role fit." },
      { q: "Can you hire across specialty and reinsurance?", a: "Yes. Specialty and reinsurance searches use dedicated rubrics reflecting the distinct product knowledge and market conventions." },
      { q: "How do you handle multi-jurisdictional regulatory context?", a: "Regulator and jurisdiction are captured in intake and used as filters — Solvency II (EU/UK), NAIC (US), APRA (AU) and others." },
    ],
    cta: { title: "Hiring in insurance?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  // ============================================================
  // Private equity (kept as-is)
  // ============================================================
  {
    slug: "private-equity",
    eyebrow: "Private Equity",
    name: "Private Equity",
    category: "Financial Services",
    aliases: ["PE", "Buy-side", "Portfolio Operations", "Value Creation"],
    summary:
      "Fund-side investment hiring and portfolio-company leadership searches on one workspace, with deal, sector and value-creation evidence extracted from the CV.",
    meta: {
      title: "Private equity hiring — TaaSFlow",
      description:
        "Structured sourcing for funds and portfolio companies. Ranked shortlists with evidence of deal experience, sector focus and value-creation work.",
    },
    hero: {
      title: "PE hiring, from deal team to portfolio operators.",
      subtitle:
        "Fund-side investment roles and portfolio leadership hires, each with a rubric tuned to the mandate.",
    },
    challenges: [
      { title: "Deal and sector evidence", body: "PE CVs need to show the deals actually worked on and the sector depth behind them. Our rubric extracts deal roles, cheque sizes and sector coverage — not just firm names." },
      { title: "Fund vs portfolio context", body: "Investment-team hires and portfolio-company operators need different signals. We build the rubric per mandate instead of treating both as the same search." },
      { title: "Confidentiality and discretion", body: "Every mandate sits in a private workspace scoped to the sponsor. Candidate context stays inside the search it was collected for." },
      { title: "Operator credibility under time pressure", body: "Portfolio CEOs and CFOs are hired against a hold-period clock. Rubrics weight the specific operating levers pulled — pricing, working capital, add-on integration — over generic leadership language." },
    ],
    solutions: [
      { title: "Deal-level evidence extraction", body: "Named deals, cheque size, entry/exit role and sector are quoted straight from the CV rather than inferred from firm brand." },
      { title: "Mandate-specific rubrics", body: "Fund-side investment rubrics and portfolio-operator rubrics are built separately so a deal-team search never surfaces generalist operators, or vice versa." },
      { title: "Value-creation lever tracking", body: "Pricing, procurement, add-on M&A, commercial excellence and systems work are captured as distinct signals against the thesis the role serves." },
      { title: "Sponsor-scoped confidentiality", body: "Each mandate sits in an isolated workspace with row-level access control, so live searches never surface to other sponsors or portfolio companies." },
    ],
    roleFamilies: [
      { name: "Investment team", blurb: "Fund-side deal execution and portfolio monitoring.", roles: ["Investment analysts and associates", "Vice presidents", "Principals and partners", "Sector heads"] },
      { name: "Portfolio operations", blurb: "Operating partners embedded across the portfolio.", roles: ["Operating partners", "Value creation directors", "Transformation leads", "Commercial excellence leads"] },
      { name: "Portfolio leadership", blurb: "C-suite hires placed directly into portfolio companies.", roles: ["Portfolio CEOs and GMs", "Portfolio CFOs and finance directors", "Portfolio COOs", "Interim executives"] },
      { name: "Fund operations", blurb: "Non-investment functions supporting the fund.", roles: ["Fund controllers", "Investor relations", "Fund operations and compliance", "ESG and impact leads"] },
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
    candidateSignals: [
      { title: "Deal tape", body: "Named transactions, cheque size, role played (sourcing, execution, monitoring) and outcome, quoted from the CV." },
      { title: "Sector depth", body: "Years and named deals within a specific sector, distinguished from generalist coverage." },
      { title: "Value-creation ownership", body: "Specific operating levers pulled at portfolio companies — pricing, procurement, add-on integration, systems — with measurable scope." },
      { title: "Fund vs operator track", body: "Career shape distinguishing investment-team progression from operating-executive progression, so the right rubric applies." },
      { title: "Hold-period outcomes", body: "Entry and exit context, multiple context where stated, and tenure through a hold period." },
    ],
    skills: ["Financial modelling", "Due diligence", "Value creation planning", "Portfolio governance", "Carve-outs and integration", "100-day planning"],
    tools: ["Excel (advanced)", "PowerPoint", "Capital IQ", "PitchBook", "Datasite", "Board reporting platforms"],
    signals: ["Deal and sector evidence extracted", "Rubric per fund or portfolio mandate", "Private workspace per requisition"],
    relatedIndustries: [
      { slug: "investment-banking", name: "Investment Banking", blurb: "Deal execution feeding the PE talent pool." },
      { slug: "venture-capital", name: "Venture Capital", blurb: "Earlier-stage investing counterpart." },
      { slug: "finance", name: "Finance", blurb: "Corporate finance and treasury for portfolio companies." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Can you hire directly into portfolio companies?", a: "Yes. Portfolio CEO, CFO and functional leadership searches run on an operator rubric distinct from fund-side investment hiring." },
      { q: "How do you keep live mandates confidential?", a: "Each mandate is a private, sponsor-scoped workspace with row-level isolation — no cross-visibility between sponsors or portfolio companies." },
      { q: "Do you verify deal-tape claims?", a: "We surface what the CV states, quoted to the source line, so your team can verify through references or data-room history." },
      { q: "Can rubrics reflect a specific investment thesis?", a: "Yes — sector focus, deal size band and value-creation priorities are captured at intake and shape the rubric." },
      { q: "Is pricing different for fund vs portfolio-company roles?", a: "No — one flat subscription covers every search in your workspace, regardless of role type." },
    ],
    cta: { title: "Running a PE search?", description: "Submit the mandate — one private workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // BATCH 3 — Healthcare, Legal, Public Sector
  // ============================================================
  {
    slug: "healthcare",
    eyebrow: "Healthcare",
    name: "Healthcare",
    category: "Regulated & Public",
    aliases: ["Health", "Clinical", "Healthtech", "Payer", "Provider", "MedTech"],
    summary:
      "Clinical and nonclinical hiring across providers, payers and health-tech — with licensing and specialty context captured as first-class signals.",
    meta: {
      title: "Healthcare hiring — TaaSFlow",
      description:
        "Structured sourcing for healthcare providers, payers and health-tech teams. Ranked shortlists with evidence of the settings, systems, specialties and licensing worked with.",
    },
    hero: {
      title: "Healthcare hiring, calibrated per setting, specialty and licensing context.",
      subtitle:
        "Clinical, operational and technical hires, scored on care setting, specialty, systems and licensing.",
    },
    challenges: [
      { title: "Setting and specialty fit", body: "Acute, ambulatory, primary care, behavioural health and health-tech each need distinct evidence. Our rubric captures the settings and specialties the candidate has worked in — not generic 'healthcare experience'." },
      { title: "Systems and workflow context", body: "EHR platforms (Epic, Cerner, Meditech), coding systems and clinical workflows are captured in intake so shortlists reflect the operating environment." },
      { title: "Licensure and role scope", body: "Where a role requires specific licensure or scope of practice, we capture what the CV states as structured signals. We do not attest to licensure — your team verifies." },
      { title: "Location and specialised experience", body: "Rural, urban, multi-state and multi-facility work is captured as structured context; niche specialties are matched deliberately, not by keyword." },
    ],
    solutions: [
      { title: "Setting and specialty rubrics", body: "Acute, ambulatory, primary care, behavioural health, home care and health-tech scored separately." },
      { title: "EHR and workflow-aware scoring", body: "Epic, Cerner, Meditech, athenahealth and NHS-Spine exposure captured with production years." },
      { title: "Licensure-transparent shortlists", body: "License, certification and scope-of-practice claims are surfaced with the CV line — never asserted by us." },
      { title: "Compliance-aware handling", body: "HIPAA / GDPR-aware pipelines and workspace-scoped candidate context." },
    ],
    roleFamilies: [
      { name: "Clinical", blurb: "Physicians, nurses and allied health.", roles: ["Physicians and specialists", "Advanced practice providers (NP, PA)", "Registered nurses and specialist nurses", "Allied health professionals"] },
      { name: "Nonclinical operations", blurb: "Practice, clinic and hospital operations.", roles: ["Practice managers", "Clinic and facility administrators", "Revenue cycle managers", "Patient access leaders"] },
      { name: "Health informatics & EHR", blurb: "EHR configuration, informatics and analytics.", roles: ["Epic / Cerner analysts", "Clinical informaticists", "Health data analysts", "Population health analysts"] },
      { name: "Health-tech", blurb: "Product and engineering inside health companies.", roles: ["Health-tech product managers", "Clinical product managers", "Health engineers", "Regulatory and QMS leads"] },
      { name: "Payer & claims", blurb: "Managed care, claims and payer operations.", roles: ["Claims examiners", "Utilization management", "Provider network specialists", "Payer product managers"] },
      { name: "Quality, compliance & population health", blurb: "Quality, regulatory and value-based care.", roles: ["Quality analysts", "HEDIS specialists", "Care coordinators", "Population health managers"] },
    ],
    roles: [
      "Physicians and specialists",
      "Nurses and advanced practice providers",
      "Healthcare operations leaders",
      "Practice and clinic managers",
      "Revenue cycle and billing specialists",
      "Health informatics and EHR analysts",
      "Health-tech product and engineering",
      "Payer operations and claims specialists",
      "Population health and care coordination",
    ],
    candidateSignals: [
      { title: "Setting exposure", body: "Named hospitals, systems, health plans or health-tech products — with role and scope." },
      { title: "Specialty depth", body: "Cardiology, oncology, behavioural health, primary care — with case mix or product depth." },
      { title: "EHR / systems", body: "Epic, Cerner, Meditech, athenahealth, NHS-Spine — production years and modules." },
      { title: "Licensure claims", body: "State/board licenses, certifications and DEA — captured verbatim for your verification." },
      { title: "Quality & outcomes", body: "HEDIS, Star, CAHPS or clinical outcomes owned." },
      { title: "Regulatory context", body: "HIPAA, HITECH, GDPR-Health, MHRA, FDA where relevant." },
    ],
    skills: ["Clinical documentation", "Care coordination", "Revenue cycle management", "Prior authorisation", "Value-based care", "Health economics", "Clinical trial design", "Regulatory affairs"],
    tools: ["Epic", "Cerner", "Meditech", "athenahealth", "NextGen", "Allscripts", "NHS-Spine", "Snowflake for health data", "Tableau"],
    certifications: ["RN / NP / PA licensure", "MD / DO", "PMP for programme roles", "CPHIMS", "RHIA / RHIT", "Epic / Cerner certifications"],
    regulatedRequirements: [
      "HIPAA / HITECH awareness (US)",
      "State-specific medical licensure verification",
      "GDPR-health data handling (EU/UK)",
      "MHRA / FDA context for MedTech roles",
    ],
    signals: ["Setting and specialty rubric per role", "Systems, workflow and licensure captured in intake", "Human review before publication"],
    relatedIndustries: [
      { slug: "insurance", name: "Insurance", blurb: "Health payer operations and claims." },
      { slug: "public-sector", name: "Public Sector", blurb: "NHS, state health and public health teams." },
      { slug: "tech", name: "Technology", blurb: "Engineering and product for health-tech." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you verify clinical licensure?", a: "No — we surface what the CV states as structured signals so your credentialing or licensure team can verify through the appropriate primary source." },
      { q: "Can you hire across US and UK/EU healthcare?", a: "Yes. Jurisdiction is captured in intake and drives the rubric (state licensure vs GMC / NMC context, EHR ecosystems and payer models)." },
      { q: "How do you handle sensitive candidate data?", a: "Workspace-scoped tenant isolation, private CV storage, short-lived signed URLs and audit trails. HIPAA-aware handling is a default posture." },
      { q: "Do you cover payer as well as provider roles?", a: "Yes. Payer operations, claims and provider-network roles have their own rubric family distinct from provider operations." },
      { q: "Can you support health-tech product hires?", a: "Yes. Health-tech PM and engineering hires get a clinical-context rubric — regulated dev, QMS and safety cases scored where relevant." },
    ],
    cta: { title: "Hiring in healthcare?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  {
    slug: "legal",
    eyebrow: "Legal",
    name: "Legal",
    category: "Regulated & Public",
    aliases: ["Law", "Attorneys", "Solicitors", "Counsel", "In-house Legal", "Legal Ops"],
    summary:
      "Law firm and in-house legal hiring — with practice area, jurisdiction, bar admission and legal-operations context evidenced from the CV.",
    meta: {
      title: "Legal hiring — TaaSFlow",
      description:
        "Structured sourcing for law firms and in-house legal teams. Ranked shortlists with practice-area, jurisdiction and bar-admission evidence extracted directly from the CV.",
    },
    hero: {
      title: "Legal hiring with evidence tied to practice, jurisdiction and admission.",
      subtitle:
        "Rubrics per practice area, jurisdiction, admission and level, with every shortlist reviewed by a recruiter.",
    },
    challenges: [
      { title: "Practice-area precision", body: "Legal CVs blur across practice groups. The rubric captures the specific matters, deal types and jurisdictions worked on so shortlists match the mandate — not the label." },
      { title: "Jurisdiction and qualification", body: "Bar admissions, qualification routes and regulatory exposure are captured in intake and treated as first-class filters, not free-text notes." },
      { title: "Firm vs in-house context", body: "Practice at a firm and running an in-house function reward different signals. Rubrics adjust so a GC search doesn't get firm-shaped CVs at the top." },
      { title: "Legal-operations as its own discipline", body: "Legal ops leaders — process, tech, spend and vendor management — get a distinct rubric separate from traditional practice roles." },
    ],
    solutions: [
      { title: "Practice-area rubrics", body: "M&A, litigation, IP/tech, employment, regulatory and finance rated separately with matter-level evidence." },
      { title: "Jurisdiction as a first-class filter", body: "Bar admission, qualification route and jurisdiction are structured signals — never free-text keywords." },
      { title: "Firm-side and in-house tracks", body: "Distinct rubrics for firm senior associates, GC, DGC and legal-ops leaders." },
      { title: "Confidential, mandate-scoped delivery", body: "Every search sits in a private workspace with row-level isolation." },
    ],
    roleFamilies: [
      { name: "Law firms", blurb: "Practice-area associates, senior associates and partners.", roles: ["Associates (M&A, litigation, IP, employment)", "Senior associates and counsel", "Practice partners", "Of counsel"] },
      { name: "In-house legal", blurb: "GC, DGC and specialist in-house counsel.", roles: ["General counsel", "Deputy general counsel", "Commercial counsel", "Employment counsel"] },
      { name: "Practice-area specialists", blurb: "Deep specialists across practice areas.", roles: ["M&A and private equity counsel", "Litigation and disputes lawyers", "Regulatory and compliance counsel", "IP and technology lawyers"] },
      { name: "Legal operations", blurb: "Process, tech, spend and vendor.", roles: ["Legal ops directors", "Contract lifecycle managers", "Legal technology leads", "Legal spend & vendor managers"] },
      { name: "Paralegals & support", blurb: "Paralegals, contract analysts and legal researchers.", roles: ["Paralegals", "Contract analysts", "Legal researchers", "Docket and knowledge specialists"] },
      { name: "Bar admission tracks", blurb: "Qualifying and cross-border qualification routes.", roles: ["Newly qualified solicitors / attorneys", "Trainees and articled clerks", "Foreign-qualified lawyers"] },
    ],
    roles: [
      "General counsel and DGCs",
      "Corporate & commercial lawyers",
      "M&A and private equity counsel",
      "Litigation and disputes",
      "Regulatory and compliance counsel",
      "Employment lawyers",
      "IP and technology lawyers",
      "Legal operations leads",
      "Paralegals and legal analysts",
    ],
    candidateSignals: [
      { title: "Matter-level evidence", body: "Named matters, deal types, deal size, dispute value — captured verbatim for your review." },
      { title: "Practice depth", body: "Years in a single practice area with the specific sub-specialisms." },
      { title: "Jurisdiction and bar", body: "Bar admission, jurisdiction and cross-qualifying route captured explicitly." },
      { title: "Client and industry exposure", body: "Sectors covered, client sizes and public/private markets exposure." },
      { title: "Firm/in-house progression", body: "Time at firm, in-house tenure and combined career shape." },
    ],
    skills: ["Contract drafting", "Deal execution", "Dispute strategy", "Regulatory advocacy", "Board advisory", "Data protection", "Cross-border transactions", "Employment advisory"],
    tools: ["iManage", "NetDocuments", "HighQ", "Ironclad", "DocuSign CLM", "Litera", "Clio", "Thomson Reuters", "LexisNexis"],
    certifications: ["Bar admissions (state / country-specific)", "Solicitors Regulation Authority (SRA) admission", "Practising certificate", "CIPP/E, CIPP/US (privacy)"],
    regulatedRequirements: [
      "Bar admission verification (US, UK, EU, APAC)",
      "SRA / Bar Council compliance (UK)",
      "GDPR / privacy exposure for tech and data hires",
      "SEC / FCA regulatory exposure for financial-services counsel",
    ],
    signals: ["Practice-area rubric per requisition", "Jurisdiction and qualification as filters", "Evidence traced to the CV"],
    relatedIndustries: [
      { slug: "finance", name: "Finance", blurb: "Regulatory and compliance counsel." },
      { slug: "public-sector", name: "Public Sector", blurb: "Government legal and regulatory teams." },
      { slug: "consulting", name: "Consulting", blurb: "Advisory and transformation practices." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you verify bar admission?", a: "No — we surface what the CV states as structured signals so your compliance or bar-admissions team can verify through the appropriate primary source." },
      { q: "Can you hire across US and UK/EU legal markets?", a: "Yes. Jurisdiction is captured in intake and the rubric maps to the local qualification route and practice conventions." },
      { q: "Do you cover in-house and firm-side hiring?", a: "Yes, with distinct rubrics. In-house rubrics weight commercial judgement and board readiness; firm-side rubrics weight matter portfolio and progression." },
      { q: "How do you handle confidential partner-level searches?", a: "Workspace-scoped tenant isolation, private context and audit trails. Only authorised users see the mandate." },
      { q: "Do you help with legal-operations hires?", a: "Yes. Legal ops is a distinct rubric family focused on CLM, spend, vendor and legal-tech implementations." },
    ],
    cta: { title: "Hiring for a legal mandate?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "public-sector",
    eyebrow: "Public Sector",
    name: "Public Sector",
    category: "Regulated & Public",
    aliases: ["Government", "GovTech", "Civil Service", "Public Services", "Defence", "Municipal"],
    summary:
      "Government, public services and government-contractor hiring — with programme, procurement, clearance and policy context captured as first-class signals.",
    meta: {
      title: "Public sector hiring — TaaSFlow",
      description:
        "Structured sourcing for public agencies, government contractors and civic-tech teams. Ranked shortlists with evidence of programme, policy, procurement and delivery experience.",
    },
    hero: {
      title: "Public sector hiring, evidenced by programme and procurement work.",
      subtitle:
        "Programme, policy, delivery and technology hires, scored on programme context and procurement environment.",
    },
    challenges: [
      { title: "Programme and mission context", body: "Public sector CVs often blur across programmes. Our rubric captures the specific programmes, missions and outcomes the candidate contributed to." },
      { title: "Delivery model fit", body: "In-house civil service, contractor and vendor-side experience shape the role differently. Delivery model is captured so shortlists reflect how your team actually works." },
      { title: "Clearance and eligibility signals", body: "Where a role has clearance or eligibility requirements, we capture what the CV states as structured signals. We do not attest to clearance status — your team verifies through the appropriate channel." },
      { title: "Procurement environment", body: "GDS, GSA, framework and DPS contracting look very different from commercial procurement. Procurement context is captured as a first-class signal." },
    ],
    solutions: [
      { title: "Programme-mapped rubrics", body: "Digital transformation, benefits, health, defence, education and infrastructure programmes each score against distinct evidence." },
      { title: "Delivery-model calibration", body: "Civil service, prime contractor, subcontractor and SME routes are captured and scored." },
      { title: "Procurement-aware evidence", body: "GDS Digital Marketplace, G-Cloud, GSA MAS, DoD framework exposure surfaced as structured signals." },
      { title: "Clearance-transparent shortlists", body: "SC, DV, Public Trust, Secret and TS/SCI claims quoted verbatim from the CV — never asserted by us." },
    ],
    roleFamilies: [
      { name: "Programme & project delivery", blurb: "Programme, project and portfolio delivery in the public sector.", roles: ["Programme directors", "Programme and project managers", "Delivery managers", "Portfolio leads"] },
      { name: "Policy & advisory", blurb: "Policy analysts, advisors and researchers.", roles: ["Policy analysts", "Senior policy advisors", "Economists", "Researchers"] },
      { name: "Service design & digital", blurb: "User-centred design in government services.", roles: ["Service designers", "User researchers", "Content designers", "Interaction designers"] },
      { name: "Public-sector technology", blurb: "GovTech engineering, product and data.", roles: ["Public-sector product managers", "Software engineers on gov programmes", "Data analysts and scientists in policy"] },
      { name: "Procurement & commercial", blurb: "Contracting officers and commercial leads.", roles: ["Contracting officers", "Commercial specialists", "Procurement leads", "Framework managers"] },
      { name: "Security & clearance-dependent", blurb: "Roles where cleared personnel are required.", roles: ["Cleared engineers", "Cleared analysts", "Cleared programme managers"] },
    ],
    roles: [
      "Programme and project managers",
      "Policy analysts and advisors",
      "Delivery managers",
      "Service designers",
      "Public-sector product managers",
      "Data and analytics specialists",
      "Digital transformation leads",
      "Contract and procurement specialists",
      "Cleared / security-eligible specialists",
    ],
    candidateSignals: [
      { title: "Programme and outcome evidence", body: "Named programmes, outcomes delivered and budget scope owned." },
      { title: "Delivery model exposure", body: "Civil service vs contractor vs vendor — with the specific role played." },
      { title: "Procurement environment", body: "Framework, tender, DPS and direct-award experience — with named vehicles." },
      { title: "Policy and stakeholder work", body: "Ministerial, agency or committee-level stakeholder work." },
      { title: "Clearance claims", body: "Clearance level and status quoted verbatim for your verification." },
    ],
    skills: ["Programme management", "Policy analysis", "Service design", "Agile in government", "Procurement", "Stakeholder engagement", "Public consultation", "Impact assessment"],
    tools: ["Jira", "Confluence", "Miro", "Government Digital Service patterns", "GSA / GovTech tooling", "Salesforce Public Sector", "ServiceNow Public Sector"],
    certifications: ["PRINCE2", "MSP", "PMP", "APM", "Agile PM", "Government-specific programme frameworks"],
    regulatedRequirements: [
      "Security clearance (SC, DV, Public Trust, Secret, TS/SCI) — where required, claimed by the candidate",
      "Public-procurement rules exposure (PCR, FAR, EU directives)",
      "Data-protection and FoI awareness",
    ],
    signals: ["Programme and outcome evidence", "Delivery model and procurement captured in intake", "Human review before publication"],
    relatedIndustries: [
      { slug: "healthcare", name: "Healthcare", blurb: "NHS, state health and public-health teams." },
      { slug: "consulting", name: "Consulting", blurb: "Advisory and transformation partners to government." },
      { slug: "nonprofit", name: "Nonprofit", blurb: "Third-sector delivery and policy." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you verify security clearance?", a: "No — we surface what the CV claims as a structured signal so your vetting team can confirm through the appropriate channel." },
      { q: "Do you support UK, US and EU public-sector hiring?", a: "Yes. Jurisdiction and framework are captured in intake and applied as filters." },
      { q: "Can you hire for contractor and in-house government roles?", a: "Yes. Delivery model is a first-class rubric axis so contractor and civil-service candidates are scored on the right evidence." },
      { q: "How do you handle procurement-dependent hires?", a: "Named frameworks, vehicles and past awards are captured as structured signals and used as filters." },
      { q: "Do you make any compliance guarantees?", a: "No. We surface what the CV states and enable your team to verify. We do not attest to clearance, licensure or bar admission on a candidate's behalf." },
    ],
    cta: { title: "Building a public sector team?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // Nonprofit (kept as-is)
  // ============================================================
  {
    slug: "nonprofit",
    eyebrow: "Nonprofit",
    name: "Nonprofit",
    category: "Regulated & Public",
    aliases: ["NGO", "Foundation", "Charity", "Third Sector"],
    summary:
      "Programme, development and operations hiring for mission-driven organisations, with impact evidence and funding context captured directly from the CV.",
    meta: {
      title: "Nonprofit hiring — TaaSFlow",
      description:
        "Structured sourcing for foundations, NGOs and mission-driven organisations. Ranked shortlists with evidence of programme, funding and community impact.",
    },
    hero: {
      title: "Nonprofit hiring, calibrated per mission and programme.",
      subtitle:
        "Programme, development and operations hires, scored on mission fit and delivery evidence.",
    },
    challenges: [
      { title: "Mission and programme fit", body: "Nonprofit CVs need to show real programme contribution, not just cause alignment. Our rubric extracts the programmes owned, outcomes measured and communities served." },
      { title: "Funding and development context", body: "Foundation, individual giving, government grants and earned revenue each require different signals. Funding context is captured so shortlists reflect it." },
      { title: "Lean-team operating reality", body: "Nonprofit roles usually carry multiple hats. Rubrics reflect the actual scope of ownership rather than idealised job descriptions." },
      { title: "Budget-constrained hiring cycles", body: "Grant-funded and board-approved headcount often opens on a tight runway. A rubric ready at intake means the shortlist doesn't wait on process." },
    ],
    solutions: [
      { title: "Programme-outcome extraction", body: "Named programmes, beneficiaries served and outcomes measured are quoted from the CV rather than inferred from job titles." },
      { title: "Funding-model rubrics", body: "Foundation grants, individual giving, government contracts and earned revenue are scored as distinct development skill sets." },
      { title: "Multi-hat scope capture", body: "Rubrics reflect the real breadth of small-team roles — programme plus ops, or development plus comms — instead of penalising candidates for generalist scope." },
      { title: "Flat-fee model built for lean budgets", body: "One subscription with no placement fees keeps hiring cost predictable for boards and grant-funded budgets." },
    ],
    roleFamilies: [
      { name: "Leadership", blurb: "Executive and operational leadership of the organisation.", roles: ["Executive directors", "Deputy directors / COOs", "Country and regional directors"] },
      { name: "Programmes", blurb: "Design and delivery of mission programmes.", roles: ["Programme directors", "Programme managers", "Field/programme officers", "Monitoring and evaluation specialists"] },
      { name: "Development and fundraising", blurb: "Revenue generation across funding models.", roles: ["Development directors", "Major gifts officers", "Grant writers and grants managers", "Corporate partnerships leads"] },
      { name: "Communications and community", blurb: "Storytelling, advocacy and community engagement.", roles: ["Communications directors", "Content and campaigns leads", "Community organisers", "Advocacy managers"] },
      { name: "Operations and finance", blurb: "Back-office functions that keep the mission funded and compliant.", roles: ["Finance and operations managers", "HR and people leads", "Volunteer and partnerships managers"] },
    ],
    roles: [
      "Executive directors and COOs",
      "Programme directors and managers",
      "Development and fundraising leads",
      "Grant writers and grants managers",
      "Communications and community leads",
      "Operations and finance managers",
      "Volunteer and partnerships managers",
      "Monitoring and evaluation specialists",
    ],
    candidateSignals: [
      { title: "Programme evidence", body: "Named programmes led, populations served and geographic scope, quoted from the CV." },
      { title: "Outcome and impact data", body: "Measured outcomes — beneficiaries reached, retention, evaluation results — separated from activity counts." },
      { title: "Funding-model fit", body: "Foundation grants, major gifts, government contracts or earned revenue experience, matched to the role's development mix." },
      { title: "Scope of ownership", body: "The real breadth of the role — budget size, team size, functions combined — captured rather than assumed from title." },
      { title: "Board and stakeholder exposure", body: "Board reporting, funder relationships and multi-stakeholder coordination evidenced where present." },
    ],
    skills: ["Programme design", "Grant writing", "Donor stewardship", "Monitoring and evaluation", "Advocacy", "Volunteer management", "Budget management"],
    tools: ["Salesforce Nonprofit Cloud", "Bloomerang", "DonorPerfect", "Blackbaud", "Asana", "Grant management platforms"],
    signals: ["Programme and outcome evidence from the CV", "Funding and development context captured", "Rubric per role and level"],
    relatedIndustries: [
      { slug: "public-sector", name: "Public Sector", blurb: "Government-funded delivery and policy work." },
      { slug: "healthcare", name: "Healthcare", blurb: "Health-focused nonprofits and public health programmes." },
      { slug: "human-resources", name: "Human Resources", blurb: "People functions for mission-driven organisations." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you understand grant-funded hiring timelines?", a: "Yes. Intake is built to move quickly once a grant or board approval opens a headcount, with the usual days-not-weeks shortlist window." },
      { q: "Can the rubric reflect multi-hat roles?", a: "Yes — intake captures the real combined scope of a role (e.g. programme plus communications) so candidates aren't penalised for generalist breadth." },
      { q: "Do you work with small teams and tight budgets?", a: "Yes. Flat subscription pricing with no placement fees is designed to be predictable for board-approved and grant-funded budgets." },
      { q: "Can you evaluate international programme experience?", a: "Yes. Country and regional context, language and field-office experience are captured as structured intake fields." },
    ],
    cta: { title: "Hiring for a nonprofit role?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // BATCH 4 — Sales, Marketing & Advertising, Media
  // ============================================================
  {
    slug: "sales",
    eyebrow: "Sales",
    name: "Sales",
    category: "Go-to-Market",
    aliases: ["Revenue", "AE", "SDR", "BDR", "Enterprise Sales", "Sales Leadership", "RevOps"],
    summary:
      "Account executives, business development, sales leadership, enterprise sales and RevOps — scored on measurable quota evidence, motion and segment.",
    meta: {
      title: "Sales hiring — TaaSFlow",
      description:
        "Structured sourcing for revenue teams: AEs, BDRs, enterprise sales, sales leadership and RevOps. Ranked shortlists with measurable quota, motion and segment evidence.",
    },
    hero: {
      title: "Sales hiring, calibrated per motion, segment and quota reality.",
      subtitle:
        "AE, AM, SDR and leadership hires, scored on motion, segment, deal size and quota evidence.",
    },
    challenges: [
      { title: "Motion and deal-size fit", body: "Transactional, mid-market and enterprise motions reward different skills. The rubric captures actual cycle length, ACV and buying committees the candidate has worked with." },
      { title: "Quota and attainment evidence", body: "We extract quota, attainment and pipeline evidence from the CV instead of trusting a headline number. When it's not on the CV, the shortlist says so." },
      { title: "Segment and product fit", body: "Selling SaaS to SMB is not selling infra to enterprise. Segment, ICP and product type are captured in intake as first-class filters." },
      { title: "Territory and vertical", body: "Named accounts, patch design and vertical specialism captured — never assumed from a job title." },
    ],
    solutions: [
      { title: "Motion-mapped rubrics", body: "SMB, mid-market and enterprise motions scored separately with the metric each actually rewards." },
      { title: "Quota-transparent shortlists", body: "Quota carried, attainment %, cycle length and average deal size surfaced with CV evidence — flagged when absent." },
      { title: "Named-account and vertical scoring", body: "Vertical specialism, named accounts and buying-committee experience captured explicitly." },
      { title: "Cross-functional coverage", body: "AE, AM, SDR, SE, sales leadership, partnerships and RevOps under one workspace." },
    ],
    roleFamilies: [
      { name: "Account executives", blurb: "SMB, mid-market and enterprise AEs.", roles: ["SMB AEs", "Mid-market AEs", "Enterprise AEs", "Strategic AEs"] },
      { name: "Business development", blurb: "SDRs, BDRs and outbound teams.", roles: ["SDRs", "BDRs", "Outbound managers", "Sales development leaders"] },
      { name: "Sales leadership", blurb: "Team leads to CROs.", roles: ["Sales managers", "Sales directors", "VPs of sales", "CROs"] },
      { name: "Enterprise sales", blurb: "Complex, multi-stakeholder enterprise motions.", roles: ["Enterprise AEs", "Global account directors", "Strategic account managers"] },
      { name: "Revenue operations", blurb: "The systems and processes behind revenue.", roles: ["RevOps analysts", "RevOps managers", "Deal desk", "Comp and territory analysts"] },
      { name: "Sales engineering & partnerships", blurb: "SEs, SCs and channel.", roles: ["Sales engineers", "Solutions consultants", "Partnerships managers", "Channel account managers"] },
    ],
    roles: [
      "SDRs and BDRs",
      "Account executives (SMB, mid-market, enterprise)",
      "Account managers and CSMs",
      "Sales engineers and solutions consultants",
      "Sales managers and directors",
      "VPs of sales and CROs",
      "Partnerships and channel leads",
      "Revenue operations specialists",
    ],
    candidateSignals: [
      { title: "Quota and attainment", body: "Quota carried, attainment history, and consistency over multiple years." },
      { title: "Cycle and ACV", body: "Cycle length, ACV and buying-committee complexity." },
      { title: "Named accounts", body: "Logos won, patches owned and named account penetration." },
      { title: "Vertical specialism", body: "Sector concentration where relevant (FinServ, Healthcare, Public Sector)." },
      { title: "Team scaling (leaders)", body: "Team size grown, ramp times, retention and quota-attainment across the team." },
    ],
    skills: ["Discovery", "MEDDIC / MEDDPICC", "Value selling", "Enterprise deal architecture", "Forecasting", "Territory design", "Comp design", "Pipeline management"],
    tools: ["Salesforce", "HubSpot", "Outreach", "Salesloft", "Gong", "Chorus", "Clari", "6sense", "LinkedIn Sales Navigator", "ZoomInfo"],
    certifications: ["MEDDIC / MEDDPICC accreditation", "Challenger training", "Winning by Design", "Sandler"],
    signals: ["Motion, deal size and cycle captured", "Quota and attainment evidence from the CV", "ICP and segment as first-class filters"],
    relatedIndustries: [
      { slug: "saas", name: "SaaS", blurb: "GTM hires for recurring-revenue businesses." },
      { slug: "marketing", name: "Marketing", blurb: "Demand and pipeline partners for sales." },
      { slug: "human-resources", name: "Human Resources", blurb: "Comp, ramp and enablement." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "How do you validate quota claims?", a: "We extract quota, attainment and cycle detail from the CV and flag where a candidate has not evidenced them. Verbal claims in interviews are your team's call — not ours." },
      { q: "Do you differentiate hunter and farmer profiles?", a: "Yes. New-logo, expansion and retention seats get distinct rubrics — inbound, outbound, land-and-expand and renewal motions scored on different signals." },
      { q: "Can you hire enterprise reps for regulated sectors?", a: "Yes. Vertical experience is a first-class filter — FinServ, Healthcare, Public Sector and Defense reps scored on their sector patch." },
      { q: "How do you handle sales-leadership searches?", a: "Leader rubrics weight team scaling, ramp times, retention and quota-attainment across teams — with named revenue outcomes." },
      { q: "Do you cover partnerships and channel?", a: "Yes. Partnerships and channel roles get a distinct rubric focused on partner ecosystems, sourced pipeline and co-sell motion." },
    ],
    cta: { title: "Building the revenue team?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  {
    slug: "marketing",
    eyebrow: "Marketing & Advertising",
    name: "Marketing & Advertising",
    category: "Go-to-Market",
    aliases: ["Marketing", "Advertising", "Demand Gen", "Brand", "Content", "Lifecycle", "Performance Marketing"],
    summary:
      "Demand generation, performance marketing, brand, content, lifecycle and marketing operations — scored on channel ownership and business outcomes.",
    meta: {
      title: "Marketing & advertising hiring — TaaSFlow",
      description:
        "Structured sourcing for marketing and advertising teams: demand gen, performance, brand, content, lifecycle and marketing operations. Ranked shortlists with channel and outcome evidence.",
    },
    hero: {
      title: "Marketing hiring, tuned per channel, funnel stage and audience.",
      subtitle:
        "Demand, brand, content and lifecycle hires, scored per channel, funnel stage and budget scope.",
    },
    challenges: [
      { title: "Channel and stack fit", body: "Paid, SEO, content, lifecycle and events reward different signal. The rubric captures the channels actually owned and results measured, not the list of tools mentioned." },
      { title: "Funnel-stage ownership", body: "Top-of-funnel demand, product marketing and lifecycle marketers own different work. Funnel-stage ownership is captured so shortlists match the seat you're hiring for." },
      { title: "Brand vs performance", body: "Brand builders and performance marketers reward different evidence. We calibrate rubrics so brand hires aren't judged on CAC targets and performance hires aren't judged on brand books." },
      { title: "Audience and motion", body: "B2B enterprise, B2B SMB, B2C and community-led motions all need distinct evidence. Audience is captured as a filter, not a keyword." },
    ],
    solutions: [
      { title: "Channel-mapped scoring", body: "Paid, SEO, content, lifecycle, events, PR and community graded on the metric each channel actually moves." },
      { title: "Funnel-stage rubrics", body: "Demand, product marketing, lifecycle and brand scored separately with stage-appropriate evidence." },
      { title: "Budget and outcome evidence", body: "Budget scope, CAC, LTV, MQL-to-SQL, pipeline sourced and revenue influenced surfaced with CV evidence." },
      { title: "Brand and performance calibration", body: "Distinct rubrics so brand and performance hires are judged on the outcomes their craft actually owns." },
    ],
    roleFamilies: [
      { name: "Demand generation", blurb: "Pipeline-owning demand and growth marketers.", roles: ["Demand generation managers", "Growth marketers", "Field marketing managers", "ABM specialists"] },
      { name: "Performance marketing", blurb: "Paid acquisition and analytics-heavy marketers.", roles: ["Paid acquisition managers", "SEM / paid search specialists", "Paid social specialists", "Marketing analysts"] },
      { name: "Brand & creative", blurb: "Brand builders, designers and creative directors.", roles: ["Brand managers", "Creative directors", "Art directors", "Design leaders"] },
      { name: "Content & editorial", blurb: "Editorial-quality content teams.", roles: ["Content marketers", "Editorial leads", "Managing editors", "Writers and content producers"] },
      { name: "Lifecycle & CRM", blurb: "Retention, lifecycle and CRM specialists.", roles: ["Lifecycle marketers", "CRM managers", "Retention specialists", "Email marketing managers"] },
      { name: "Marketing operations", blurb: "Systems, analytics and campaign ops.", roles: ["Marketing operations managers", "Campaign operations", "Marketing analytics", "Marketing technology managers"] },
    ],
    roles: [
      "Demand generation managers",
      "Product marketing managers",
      "Content and editorial leads",
      "Brand and creative directors",
      "Lifecycle and CRM marketers",
      "SEO and organic growth leads",
      "Performance marketing managers",
      "Marketing operations and analytics",
      "Heads of marketing and CMOs",
    ],
    candidateSignals: [
      { title: "Channel ownership", body: "Channels owned end-to-end with budget scope and outcomes measured." },
      { title: "Pipeline / revenue influence", body: "Pipeline sourced, MQL/SQL contribution, CAC and payback where evidenced." },
      { title: "Brand outcomes", body: "Awareness, brand-search lift, campaign recognition where evidenced." },
      { title: "Content craft", body: "Portfolios, editorial standards and audience growth on named properties." },
      { title: "Stack fluency", body: "Marketo, HubSpot, Salesforce, Iterable, Segment — production years." },
    ],
    skills: ["Demand generation", "Performance marketing", "SEO", "Content strategy", "Lifecycle marketing", "Marketing analytics", "Brand strategy", "Media planning", "ABM"],
    tools: ["HubSpot", "Marketo", "Pardot", "Salesforce", "Iterable", "Braze", "Customer.io", "Google Ads", "Meta Ads", "LinkedIn Ads", "Google Analytics 4", "Segment", "Amplitude"],
    certifications: ["Google Ads certifications", "Meta Blueprint", "HubSpot certifications", "Marketo Certified Expert", "IAB Digital Marketing"],
    signals: ["Channel ownership captured per role", "Funnel-stage rubric per requisition", "Audience and motion as first-class filters"],
    relatedIndustries: [
      { slug: "sales", name: "Sales", blurb: "Revenue-team hiring aligned with marketing pipeline." },
      { slug: "media", name: "Media", blurb: "Editorial, production and audience growth." },
      { slug: "saas", name: "SaaS", blurb: "Product marketing and lifecycle for SaaS." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you differentiate brand and performance marketers?", a: "Yes. Brand and performance rubrics are distinct — brand rewards portfolio and craft evidence, performance rewards budget scope and measurable outcomes." },
      { q: "Can you hire product marketing managers?", a: "Yes, with a rubric focused on launch ownership, sales enablement outcomes and category positioning evidence." },
      { q: "How do you handle B2B vs B2C hires?", a: "Audience motion is captured in intake and drives the rubric — ACV, cycle, ABM depth for B2B; CAC, LTV, cohort behaviour for B2C." },
      { q: "Do you cover CMO and VP marketing searches?", a: "Yes. Leader rubrics weight budget scope, org design, pipeline responsibility and brand outcomes." },
      { q: "Can you hire creative and design leaders?", a: "Yes. Creative director and design leader searches use portfolio-first rubrics with stated craft standards." },
    ],
    cta: { title: "Hiring across marketing?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  {
    slug: "media",
    eyebrow: "Media",
    name: "Media",
    category: "Go-to-Market",
    aliases: ["Publishing", "Broadcast", "Streaming", "Editorial", "Production", "Digital Media"],
    summary:
      "Editorial, production, digital media, audience growth, partnerships and creative operations — with format, audience and revenue-model evidence.",
    meta: {
      title: "Media hiring — TaaSFlow",
      description:
        "Structured sourcing for publishers, studios, agencies and creator businesses. Ranked shortlists with format, audience and revenue-model evidence.",
    },
    hero: {
      title: "Media hiring, calibrated per format, audience and revenue model.",
      subtitle:
        "Editorial, production, distribution and monetisation hires, scored per format, audience and revenue model.",
    },
    challenges: [
      { title: "Format and craft fit", body: "Editorial, video, audio, social and live formats each require distinct craft evidence. The rubric captures the formats actually produced and the audiences reached." },
      { title: "Revenue-model context", body: "Advertising, subscriptions, licensing and creator commerce reward different signal. Revenue model is captured in intake so shortlists reflect it." },
      { title: "Audience and distribution", body: "Owned platforms, third-party platforms and syndication all shape the role differently. Distribution surface is captured as a filter, not a keyword search." },
      { title: "Creative operations is a discipline", body: "Production planning, budget, rights and post-production are their own craft — scored separately from editorial and production." },
    ],
    solutions: [
      { title: "Format-mapped rubrics", body: "Print, digital editorial, video, audio, social and live production graded separately." },
      { title: "Revenue-model calibration", body: "Ad, subscription, licensing and creator-commerce hires scored against the metric each model rewards." },
      { title: "Distribution-aware scoring", body: "Owned platform, syndication, YouTube, TikTok, podcast platforms and OTT captured as structured signals." },
      { title: "Creative-ops discipline", body: "Producers, project managers and creative-ops leads scored on budget, rights and delivery discipline." },
    ],
    roleFamilies: [
      { name: "Editorial", blurb: "Journalists, editors and editorial leads.", roles: ["Reporters and staff writers", "Section editors", "Executive editors and editors-in-chief", "Newsletter editors"] },
      { name: "Production", blurb: "Video, audio and live producers.", roles: ["Video producers", "Podcast producers", "Executive producers", "Live producers"] },
      { name: "Digital media", blurb: "Digital publishing, SEO and platforms.", roles: ["Digital editors", "Platforms editors", "SEO editors", "Video editors for social"] },
      { name: "Audience growth", blurb: "Audience, subscriptions and community.", roles: ["Audience development managers", "Subscriptions managers", "Community leads", "Newsletter growth managers"] },
      { name: "Partnerships & monetisation", blurb: "Ad sales, sponsorships and licensing.", roles: ["Ad sales managers", "Sponsorship leads", "Licensing managers", "Talent partnerships"] },
      { name: "Creative operations", blurb: "Production management and creative ops.", roles: ["Producers", "Project managers", "Rights & clearances specialists", "Post-production supervisors"] },
    ],
    roles: [
      "Editors and editorial leads",
      "Producers and executive producers",
      "Video and audio production leads",
      "Social and community leads",
      "Distribution and platform managers",
      "Ad sales and monetisation leads",
      "Subscription and audience-growth managers",
      "Creator and talent partnerships",
      "Creative operations managers",
    ],
    candidateSignals: [
      { title: "Portfolio depth", body: "Named titles, shows, formats or brands with role and scope." },
      { title: "Audience outcomes", body: "Subscribers grown, downloads sustained, watch time delivered." },
      { title: "Revenue outcomes", body: "Ad revenue, sponsorship deals, subscriber revenue or licensing revenue owned." },
      { title: "Craft standards", body: "Awards, publications and editorial standards evidenced." },
      { title: "Platform native fluency", body: "YouTube, TikTok, Spotify, Apple Podcasts, OTT and streaming platforms." },
    ],
    skills: ["Editing", "Reporting", "Video production", "Audio production", "Audience development", "Rights & clearances", "Podcast production", "Ad sales strategy"],
    tools: ["Adobe Creative Cloud", "Avid", "Final Cut", "Frame.io", "Airtable", "Slack + newsroom CMSes", "Google Analytics", "Chartable / Podtrac"],
    certifications: ["Journalism qualifications where applicable", "Broadcast union credentials where applicable"],
    signals: ["Format and craft rubric per role", "Revenue model captured in intake", "Distribution surface as a first-class filter"],
    relatedIndustries: [
      { slug: "marketing", name: "Marketing & Advertising", blurb: "Brand and content marketing hiring." },
      { slug: "ecommerce", name: "E-commerce", blurb: "Creator commerce and DTC brands." },
      { slug: "tech", name: "Technology", blurb: "Media-tech engineering and platform." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover editorial and commercial roles?", a: "Yes, with distinct rubrics. Editorial rewards craft, portfolio and audience outcomes; commercial rewards revenue ownership and partnership pipeline." },
      { q: "Can you hire audio and video producers?", a: "Yes. Producer rubrics weight portfolio, format, format-native platform fluency and delivery discipline." },
      { q: "How do you handle subscription media hires?", a: "Subscription-model roles are scored on funnel, retention and LTV evidence rather than reach metrics alone." },
      { q: "Do you support creator-economy hires?", a: "Yes. Creator, community and talent-partnership roles get their own rubric family with platform and community evidence." },
      { q: "How do you handle union or freelance-heavy production teams?", a: "Freelance vs staff engagement, day-rate scope and rights posture are captured as intake fields." },
    ],
    cta: { title: "Hiring in media?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // BATCH 5 — Human Resources, Staffing Agencies, Consulting
  // ============================================================
  {
    slug: "human-resources",
    eyebrow: "Human Resources",
    name: "Human Resources",
    category: "People & Advisory",
    aliases: ["HR", "People Ops", "Talent Acquisition", "HRBP", "L&D", "Compensation and Benefits"],
    summary:
      "Talent acquisition, HR business partners, people operations, L&D, comp & ben and HR leadership — calibrated per function and organisation stage.",
    meta: {
      title: "Human resources hiring — TaaSFlow",
      description:
        "Structured sourcing for people teams: talent acquisition, HRBP, people ops, L&D, compensation & benefits and HR leadership. Ranked shortlists with function-specific evidence.",
    },
    hero: {
      title: "People-team hiring, calibrated per function and organisation stage.",
      subtitle:
        "TA, HRBP, reward, L&D and people ops hires, scored per function and company stage.",
    },
    challenges: [
      { title: "Function-specific evidence", body: "Recruiting, HRBP, comp & ben, DEI, L&D and people ops each need distinct signal. The rubric captures the specific function and scope the candidate actually owned." },
      { title: "Organisation stage and size", body: "Early-stage, scaleup and mature-enterprise people work look nothing alike. Stage and headcount context are captured in intake and used as filters." },
      { title: "Systems and operating model", body: "HRIS, ATS, payroll and comp systems are captured as structured signals so shortlists reflect the stack the hire will actually operate." },
      { title: "Leadership vs specialist calibration", body: "CPO, head of people and functional-lead searches reward different evidence to specialist hires. Rubrics adjust per level." },
    ],
    solutions: [
      { title: "Function-mapped rubrics", body: "Talent acquisition, HRBP, comp & ben, L&D, people ops and DEI scored separately." },
      { title: "Stage-aware scoring", body: "Early-stage, scaleup, mature and public-company people work graded on the evidence each stage rewards." },
      { title: "Systems-aware shortlists", body: "Workday, Successfactors, BambooHR, Greenhouse, Lever, Ashby, Personio and Rippling exposure captured with production years." },
      { title: "Leader and specialist tracks", body: "Distinct rubrics for CPO, head-of-function and specialist seats." },
    ],
    roleFamilies: [
      { name: "Talent acquisition", blurb: "Recruiters, sourcers and TA leaders.", roles: ["Recruiters (tech, GTM, corporate)", "Sourcers", "Recruiting managers", "Heads of talent acquisition"] },
      { name: "HR business partners", blurb: "HRBPs and generalists.", roles: ["HR business partners", "Senior HRBPs", "HR generalists", "Regional HR leads"] },
      { name: "People operations", blurb: "HR ops, systems and shared services.", roles: ["People operations managers", "HRIS analysts", "HR shared services leads", "Employee lifecycle specialists"] },
      { name: "Learning & development", blurb: "L&D specialists and learning leaders.", roles: ["L&D managers", "Learning designers", "Enablement leaders", "Leadership development leads"] },
      { name: "Compensation & benefits", blurb: "Total rewards and comp analysts.", roles: ["Compensation analysts", "Compensation managers", "Benefits managers", "Total rewards leaders"] },
      { name: "HR leadership", blurb: "Heads of people and CPOs.", roles: ["Heads of HR", "Heads of people", "VPs people", "Chief people officers"] },
    ],
    roles: [
      "Recruiters and talent leads",
      "HR business partners",
      "People operations specialists",
      "Compensation and benefits specialists",
      "Learning and development leads",
      "DEI and culture specialists",
      "HR generalists",
      "Heads of people and CPOs",
    ],
    candidateSignals: [
      { title: "Function and scope", body: "Function owned, headcount served, geographies covered." },
      { title: "Stage exposure", body: "Early-stage, scaleup, enterprise or public-company operating context." },
      { title: "Systems fluency", body: "HRIS, ATS, LMS and comp tools with production years." },
      { title: "Programmes delivered", body: "Comp cycles run, engagement programmes shipped, DEI initiatives owned." },
      { title: "Leadership evidence", body: "Team size, org design and board reporting for senior seats." },
    ],
    skills: ["Recruiting", "Sourcing", "Total rewards design", "Performance management", "Employee relations", "Talent development", "DEI programme design", "HR analytics"],
    tools: ["Workday", "SAP SuccessFactors", "BambooHR", "Personio", "Rippling", "Greenhouse", "Lever", "Ashby", "SmartRecruiters", "Culture Amp", "Lattice"],
    certifications: ["SHRM-CP / SHRM-SCP", "CIPD", "GPHR", "AIRS certifications", "Reforge People programs"],
    signals: ["Function and scope rubric per role", "Stage and headcount captured in intake", "Systems and operating model as filters"],
    relatedIndustries: [
      { slug: "staffing-agencies", name: "Staffing Agencies", blurb: "Delivery capacity for agencies and RPO." },
      { slug: "consulting", name: "Consulting", blurb: "Practice growth and delivery." },
      { slug: "tech", name: "Technology", blurb: "Talent for tech organisations." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Can you hire recruiters for specific verticals?", a: "Yes. Recruiter rubrics are calibrated by vertical — tech, GTM, corporate — with named ATS and sourcing platforms." },
      { q: "How do you handle CPO and head-of-people searches?", a: "Leader rubrics weight organisation design, comp philosophy, board reporting and prior stage exposure." },
      { q: "Do you cover comp & ben and total-rewards hires?", a: "Yes. Total rewards is a distinct rubric family with survey participation, comp-cycle ownership and equity-plan work as signals." },
      { q: "Can you support L&D and enablement hires?", a: "Yes. L&D rubrics reward programme portfolios, delivery formats and adoption evidence." },
      { q: "How do you support DEI hires responsibly?", a: "DEI role scope, budget and named programme outcomes are captured explicitly. We do not caricature the discipline — the rubric is programme-first." },
    ],
    cta: { title: "Hiring for the people team?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "staffing-agencies",
    eyebrow: "Staffing Agencies",
    name: "Staffing Agencies",
    category: "People & Advisory",
    aliases: ["Recruitment Agencies", "Staffing Firms", "RPO", "Search Firms", "MSP"],
    summary:
      "A delivery layer for staffing agencies — sourcing capacity, client delivery, recruiter productivity and multi-role demand support, without hiding the brand.",
    meta: {
      title: "Staffing agency delivery — TaaSFlow",
      description:
        "TaaSFlow as a delivery engine for staffing agencies and RPO providers. Ranked, evidence-based shortlists your recruiters can present under their own brand.",
    },
    hero: {
      title: "A delivery layer for staffing agencies, RPO and search firms.",
      subtitle:
        "A workspace per client mandate, so your recruiters spend their time on clients, not shortlisting.",
    },
    challenges: [
      { title: "Recruiter capacity", body: "Every recruiter has a ceiling on active searches. Our workspace absorbs the intake, scoring and ranking work so recruiters run more mandates without dropping quality." },
      { title: "Consistent quality across desks", body: "Different recruiters shortlist differently. A shared rubric per mandate keeps quality consistent across desks and hand-offs." },
      { title: "Client-ready output", body: "Shortlists arrive with evidence tied to the CV, ready to present. Recruiters spend less time formatting profiles and more time closing." },
      { title: "Multi-role demand support", body: "Concurrent mandates for the same client or vertical share intake artefacts and calibration, without merging their shortlists." },
    ],
    solutions: [
      { title: "One workspace per client mandate", body: "Client identity, seat definition, rubric and shortlist all live in a single, auditable place." },
      { title: "Recruiter-productivity uplift", body: "Structured intake, automated evidence extraction and ranked shortlists remove the mechanical steps." },
      { title: "Pipeline support for volume desks", body: "Concurrent searches — perm, contract, RPO pods — supported with shared calibration." },
      { title: "White-label options only when approved", body: "White-label output is available on approved plans only — not a default assumption." },
    ],
    roleFamilies: [
      { name: "Delivery desks", blurb: "Contingent, retained and executive-search desks.", roles: ["Contingent perm desks", "Retained search desks", "Executive search practices", "Boutique vertical desks"] },
      { name: "Contract & interim", blurb: "Contract, interim and day-rate desks.", roles: ["Contract recruitment desks", "Interim management desks", "Statement-of-work delivery pods"] },
      { name: "RPO & MSP", blurb: "Managed programmes for enterprise clients.", roles: ["RPO delivery pods", "RPO leaders and account directors", "MSP delivery teams", "Programme managers"] },
      { name: "Sourcing capacity", blurb: "Sourcers, researchers and talent research.", roles: ["Sourcers", "Talent researchers", "Market mapping specialists"] },
      { name: "Client delivery leadership", blurb: "Practice leaders and account directors.", roles: ["Practice leaders", "Account directors", "Delivery managers"] },
      { name: "Candidate pipeline support", blurb: "Pipeline analysts and coordinators.", roles: ["Recruiting coordinators", "Pipeline analysts", "Candidate care specialists"] },
    ],
    roles: [
      "Contingent and retained desks",
      "Executive search practices",
      "Perm recruitment teams",
      "Contract and interim desks",
      "RPO delivery pods",
      "Vertical-specialist boutiques",
      "MSP delivery teams",
      "Talent research and sourcing teams",
    ],
    candidateSignals: [
      { title: "Desk type & margin", body: "Contingent, retained, executive, RPO — with fee model captured." },
      { title: "Vertical specialism", body: "Named client sectors and role families." },
      { title: "Delivery discipline", body: "Time-to-shortlist, offers made, offers accepted history." },
      { title: "Team leverage", body: "Recruiters managed, pods run, revenue owned." },
    ],
    skills: ["Client management", "Requisition intake", "Sourcing at scale", "Candidate assessment", "Offer negotiation", "Contract lifecycle", "Delivery leadership"],
    tools: ["Bullhorn", "Vincere", "Salesforce (Talent)", "Loxo", "Greenhouse", "LinkedIn Recruiter", "SourceWhale", "hireEZ", "Textkernel"],
    certifications: ["AIRS certifications", "REC / APSCo qualifications (UK)", "NPAworldwide"],
    signals: ["One workspace per client mandate", "Rubric per requisition, applied consistently", "Human review before candidates go to client"],
    relatedIndustries: [
      { slug: "human-resources", name: "Human Resources", blurb: "In-house TA and people teams." },
      { slug: "consulting", name: "Consulting", blurb: "Advisory practices with delivery leverage." },
      { slug: "tech", name: "Technology", blurb: "Tech-vertical staffing desks." },
    ],
    resources: [
      { title: "Staffing Partnership programme", kind: "Programme", to: "/partnerships/staffing", description: "The strategic partnership for agencies — TaaSFlow as delivery layer plus commercial alignment." },
      { title: "How TaaSFlow works", kind: "Product", to: "/how-it-works", description: "The full workflow, end to end." },
      { title: "Pricing", kind: "Pricing", to: "/pricing" },
    ],
    faqs: [
      { q: "How is this different from the Staffing Partnership page?", a: "This is the industry overview — TaaSFlow as a delivery layer for staffing firms. The Staffing Partnership page is the commercial programme with agency-specific terms, revenue share and joint-brand options." },
      { q: "Do you white-label the output?", a: "Only on approved plans — never as a default assumption. Standard delivery keeps TaaSFlow visible in the workspace and evidence trail." },
      { q: "How do you keep quality consistent across desks?", a: "One rubric per client requisition, applied consistently and reviewed by a human before publication — regardless of which recruiter is running the desk." },
      { q: "Can you support contract and interim desks?", a: "Yes. Contract-specific rubrics capture rate model, IR35/AWR context and day-rate history." },
      { q: "Do you support RPO and MSP delivery pods?", a: "Yes. Multi-role concurrent mandates share calibration, with workspace-level access controls." },
    ],
    cta: { title: "Running a staffing desk?", description: "Submit a live mandate — see the workspace, the rubric and the reviewed shortlist end-to-end." },
  },

  {
    slug: "consulting",
    eyebrow: "Consulting",
    name: "Consulting",
    category: "People & Advisory",
    aliases: ["Management Consulting", "Strategy", "Transformation", "Implementation", "Advisory"],
    summary:
      "Management consulting, strategy, transformation, implementation and domain expertise — sourced with practice-specific rubrics and outcome-based scoring.",
    meta: {
      title: "Consulting hiring — TaaSFlow",
      description:
        "Consultants, analysts, engagement leaders and implementation specialists for firms and advisory practices — sourced through structured rubrics and outcome-based scoring.",
    },
    hero: {
      title: "Extend your delivery capacity without diluting your standard.",
      subtitle:
        "Structured intake per engagement, rubrics per practice and level, and evidence of outcomes delivered.",
    },
    challenges: [
      { title: "Every engagement type wants a different profile", body: "Strategy, operations, technology and change work each favour different backgrounds. Rubrics are calibrated per practice so the shortlist matches the engagement, not just the title." },
      { title: "Consulting CVs read alike", body: "Case-count and firm names look similar on paper. Our scoring extracts specific evidence: the industries served, the problems owned, the outcomes delivered." },
      { title: "Leverage without losing quality", body: "The whole point is more capacity at your standard. Every candidate we surface is reviewed against your rubric before publication — no unranked pipes." },
      { title: "Project-based delivery vs long tenure", body: "Independent consultants, alumni networks and traditional firm tracks are captured separately so shortlists match the delivery model." },
    ],
    solutions: [
      { title: "Practice-mapped rubrics", body: "Strategy, operations, technology, change and industry practices scored separately with practice-specific evidence." },
      { title: "Outcome extraction from the CV", body: "Named outcomes — margin unlocked, transformation delivered, systems implemented — surfaced with the CV line." },
      { title: "Level-appropriate scoring", body: "Analyst, associate, engagement manager, principal and partner tracks each have distinct evidence expectations." },
      { title: "Independent and firm tracks", body: "Independent-consultant, alumni and firm-tenure profiles all scored on the evidence their track rewards." },
    ],
    roleFamilies: [
      { name: "Management consulting", blurb: "Generalist management-consulting profiles.", roles: ["Analysts and associates", "Engagement managers", "Principals", "Partners"] },
      { name: "Strategy", blurb: "Strategy specialists and heads of strategy.", roles: ["Strategy consultants", "Corporate strategists", "Strategy directors", "Heads of strategy"] },
      { name: "Transformation", blurb: "Business, digital and operating-model transformation.", roles: ["Transformation managers", "Change management leads", "Programme directors", "Operating-model specialists"] },
      { name: "Implementation", blurb: "Systems, process and technology implementation.", roles: ["ERP implementation consultants", "CRM implementation consultants", "Data and analytics implementation leads", "Cloud transformation leads"] },
      { name: "Domain expertise", blurb: "Industry-specialist consultants.", roles: ["FS domain specialists", "Healthcare consultants", "Public-sector consultants", "Retail and CPG specialists"] },
      { name: "Project-based delivery", blurb: "Independent consultants and interim experts.", roles: ["Independent consultants", "Interim experts", "Fractional advisors"] },
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
      "Independent consultants and fractional experts",
    ],
    candidateSignals: [
      { title: "Practice concentration", body: "Time within a single practice line with the specific engagement types." },
      { title: "Client and industry", body: "Named clients (where permitted), industries served and geographies." },
      { title: "Outcome ownership", body: "Named engagements with outcomes: margin, cost, revenue, adoption." },
      { title: "Level trajectory", body: "Progression pace and named case-team leadership." },
      { title: "Delivery model", body: "Firm, independent, fractional or embedded — captured explicitly." },
    ],
    skills: ["Case structuring", "Executive communication", "Financial modelling", "Change management", "Programme management", "Facilitation", "Data-driven decision support"],
    tools: ["Excel / PowerPoint at partner standard", "Alteryx", "Tableau", "Power BI", "Miro", "Jira", "Asana", "ERP and CRM platforms in scope"],
    certifications: ["MBA (top-tier where relevant)", "PMP", "PRINCE2", "Scaled Agile (SAFe)", "Six Sigma Green / Black Belt"],
    signals: ["Rubric per practice and level", "Outcome evidence from the CV", "Human review before publication"],
    relatedIndustries: [
      { slug: "human-resources", name: "Human Resources", blurb: "People-team hiring inside consulting firms." },
      { slug: "finance", name: "Finance", blurb: "Deal, FDD and transformation advisory." },
      { slug: "tech", name: "Technology", blurb: "Technology consultants and implementation." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover strategy and implementation separately?", a: "Yes. Strategy and implementation are distinct rubric families — strategy weights case leadership and structured thinking; implementation weights systems delivery and change adoption." },
      { q: "Can you hire independent consultants and fractional experts?", a: "Yes. Independent tracks are captured separately with day-rate and engagement-history evidence." },
      { q: "Do you support partner-track hires?", a: "Yes. Partner and principal searches use leadership-specific rubrics with book-of-business, client relationships and practice-building evidence." },
      { q: "How do you handle industry-specialist searches?", a: "Industry concentration is a first-class filter — FS, healthcare, public sector and retail specialists scored on their vertical evidence." },
      { q: "Can you scale multiple concurrent searches?", a: "Yes. Multi-role, multi-practice mandates share calibration without merging shortlists." },
    ],
    cta: { title: "Scaling a consulting practice?", description: "Submit the role — one workspace, one rubric, one accountable delivery team." },
  },

  // ============================================================
  // BATCH 6 — Construction, Real Estate, Manufacturing
  // ============================================================
  {
    slug: "construction",
    eyebrow: "Construction",
    name: "Construction",
    category: "Built Environment & Industrial",
    aliases: ["Contractors", "Subcontractors", "Site Management", "Civil Engineering", "Building"],
    summary:
      "Project management, engineering, safety, commercial and site-leadership hiring — with project-type, delivery-method and location context.",
    meta: {
      title: "Construction hiring — TaaSFlow",
      description:
        "Structured sourcing for general contractors, subcontractors and owner-builders. Ranked shortlists with evidence of project type, delivery method, safety and location.",
    },
    hero: {
      title: "Construction hiring, tuned per project type, delivery method and location.",
      subtitle:
        "Field, project, preconstruction, commercial and safety hires, scored on project type, delivery method and trade scope.",
    },
    challenges: [
      { title: "Project-type fit", body: "Commercial, industrial, infrastructure and residential each demand different signal. The rubric captures the project types the candidate has actually delivered." },
      { title: "Delivery method and role", body: "Design-build, CM-at-risk, design-bid-build and IPD change the role. Delivery model is captured in intake so shortlists reflect it." },
      { title: "Field vs office context", body: "Superintendents, PMs and preconstruction leaders reward different evidence. Rubrics per seat surface what the CV actually shows about scope and ownership." },
      { title: "Location-dependent hiring", body: "Construction is site-specific. Location, mobility and travel tolerance are structured intake fields, not free-text notes." },
    ],
    solutions: [
      { title: "Project-type rubrics", body: "Commercial, industrial, healthcare, education, residential and infrastructure scored separately." },
      { title: "Delivery-method calibration", body: "Design-build, CM-at-risk, DBB and IPD graded with the artefacts each method produces." },
      { title: "Field and office tracks", body: "Superintendents, PMs, engineers, estimators and safety leaders scored on the evidence their seat rewards." },
      { title: "Location-aware shortlists", body: "Site location, mobility and per-diem eligibility captured as filters." },
    ],
    roleFamilies: [
      { name: "Project management", blurb: "PMs, senior PMs and programme leadership.", roles: ["Project engineers", "Assistant project managers", "Project managers", "Senior project managers"] },
      { name: "Engineering & preconstruction", blurb: "Design, estimating and preconstruction.", roles: ["Design managers", "Preconstruction managers", "Estimators", "MEP coordinators"] },
      { name: "Safety", blurb: "Site safety leadership.", roles: ["Site safety officers", "Safety managers", "Regional safety directors"] },
      { name: "Commercial", blurb: "Contracts, cost and commercial.", roles: ["Quantity surveyors", "Commercial managers", "Contract administrators", "Cost engineers"] },
      { name: "Site leadership", blurb: "Field-side production leadership.", roles: ["Foremen and general foremen", "Superintendents", "General superintendents", "Area managers"] },
      { name: "Location-dependent field", blurb: "Roles tied to specific project locations.", roles: ["Travelling superintendents", "Regional PMs", "Field engineers on remote sites"] },
    ],
    roles: [
      "Project managers and senior PMs",
      "Superintendents and general superintendents",
      "Preconstruction managers and estimators",
      "Project engineers",
      "Field engineers",
      "Safety managers",
      "Schedulers and planners",
      "Construction operations leads",
    ],
    candidateSignals: [
      { title: "Project portfolio", body: "Named projects with value, type, delivery method and role." },
      { title: "Delivery method exposure", body: "Design-build, CM-at-risk, DBB, IPD explicitly captured." },
      { title: "Safety record where evidenced", body: "OSHA/HSE hours logged, incident history where offered — with source line." },
      { title: "Systems footprint", body: "Procore, Autodesk Construction Cloud, Primavera P6 — production years." },
      { title: "Location tolerance", body: "Willing site geography and mobility captured as intake fields." },
    ],
    skills: ["Project planning", "Scheduling (P6)", "Cost control", "Contract administration", "Coordination", "MEP knowledge", "Constructability review"],
    tools: ["Procore", "Autodesk Construction Cloud", "Primavera P6", "Microsoft Project", "Bluebeam", "PlanGrid", "Revit", "SAP for construction"],
    certifications: ["OSHA 30 (US)", "SMSTS / SSSTS (UK)", "CSCS card (UK)", "PMP", "LEED AP", "PE licensure (US)"],
    regulatedRequirements: [
      "Safety qualifications (OSHA, SMSTS/SSSTS) captured verbatim from the CV",
      "PE licensure captured where relevant — not asserted by us",
      "Trade cards and unions captured as structured signals",
    ],
    signals: ["Project-type and delivery-method rubric", "Trade and scope captured in intake", "Location dependency captured"],
    relatedIndustries: [
      { slug: "real-estate", name: "Real Estate", blurb: "Developers and owner clients." },
      { slug: "manufacturing", name: "Manufacturing", blurb: "Industrial construction and plant work." },
      { slug: "public-sector", name: "Public Sector", blurb: "Infrastructure and public works." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you verify safety qualifications?", a: "No — we surface what the CV states as structured signals so your compliance team can verify through the appropriate primary source." },
      { q: "Can you hire for infrastructure and heavy-civil projects?", a: "Yes. Project-type is a first-class filter — buildings, infrastructure, industrial and heavy-civil scored separately." },
      { q: "How do you handle superintendents that travel?", a: "Mobility and travel tolerance are captured as intake fields and applied as filters." },
      { q: "Do you cover subcontractors and specialty trades?", a: "Yes. Trade specialism is captured so shortlists match the MEP, structural or fit-out scope." },
      { q: "Can you hire for public-sector programmes?", a: "Yes. Framework and procurement environment are captured alongside project experience." },
    ],
    cta: { title: "Hiring for a construction seat?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "real-estate",
    eyebrow: "Real Estate",
    name: "Real Estate",
    category: "Built Environment & Industrial",
    aliases: ["Property", "CRE", "Commercial Real Estate", "Development", "Asset Management", "Brokerage"],
    summary:
      "Development, property management, asset management, brokerage, facilities and commercial real estate — with asset-class and lifecycle-stage precision.",
    meta: {
      title: "Real estate hiring — TaaSFlow",
      description:
        "Structured sourcing for owners, developers, operators and real-estate services firms. Ranked shortlists with evidence of asset class, market, lifecycle stage and CRE experience.",
    },
    hero: {
      title: "Real estate hiring, calibrated per asset class and market.",
      subtitle:
        "Investment, development, operations and brokerage hires, scored per asset class and lifecycle stage.",
    },
    challenges: [
      { title: "Asset-class precision", body: "Office, industrial, multifamily, retail and specialty each need distinct signal. The rubric captures the asset classes actually worked on and portfolio scale." },
      { title: "Lifecycle-stage fit", body: "Acquisitions, development, operations and dispositions reward different skills. Lifecycle stage is captured in intake so shortlists reflect it." },
      { title: "Market and geography", body: "Real estate is local. Market coverage is captured as a first-class filter rather than a free-text note." },
      { title: "Commercial vs residential", body: "CRE and residential have different underwriting, leasing and management conventions — never merged in scoring." },
    ],
    solutions: [
      { title: "Asset-class-mapped rubrics", body: "Office, industrial, multifamily, retail, hospitality, healthcare and specialty scored separately." },
      { title: "Lifecycle-aware scoring", body: "Acquisitions, development, operations, asset management and disposition graded on the artefacts each stage produces." },
      { title: "Market-specific evidence", body: "Named MSAs, submarkets and international markets captured as structured signals." },
      { title: "Investor-relations and capital tracks", body: "Capital markets, JV and fund-side hires scored on capital raised, LP relations and deal experience." },
    ],
    roleFamilies: [
      { name: "Development", blurb: "Ground-up and value-add development.", roles: ["Development managers", "Senior development managers", "Development directors", "Heads of development"] },
      { name: "Property management", blurb: "Multi-family, commercial and mixed-use PM.", roles: ["Property managers", "Regional property managers", "Portfolio property directors"] },
      { name: "Asset management", blurb: "Portfolio-level performance and strategy.", roles: ["Asset managers", "Senior asset managers", "Heads of asset management"] },
      { name: "Brokerage", blurb: "Investment sales, leasing and capital markets.", roles: ["Investment sales brokers", "Leasing brokers", "Capital markets brokers", "Tenant reps"] },
      { name: "Facilities", blurb: "Facilities and workplace operations.", roles: ["Facilities managers", "Workplace experience managers", "Building engineers"] },
      { name: "Commercial real estate finance", blurb: "CRE debt, underwriting and analytics.", roles: ["CRE underwriters", "Debt originators", "Real-estate analysts", "REIT portfolio analysts"] },
    ],
    roles: [
      "Acquisitions and investments",
      "Development and construction management",
      "Asset managers",
      "Property and facilities managers",
      "Portfolio finance and analysts",
      "Leasing and brokerage",
      "Real-estate operations leads",
      "Capital markets and debt specialists",
    ],
    candidateSignals: [
      { title: "Asset-class portfolio", body: "Named assets/portfolios with GLA, units or value." },
      { title: "Lifecycle stage exposure", body: "Acquisitions, entitlements, construction, stabilisation, disposition — with role." },
      { title: "Market coverage", body: "MSAs and submarkets with tenure." },
      { title: "Capital and JV history", body: "Capital raised, JV structures, LP relationships." },
      { title: "Leasing outcomes", body: "Square feet leased, comps set, occupancy delivered." },
    ],
    skills: ["Underwriting", "Discounted cash flow modelling", "Argus modelling", "Entitlements", "Leasing strategy", "Asset strategy", "Debt structuring", "Portfolio analytics"],
    tools: ["Argus Enterprise", "Yardi", "MRI", "RealPage", "VTS", "CoStar", "REIS", "Excel at underwriting-standard"],
    certifications: ["CCIM", "MAI", "CFA (for capital markets)", "RICS", "LEED AP", "BOMA-certified property manager"],
    regulatedRequirements: [
      "Brokerage licensing captured verbatim from the CV — never asserted by us",
      "REIT compliance exposure where relevant",
      "Property-specific safety and licensure captured",
    ],
    signals: ["Asset-class rubric per requisition", "Lifecycle stage captured in intake", "Market coverage as a first-class filter"],
    relatedIndustries: [
      { slug: "construction", name: "Construction", blurb: "Contractors and construction management." },
      { slug: "finance", name: "Finance", blurb: "CRE debt and capital markets." },
      { slug: "hospitality", name: "Hospitality and Events", blurb: "Hospitality asset class." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover both institutional and private capital?", a: "Yes. Ownership context is captured in intake — institutional funds, private equity, family office, REITs — and drives the rubric." },
      { q: "Can you hire across asset classes in a single search?", a: "We recommend one rubric per asset class. Multi-asset generalist roles are supported but graded explicitly against blended evidence." },
      { q: "Do you support international CRE hiring?", a: "Yes. Market and jurisdiction are captured in intake." },
      { q: "How do you handle brokerage licensing?", a: "Licensing claims are captured as structured signals from the CV — verified by your compliance team through the appropriate primary source." },
      { q: "Can you hire for facilities and workplace roles?", a: "Yes. Facilities and workplace experience roles get a dedicated rubric family focused on portfolio scope and service model." },
    ],
    cta: { title: "Hiring in real estate?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },

  {
    slug: "manufacturing",
    eyebrow: "Manufacturing",
    name: "Manufacturing",
    category: "Built Environment & Industrial",
    aliases: ["Industrial", "Operations", "Plant Management", "Supply Chain", "Quality", "Maintenance"],
    summary:
      "Engineering, operations, quality, maintenance, supply chain and plant leadership hiring — with product-type, process and plant-scale evidence.",
    meta: {
      title: "Manufacturing hiring — TaaSFlow",
      description:
        "Structured sourcing for manufacturers: engineering, operations, quality, maintenance, supply chain and plant leadership. Ranked shortlists with product-type, process and plant-scale evidence.",
    },
    hero: {
      title: "Manufacturing hiring, calibrated per product, process and plant scale.",
      subtitle:
        "Engineering, operations, quality and plant leadership hires, scored on product type, process and plant scale.",
    },
    challenges: [
      { title: "Product and process fit", body: "Discrete, process, high-mix / low-volume and high-volume manufacturing each need distinct signal. Product type and process are captured in intake." },
      { title: "Plant scale and scope", body: "Ownership at a 50-person cell is not the same as a 2,000-person plant. Plant scope is captured as first-class evidence." },
      { title: "Systems, methods and standards", body: "Lean, Six Sigma, TPS and ISO exposure are captured as structured signals with the artefacts each method produces." },
      { title: "Location and shift patterns", body: "Site-specific hiring, shift work and travel-heavy roles are captured explicitly in intake." },
    ],
    solutions: [
      { title: "Product-and-process rubrics", body: "Discrete, process, semiconductor, automotive, aerospace, F&B and pharma scored separately." },
      { title: "Plant-scale calibration", body: "Rubrics per plant size — small-lot, mid-size and heavy manufacturing evaluated on the artefacts that fit their scale." },
      { title: "Method-fluency scoring", body: "Lean, TPS, Six Sigma, TPM captured with the projects and outcomes that prove application." },
      { title: "Systems-aware shortlists", body: "SAP PP/PM, Oracle EBS, MES, PLM (Windchill, Teamcenter) exposure surfaced with production years." },
    ],
    roleFamilies: [
      { name: "Engineering", blurb: "Manufacturing, process and product engineering.", roles: ["Manufacturing engineers", "Process engineers", "Product engineers", "Industrial engineers"] },
      { name: "Operations", blurb: "Production leadership and plant operations.", roles: ["Production supervisors", "Production managers", "Operations directors", "Plant COOs"] },
      { name: "Quality", blurb: "QMS, quality engineering and inspection.", roles: ["Quality engineers", "Quality managers", "QMS specialists", "Supplier quality engineers"] },
      { name: "Maintenance & reliability", blurb: "Maintenance, reliability and TPM.", roles: ["Maintenance technicians", "Reliability engineers", "Maintenance managers", "Predictive-maintenance analysts"] },
      { name: "Supply chain", blurb: "Planning, procurement and logistics inside manufacturing.", roles: ["Supply planners", "Buyers and category managers", "Materials managers", "Logistics leads"] },
      { name: "Plant leadership", blurb: "Plant managers and manufacturing directors.", roles: ["Plant managers", "General managers", "Manufacturing directors", "VPs manufacturing"] },
    ],
    roles: [
      "Manufacturing and process engineers",
      "Quality engineers and managers",
      "Maintenance and reliability engineers",
      "Supply planners and materials managers",
      "Production supervisors and managers",
      "Plant managers and directors",
      "Continuous improvement leads",
      "EHS specialists",
    ],
    candidateSignals: [
      { title: "Product and process", body: "Named products, processes and industries served." },
      { title: "Plant scope", body: "Headcount, output volume and shifts owned." },
      { title: "Method application", body: "Lean, Six Sigma, TPM and Kaizen projects with outcomes." },
      { title: "Regulated environment", body: "cGMP, ISO 9001/13485/14001/45001, IATF 16949, AS9100 exposure captured verbatim." },
      { title: "Systems and stack", body: "SAP PP/PM, Oracle EBS, MES, PLM systems with production years." },
    ],
    skills: ["Lean manufacturing", "Six Sigma", "TPM", "Kaizen", "SPC", "Root-cause analysis", "APQP / PPAP", "Value-stream mapping", "OEE improvement"],
    tools: ["SAP PP/PM", "Oracle EBS", "Rockwell / Siemens PLCs", "MES", "PLM (Windchill, Teamcenter)", "Minitab", "AutoCAD", "SolidWorks"],
    certifications: ["Six Sigma Green / Black Belt", "Lean certifications", "CMRP", "CQE / CQM (ASQ)", "APICS CPIM / CSCP", "ISO auditor qualifications"],
    regulatedRequirements: [
      "cGMP for pharma / medical manufacturing",
      "AS9100 for aerospace",
      "IATF 16949 for automotive",
      "ISO 13485 for medical devices",
      "Food safety (FSMA / HACCP) for F&B",
    ],
    signals: ["Product and process rubric per role", "Plant scale captured in intake", "Methods and standards evidenced from the CV"],
    relatedIndustries: [
      { slug: "logistics", name: "Logistics and Supply Chain", blurb: "Distribution, transportation and supply planning." },
      { slug: "construction", name: "Construction", blurb: "Industrial construction and plant expansion." },
      { slug: "tech", name: "Technology", blurb: "Automation, MES and Industry 4.0." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you separate discrete and process manufacturing?", a: "Yes. Discrete, process, continuous and hybrid manufacturing get distinct rubrics reflecting their planning, quality and engineering realities." },
      { q: "How do you handle regulated manufacturing?", a: "Regulated exposure — cGMP, AS9100, IATF 16949, ISO 13485 — is captured as a structured signal with the CV line quoted for your team to verify." },
      { q: "Can you hire plant managers?", a: "Yes. Plant-manager rubrics weight plant scope, safety record, cost/output outcomes and organisational leadership." },
      { q: "Do you cover maintenance and reliability?", a: "Yes. Reliability engineering and TPM roles get a dedicated rubric focused on MTBF/MTTR, predictive-maintenance programmes and asset criticality analysis." },
      { q: "Can you support continuous-improvement hiring?", a: "Yes. CI rubrics weight belt certifications alongside project portfolios and quantified savings." },
    ],
    cta: { title: "Hiring for a manufacturing seat?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // BATCH 7 — Hospitality & Events, Retail, Logistics & Supply Chain
  // ============================================================
  {
    slug: "hospitality",
    eyebrow: "Hospitality and Events",
    name: "Hospitality and Events",
    category: "Consumer & Operations",
    aliases: ["Hotels", "Restaurants", "F&B", "Events", "Guest Experience", "Hospitality Groups"],
    summary:
      "Hotels, food and beverage, guest experience, events, multi-location operations and seasonal demand — with property-type and service-level precision.",
    meta: {
      title: "Hospitality & events hiring — TaaSFlow",
      description:
        "Structured sourcing for hotels, restaurants, F&B groups and event operators. Ranked shortlists with evidence of property type, service level, event format and multi-location operations.",
    },
    hero: {
      title: "Hospitality and events hiring, calibrated per property and format.",
      subtitle:
        "Property leadership, F&B, guest experience and events hires, scored on property type, service level and seasonality.",
    },
    challenges: [
      { title: "Property, segment and format fit", body: "Luxury, lifestyle, select-service, F&B-led and events operations each need distinct signal. Property/format is captured explicitly." },
      { title: "Service level and standards", body: "Cover counts, service standards and guest-experience expectations vary widely. Standards are captured in intake so shortlists reflect operating reality." },
      { title: "Multi-location and seasonal demand", body: "Multi-unit and seasonal operations reward specific evidence — flexing capacity, opening properties, running seasonal peaks — captured as structured signals." },
      { title: "Events-specific delivery", body: "Corporate, brand, wedding, festival and MICE events each have distinct workflows. Event format is captured as its own rubric axis." },
    ],
    solutions: [
      { title: "Property-and-format rubrics", body: "Luxury, lifestyle, select-service, resort, restaurant groups and event operators scored separately." },
      { title: "Service-standard scoring", body: "Forbes, AAA, LQA and internal-standard exposure captured with named properties." },
      { title: "Multi-unit and seasonal calibration", body: "Multi-unit and seasonal ownership graded on properties, covers and revenue at peak." },
      { title: "Event-format rubrics", body: "Corporate, brand experiential, weddings, festivals and MICE each scored on format-specific evidence." },
    ],
    roleFamilies: [
      { name: "Hotels", blurb: "Property leadership and hotel operations.", roles: ["General managers", "Hotel managers", "Rooms division managers", "Revenue managers"] },
      { name: "Food & beverage", blurb: "Restaurants, bars and F&B outlets.", roles: ["Executive chefs", "Head chefs", "Restaurant managers", "F&B directors"] },
      { name: "Guest experience", blurb: "Front of house and guest experience.", roles: ["Front office managers", "Guest experience managers", "Concierge leaders", "Brand experience leads"] },
      { name: "Events", blurb: "Event producers and event operations.", roles: ["Event producers", "Event managers", "Conference operations managers", "Wedding and MICE specialists"] },
      { name: "Multi-location operations", blurb: "Regional and multi-unit operators.", roles: ["Area managers", "Regional operations directors", "VP operations", "COO / Head of operations"] },
      { name: "Seasonal & venue operations", blurb: "Seasonal peaks and venue teams.", roles: ["Venue managers", "Seasonal operations leads", "Site production managers"] },
    ],
    roles: [
      "General managers and hotel managers",
      "Executive chefs and F&B directors",
      "Restaurant and outlet managers",
      "Event producers and managers",
      "Revenue and reservations leaders",
      "Guest experience and brand leaders",
      "Multi-unit operations directors",
      "Hospitality HR and training leads",
    ],
    candidateSignals: [
      { title: "Property portfolio", body: "Named properties/formats with segment and scale." },
      { title: "Service standards", body: "Forbes, AAA, LQA or brand standards evidenced from named properties." },
      { title: "Financial ownership", body: "Revenue, RevPAR, cover counts and cost control." },
      { title: "Event portfolio", body: "Named events, audience size, format and role." },
      { title: "Multi-unit scope", body: "Number of properties, geography and lifecycle stage (opening, stabilised, turnaround)." },
    ],
    skills: ["Revenue management", "F&B P&L", "Menu engineering", "Guest experience design", "Event production", "Venue operations", "Staffing and rostering", "Multi-unit leadership"],
    tools: ["Opera PMS", "Cloudbeds", "Sabre", "Toast", "Lightspeed Restaurant", "OpenTable", "Cvent", "Aventri", "Eventbrite"],
    certifications: ["CHA (Certified Hotel Administrator)", "CFBE (F&B)", "CSEP (Special Events)", "AH&LA certifications", "WSET for wine roles"],
    regulatedRequirements: [
      "Food safety qualifications (HACCP, ServSafe, Level 3+ UK) captured verbatim",
      "Alcohol licensing captured where relevant",
      "Event and venue-specific health & safety compliance captured",
    ],
    signals: ["Property/format rubric per role", "Service standards captured in intake", "Multi-unit and seasonal scope evidenced"],
    relatedIndustries: [
      { slug: "real-estate", name: "Real Estate", blurb: "Hospitality real estate and asset management." },
      { slug: "retail", name: "Retail", blurb: "Multi-location consumer operations." },
      { slug: "media", name: "Media", blurb: "Live production and creative for events." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover both hotels and restaurants?", a: "Yes, with distinct rubrics. Hotel rubrics weight rooms division, revenue and brand-standard operation; restaurant rubrics weight covers, menu and F&B P&L." },
      { q: "Can you hire for event operators and venues?", a: "Yes. Event and venue roles get their own rubric family with format-specific evidence." },
      { q: "How do you handle seasonal roles?", a: "Seasonality is captured in intake — resort peaks, festival seasons, holiday spikes — and factored into rubric weighting." },
      { q: "Do you cover multi-unit operators?", a: "Yes. Multi-unit operators are scored on portfolio scope, opening/turnaround experience and regional leadership." },
      { q: "Can you support luxury and lifestyle brands?", a: "Yes. Segment and brand standards are captured as first-class filters." },
    ],
    cta: { title: "Hiring for a hospitality role?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "retail",
    eyebrow: "Retail",
    name: "Retail",
    category: "Consumer & Operations",
    aliases: ["Store Operations", "Merchandising", "Buying", "Retail Leadership", "Omnichannel"],
    summary:
      "Store operations, ecommerce, merchandising, buying and retail leadership — with multi-location and omnichannel evidence captured explicitly.",
    meta: {
      title: "Retail hiring — TaaSFlow",
      description:
        "Structured sourcing for retailers and multi-location operators. Ranked shortlists with evidence of store operations, ecommerce, merchandising, buying and retail leadership across brick-and-mortar and omnichannel.",
    },
    hero: {
      title: "Retail hiring, calibrated per format, category and channel mix.",
      subtitle:
        "Store operations, ecommerce, merchandising and buying hires, scored on format, category and channel mix.",
    },
    challenges: [
      { title: "Format and channel fit", body: "Big-box, specialty, luxury, off-price and DTC formats each need distinct signal. Format is captured explicitly in intake." },
      { title: "Category and buying context", body: "Apparel, beauty, grocery, hardgoods and consumables have different margin, seasonality and buying rhythms. Category is a first-class filter." },
      { title: "Multi-location leadership", body: "Store leadership, district and regional roles are captured with actual footprint owned — not implied by title." },
      { title: "Omnichannel operating model", body: "Store, digital and marketplace channels intersect. Channel-mix ownership is captured as a structured signal." },
    ],
    solutions: [
      { title: "Format-and-channel rubrics", body: "Big-box, specialty, luxury, DTC, marketplace and grocery scored separately with the KPIs each format actually runs." },
      { title: "Category-aware scoring", body: "Apparel, beauty, home, food, consumer electronics and hardgoods with margin, seasonality and buying cadence." },
      { title: "Multi-location calibration", body: "Store, district, regional and VP retail roles scored on named-footprint outcomes." },
      { title: "Omnichannel coverage", body: "Digital, marketplace, wholesale and store scored together where the role owns the mix." },
    ],
    roleFamilies: [
      { name: "Store operations", blurb: "Store, district and regional operations.", roles: ["Store managers", "District managers", "Regional operations managers", "VPs store operations"] },
      { name: "Ecommerce", blurb: "Digital retail leaders and ecommerce operators.", roles: ["Ecommerce managers", "Site merchandising managers", "Ecommerce directors", "Heads of digital"] },
      { name: "Merchandising", blurb: "Planning, allocation and merchandise strategy.", roles: ["Planners", "Allocators", "Merchandise managers", "Divisional merchandise managers"] },
      { name: "Buying", blurb: "Category buyers and heads of buying.", roles: ["Assistant buyers", "Buyers", "Senior buyers", "Category directors"] },
      { name: "Retail leadership", blurb: "Regional, divisional and executive leadership.", roles: ["Regional VPs", "Divisional presidents", "COOs", "Chief retail officers"] },
      { name: "Multi-location & franchise", blurb: "Franchise and multi-location leadership.", roles: ["Franchise operations leaders", "Multi-brand operators", "Store development managers"] },
    ],
    roles: [
      "Store and district managers",
      "Regional and VP store operations",
      "Ecommerce managers and directors",
      "Buyers and category directors",
      "Merchandise planners and allocators",
      "Retail marketing leaders",
      "Loss prevention leaders",
      "Store development and expansion leads",
    ],
    candidateSignals: [
      { title: "Footprint owned", body: "Number of stores/districts and geography with tenure." },
      { title: "Category exposure", body: "Named categories with margin, seasonality and buying cadence." },
      { title: "Ecommerce outcomes", body: "Digital revenue, conversion, AOV and cohort behaviour where evidenced." },
      { title: "Multi-channel operation", body: "Channel mix owned — store, digital, marketplace, wholesale." },
      { title: "P&L ownership", body: "Revenue, margin, comps and shrink where evidenced." },
    ],
    skills: ["Store operations", "Merchandise planning", "Assortment strategy", "Buying and negotiation", "Retail P&L", "Loss prevention", "Store labour design", "Omnichannel operations"],
    tools: ["Oracle Retail", "SAP Retail", "JDA / Blue Yonder", "Shopify Plus", "Salesforce Commerce Cloud", "Adobe Commerce", "Aptos", "NetSuite Retail", "RetailNext"],
    certifications: ["NRF Retail Industry Fundamentals", "APICS CPIM for retail supply", "PMP for store development"],
    signals: ["Format and channel rubric per role", "Category and footprint captured in intake", "P&L ownership as first-class evidence"],
    relatedIndustries: [
      { slug: "ecommerce", name: "E-commerce", blurb: "DTC and marketplace-heavy retail." },
      { slug: "logistics", name: "Logistics and Supply Chain", blurb: "Retail fulfilment and distribution." },
      { slug: "hospitality", name: "Hospitality and Events", blurb: "Multi-location consumer operations." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you separate store and ecommerce roles?", a: "Yes, with distinct rubrics. Store rubrics weight operations, labour and shrink; ecommerce rubrics weight conversion, AOV and cohort behaviour." },
      { q: "Can you hire buyers and merchandise planners?", a: "Yes. Buying and planning have their own rubric family — category-specific and rewarded on assortment, margin and open-to-buy discipline." },
      { q: "How do you handle multi-brand or franchise operators?", a: "Franchise and multi-brand context is captured explicitly and scored on portfolio scope and franchise-model evidence." },
      { q: "Do you support luxury and specialty retail?", a: "Yes. Segment and brand standards are captured as filters — luxury, specialty, off-price and mass scored on distinct evidence." },
      { q: "Can you hire regional and VP-level retail leaders?", a: "Yes. Leader rubrics weight footprint, P&L, comp performance and organisational leadership." },
    ],
    cta: { title: "Hiring for a retail role?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  {
    slug: "logistics",
    eyebrow: "Logistics and Supply Chain",
    name: "Logistics and Supply Chain",
    category: "Consumer & Operations",
    aliases: ["Supply Chain", "Warehousing", "Transportation", "3PL", "Procurement", "Distribution", "Operations Leadership"],
    summary:
      "Warehousing, transportation, procurement, supply planning, distribution and operations leadership — with network scale and modal-mix evidence.",
    meta: {
      title: "Logistics & supply chain hiring — TaaSFlow",
      description:
        "Structured sourcing for shippers, carriers, 3PLs and supply chain operators. Ranked shortlists with evidence of warehousing, transportation, procurement, supply planning and distribution across scale and modal mix.",
    },
    hero: {
      title: "Logistics hiring, calibrated per network, mode and function.",
      subtitle:
        "Warehousing, transport, procurement and planning hires, scored on network scale, modal mix and operating model.",
    },
    challenges: [
      { title: "Function-specific evidence", body: "Warehousing, transportation, procurement and planning are distinct disciplines. Each gets its own rubric so shortlists match the function." },
      { title: "Network and scale", body: "Single DC, regional network and international footprint reward different signal. Network scale is captured explicitly." },
      { title: "Modal mix", body: "Road, rail, ocean, air and parcel have different operating rhythms. Modal exposure is captured as a first-class filter." },
      { title: "Operating model — shipper vs 3PL", body: "In-house operators and 3PL delivery leaders are scored on different evidence — never merged in scoring." },
    ],
    solutions: [
      { title: "Function-mapped rubrics", body: "Warehousing, transportation, procurement, planning and distribution graded separately." },
      { title: "Network-scale calibration", body: "Single-site, regional and international operators evaluated on scale-appropriate outcomes." },
      { title: "Modal-mix scoring", body: "Road, rail, ocean, air and parcel captured as structured signals — with named lanes and volumes." },
      { title: "Shipper vs 3PL tracks", body: "Distinct rubrics for shipper-side operators and 3PL delivery leaders." },
    ],
    roleFamilies: [
      { name: "Warehousing", blurb: "DC and warehouse operations.", roles: ["Warehouse supervisors", "DC managers", "Regional warehouse directors", "Heads of warehousing"] },
      { name: "Transportation", blurb: "Transport planning and management.", roles: ["Transport planners", "Transport managers", "Fleet managers", "Heads of transport"] },
      { name: "Procurement", blurb: "Category management and strategic sourcing.", roles: ["Buyers", "Category managers", "Procurement managers", "Chief procurement officers"] },
      { name: "Supply planning", blurb: "Demand, supply and S&OP.", roles: ["Demand planners", "Supply planners", "S&OP managers", "Heads of planning"] },
      { name: "Distribution", blurb: "Distribution network and last-mile.", roles: ["Distribution managers", "Network design specialists", "Last-mile operations managers"] },
      { name: "Operations leadership", blurb: "COOs and heads of supply chain.", roles: ["Supply chain directors", "VPs supply chain", "Chief supply chain officers", "COO / Head of operations"] },
    ],
    roles: [
      "Warehouse and DC managers",
      "Transportation and fleet managers",
      "Procurement and category managers",
      "Supply and demand planners",
      "S&OP leaders",
      "Distribution and network managers",
      "3PL account managers",
      "VP supply chain and CSCO",
    ],
    candidateSignals: [
      { title: "Network footprint", body: "Sites owned, geography, volume and headcount." },
      { title: "Modal exposure", body: "Road, rail, ocean, air and parcel — with named lanes where evidenced." },
      { title: "Systems fluency", body: "SAP, Oracle SCM, Manhattan, Blue Yonder, Kinaxis, WMS and TMS with production years." },
      { title: "Cost and service outcomes", body: "Cost per unit, on-time delivery, inventory turns and DIFOT where evidenced." },
      { title: "Programme delivery", body: "Network redesigns, WMS implementations, S&OP rollouts owned." },
    ],
    skills: ["Network design", "WMS operations", "TMS operations", "Category management", "S&OP", "Inventory optimisation", "Freight negotiation", "Last-mile design"],
    tools: ["SAP", "Oracle SCM", "Manhattan Associates", "Blue Yonder", "Kinaxis RapidResponse", "o9", "Coupa", "Ariba", "Descartes", "Project44"],
    certifications: ["APICS CSCP / CPIM", "CSCMP SCPro", "CIPS", "Lean Six Sigma"],
    signals: ["Function-specific rubric per role", "Network scale and modal mix captured", "Shipper vs 3PL tracks separated"],
    relatedIndustries: [
      { slug: "manufacturing", name: "Manufacturing", blurb: "Inbound supply and factory logistics." },
      { slug: "retail", name: "Retail", blurb: "Retail fulfilment and DC operations." },
      { slug: "ecommerce", name: "E-commerce", blurb: "DTC fulfilment and last-mile." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Do you cover shipper and 3PL roles?", a: "Yes, with distinct rubrics. Shipper roles are scored on internal network and cost; 3PL roles on account P&L, service delivery and commercial ownership." },
      { q: "Can you hire supply and demand planners separately?", a: "Yes. Demand planning, supply planning and S&OP each get dedicated rubrics." },
      { q: "How do you handle warehouse and DC leadership?", a: "DC leadership rubrics weight throughput, labour design, safety and cost per unit — with WMS fluency captured." },
      { q: "Do you support procurement transformation hires?", a: "Yes. Procurement roles are scored on category strategy, spend under management and named transformation outcomes." },
      { q: "Can you cover international supply chain hires?", a: "Yes. Region and modal mix are intake fields and applied as filters." },
    ],
    cta: { title: "Hiring in logistics or supply chain?", description: "Submit the role — one workspace, one rubric, one reviewed shortlist." },
  },

  // ============================================================
  // E-commerce (kept as-is)
  // ============================================================
  {
    slug: "ecommerce",
    eyebrow: "E-commerce",
    name: "E-commerce",
    category: "Consumer & Operations",
    aliases: ["DTC", "Direct to Consumer", "Online Retail", "Marketplaces"],
    summary:
      "Merchandising, growth, retention and operations hiring for online retailers and DTC brands, with channel, category and funnel ownership evidenced from the CV.",
    meta: {
      title: "E-commerce hiring — TaaSFlow",
      description:
        "Structured sourcing for online retailers and DTC brands. Ranked shortlists with evidence of channel, category and lifecycle experience.",
    },
    hero: {
      title: "E-commerce hiring, tuned per channel and category.",
      subtitle:
        "Merchandising, growth, ops and retention hires, scored per channel, category and brand stage.",
    },
    challenges: [
      { title: "Channel and marketplace fit", body: "DTC store, marketplaces, wholesale and retail media each require distinct evidence. Our rubric captures the channels actually owned and the results measured." },
      { title: "Category and margin context", body: "Apparel, beauty, home, consumables and hardgoods have different unit economics. We capture category and margin context so shortlists match your operating reality." },
      { title: "Full-funnel ownership", body: "Growth, merchandising, retention and CX often overlap. Rubrics per seat surface the specific stage of the funnel the candidate actually owned." },
      { title: "Platform and stack fluency", body: "Shopify Plus, Salesforce Commerce Cloud and headless builds each reward different operating experience. Platform history is captured so migrations aren't staffed on the wrong assumption." },
    ],
    solutions: [
      { title: "Channel-specific evidence", body: "DTC, marketplace (Amazon, Walmart), wholesale and retail-media experience are captured separately, with named platforms and revenue scope." },
      { title: "Category and margin scoring", body: "Category background and margin structure — apparel, beauty, consumables, hardgoods — are matched to the operating context of the role." },
      { title: "Funnel-stage rubrics", body: "Acquisition, conversion, retention and post-purchase CX are scored as distinct disciplines instead of one blended 'e-commerce' rubric." },
      { title: "Platform and stack matching", body: "Shopify, BigCommerce, Salesforce Commerce Cloud and headless/composable stacks are captured with production tenure, not just tool exposure." },
    ],
    roleFamilies: [
      { name: "Merchandising and buying", blurb: "Assortment, pricing and inventory decisions.", roles: ["Merchandising managers", "Buyers and planners", "Site merchandisers", "Inventory and demand planners"] },
      { name: "Growth and performance marketing", blurb: "Paid, organic and marketplace acquisition.", roles: ["Growth marketers", "Performance marketing managers", "SEO and organic leads", "Marketplace advertising specialists"] },
      { name: "Retention and lifecycle", blurb: "Post-purchase revenue and loyalty.", roles: ["Lifecycle/CRM marketers", "Retention managers", "Loyalty programme leads", "Email/SMS specialists"] },
      { name: "E-commerce operations", blurb: "Platform, fulfilment and site operations.", roles: ["E-commerce operations managers", "Platform/technical leads", "Fulfilment and logistics coordinators", "CRO and site-experience specialists"] },
      { name: "Leadership", blurb: "Cross-functional ownership of the e-commerce P&L.", roles: ["Heads of e-commerce", "VPs of digital / DTC", "General managers (channel or region)"] },
    ],
    roles: [
      "E-commerce managers and directors",
      "Merchandising and buying leads",
      "Growth and performance marketers",
      "Retention and lifecycle marketers",
      "Marketplace and channel managers",
      "E-commerce operations and fulfilment",
      "Site merchandising and CRO specialists",
      "Customer experience and support leads",
    ],
    candidateSignals: [
      { title: "Channel ownership", body: "Named channels run (DTC, Amazon, wholesale, retail media) with revenue scope and platform." },
      { title: "Category depth", body: "Category background and margin structure, matched against the hiring brand's assortment." },
      { title: "Funnel-stage evidence", body: "Acquisition, conversion, retention or CX metrics owned — CAC, AOV, LTV, repeat-purchase rate — quoted from the CV." },
      { title: "Platform and stack tenure", body: "Shopify Plus, BigCommerce, Salesforce Commerce Cloud or headless builds, with years of production ownership." },
      { title: "Peak-period delivery", body: "Evidence of operating through high-volume periods (BFCM, seasonal peaks) and the outcomes delivered." },
    ],
    skills: ["Merchandising", "Demand planning", "Performance marketing", "Lifecycle marketing", "CRO", "Marketplace management", "Unit economics"],
    tools: ["Shopify Plus", "BigCommerce", "Salesforce Commerce Cloud", "Klaviyo", "Attentive", "Google Analytics 4", "Triple Whale", "NetSuite"],
    signals: ["Channel and marketplace rubric per role", "Category and margin context captured", "Funnel-stage ownership from the CV"],
    relatedIndustries: [
      { slug: "retail", name: "Retail", blurb: "Multi-location and omnichannel retail operations." },
      { slug: "logistics", name: "Logistics and Supply Chain", blurb: "Fulfilment and last-mile delivery for online orders." },
      { slug: "marketing", name: "Marketing", blurb: "Brand and demand marketing for consumer businesses." },
    ],
    resources: DEFAULT_RESOURCES,
    faqs: [
      { q: "Can you separate DTC from marketplace experience?", a: "Yes. Channel is a first-class intake field, and DTC, Amazon/marketplace and wholesale experience are scored on their own evidence." },
      { q: "Do you account for seasonal hiring spikes?", a: "Yes. Roles tied to peak-period ramp-up move through the same days-not-weeks shortlist window as any other requisition." },
      { q: "How do you evaluate growth marketing claims?", a: "CAC, AOV, LTV and channel-specific ROAS figures are quoted from the CV with the source line, so your team can sanity-check the numbers." },
      { q: "Can you hire for a platform migration?", a: "Yes. Platform history (Shopify, BigCommerce, Salesforce Commerce Cloud, headless) is captured explicitly so migrations aren't staffed on assumed familiarity." },
    ],
    cta: { title: "Hiring in e-commerce?", description: "Submit the role — one workspace per requisition, ranked and reviewed." },
  },
];

// Batch 2 — 32 additional industries (2026-07 expansion to 57 total).
import { INDUSTRY_ENTRIES_BATCH2 } from "./industries-batch2";
INDUSTRY_ENTRIES.push(...INDUSTRY_ENTRIES_BATCH2);

export function getIndustryEntry(slug: string): IndustryEntry | undefined {
  return INDUSTRY_ENTRIES.find((e) => e.slug === slug);
}
