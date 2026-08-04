/**
 * Vertical configuration modules
 * ---------------------------------------------------------------------------
 * TaaSFlow is one platform with one architecture. A "vertical" is not a
 * separate product or a separate service page — it is a *configuration* of the
 * same objects: role families, requirement patterns, evidence types, rubric
 * weights, compliance requirements, approval controls, integrations and a
 * reusable role blueprint.
 *
 * Every value below is a configuration of something that exists in the
 * product:
 *  - rubric weights use the real dimensions and bounds from
 *    `src/lib/requisition-schema.ts` (7 dimensions, each 5–35, summing to 100)
 *  - approval controls map to shipped controls (admin approval before client
 *    visibility, separate contact release, payment gate before publishing,
 *    evidence verification, eligibility holds, undo window, audit trail)
 *  - integrations reference ids in `src/config/integrations-directory.ts`,
 *    so the UI can render each one's real availability label
 *  - blueprint examples use the field shape produced by
 *    `src/lib/blueprint-engine.server.ts`
 *
 * Nothing here is a claim about a customer, a placement or a metric. Blueprint
 * examples are labelled as examples wherever they are rendered.
 */

import {
  DEFAULT_WEIGHTS,
  WEIGHT_DIMENSIONS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type WeightKey,
} from "@/lib/requisition-schema";

export { WEIGHT_DIMENSIONS, WEIGHT_MIN, WEIGHT_MAX };
export type { WeightKey };

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Controls that exist in the product and can be switched on per workspace. */
export type ApprovalControlKey =
  | "admin_approval"
  | "contact_release"
  | "payment_gate"
  | "evidence_verification"
  | "eligibility_hold"
  | "undo_window"
  | "audit_trail"
  | "second_reviewer";

export const APPROVAL_CONTROLS: Record<
  ApprovalControlKey,
  { label: string; description: string }
> = {
  admin_approval: {
    label: "Approval before client visibility",
    description:
      "No candidate appears in a client workspace until a reviewer approves them for that specific role.",
  },
  contact_release: {
    label: "Separate contact release",
    description:
      "Seeing a candidate and seeing their contact details are two different permissions, released independently.",
  },
  payment_gate: {
    label: "Payment gate before publishing",
    description:
      "A role cannot go live until its plan or one-off purchase is settled, or an explicit exemption is recorded.",
  },
  evidence_verification: {
    label: "Evidence verification",
    description:
      "Extracted evidence is reviewable line by line, and a reviewer can confirm or reject each finding before it counts.",
  },
  eligibility_hold: {
    label: "Eligibility holds",
    description:
      "Missing licences, right-to-work or other hard requirements place a candidate on hold instead of ranking them.",
  },
  second_reviewer: {
    label: "Second reviewer on decisions",
    description:
      "High-consequence decisions can require a second named reviewer before the stage advances.",
  },
  undo_window: {
    label: "Reversible decisions",
    description:
      "Client decisions stay reversible for a short window, so a mis-click never becomes a permanent outcome.",
  },
  audit_trail: {
    label: "Full audit trail",
    description:
      "Every state change records who did it, when, and against which rubric version.",
  },
};

export type BlueprintExample = {
  /** Illustrative role title — always rendered as an example, never as a customer. */
  title: string;
  seniority: string;
  mustHaves: string[];
  dealbreakers: string[];
  screeningQuestions: string[];
};

export type VerticalConfig = {
  id: string;
  label: string;
  /** One line: what changes in this configuration. */
  summary: string;
  roleFamilies: { name: string; examples: string[] }[];
  requirementPatterns: string[];
  evidenceTypes: { label: string; detail: string }[];
  weights: Record<WeightKey, number>;
  scoringNotes: string[];
  compliance: { label: string; detail: string }[];
  approvalControls: ApprovalControlKey[];
  approvalNote: string;
  /** ids from `src/config/integrations-directory.ts` */
  integrations: string[];
  blueprint: BlueprintExample;
  /** What the intelligence layer watches most closely in this configuration. */
  intelligenceFocus: string[];
};

/* ------------------------------------------------------------------ */
/* Configurations                                                      */
/* ------------------------------------------------------------------ */

const BASE_INTEGRATIONS = ["mcp", "calendly", "transactional-email", "workspace-analytics"];

export const VERTICAL_CONFIGS: Record<string, VerticalConfig> = {
  technology: {
    id: "technology",
    label: "Engineering and product",
    summary:
      "Depth of production skill carries the rubric; credentials carry very little.",
    roleFamilies: [
      { name: "Software engineering", examples: ["Backend", "Frontend", "Full-stack", "Mobile", "Staff / principal"] },
      { name: "Platform and reliability", examples: ["SRE", "Platform", "DevOps", "Cloud architecture"] },
      { name: "Data and AI", examples: ["Data engineering", "Analytics engineering", "ML engineering", "Data science"] },
      { name: "Product and design", examples: ["Product management", "Technical PM", "Product design", "Research"] },
      { name: "Security", examples: ["Application security", "Cloud security", "Detection & response", "GRC"] },
    ],
    requirementPatterns: [
      "Named languages, frameworks and clouds with years of production use",
      "Ownership scope: services owned, on-call, incident command",
      "Scale markers: traffic, data volume, users, cost envelope",
      "Work model and timezone overlap as a first-class requirement",
    ],
    evidenceTypes: [
      { label: "Systems owned", detail: "Named services with production ownership, quoted from the CV." },
      { label: "Architecture decisions", detail: "Trade-offs stated on the CV, with the alternative rejected." },
      { label: "Scale and reliability", detail: "Latency, availability and incident numbers, not adjectives." },
      { label: "Delivery record", detail: "Shipped work with dates, scope and measurable outcome." },
    ],
    weights: { skills: 35, experience: 20, industry: 10, seniority: 15, credentials: 5, language: 5, logistics: 10 },
    scoringNotes: [
      "Skills sit at the ceiling of the allowed range because stack depth is the discriminator.",
      "Credentials sit at the floor: certifications rarely predict engineering outcomes.",
      "Adjacent stacks are scored as adjacency, with the gap stated rather than hidden.",
    ],
    compliance: [
      { label: "Security programme exposure", detail: "SOC 2, ISO 27001 or PCI-DSS scope recorded where the role touches it." },
      { label: "Data handling", detail: "GDPR-aware handling flagged for roles working on EU or UK personal data." },
      { label: "Right to work and location", detail: "Work authorisation and timezone captured as hard requirements when the role demands them." },
    ],
    approvalControls: ["admin_approval", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote:
      "Fast configuration: one reviewer, evidence verification on, no second approver on stage moves.",
    integrations: [...BASE_INTEGRATIONS, "attio", "microsoft-teams", "intake-api", "payment-webhooks"],
    blueprint: {
      title: "Senior backend engineer (example)",
      seniority: "Senior",
      mustHaves: [
        "4+ years production Go, Java or Node",
        "Owned a service in production with on-call responsibility",
        "Relational data modelling at scale",
      ],
      dealbreakers: ["No production ownership", "No overlap with the team's core hours"],
      screeningQuestions: [
        "Which production service did you own end to end, and what was its scale?",
        "Describe an architecture decision you made and the option you rejected.",
      ],
    },
    intelligenceFocus: [
      "Requirement lists that are too restrictive for the available pool",
      "Score compression when every candidate looks the same",
      "Stalled technical interview stages",
    ],
  },

  "regulated-care": {
    id: "regulated-care",
    label: "Healthcare and life sciences",
    summary:
      "Licences and registrations gate the pipeline before ranking begins.",
    roleFamilies: [
      { name: "Clinical", examples: ["Registered nurses", "Physicians", "Allied health", "Care leadership"] },
      { name: "Quality and regulatory", examples: ["QA", "QC", "Regulatory affairs", "Pharmacovigilance"] },
      { name: "Research and development", examples: ["Clinical research", "Bioprocess", "Medical affairs"] },
      { name: "Manufacturing and devices", examples: ["GMP production", "Validation", "Device engineering"] },
    ],
    requirementPatterns: [
      "Active licence or registration with issuing body and expiry",
      "Setting-specific experience (acute, community, GMP, GCP)",
      "Regulatory frameworks the candidate has worked under",
      "Shift pattern, rota and on-call availability",
    ],
    evidenceTypes: [
      { label: "Licences and registrations", detail: "Body, number reference and validity as stated on the CV." },
      { label: "Regulated setting experience", detail: "Named environments and the standards that governed them." },
      { label: "Case and caseload evidence", detail: "Patient groups, procedures, throughput or batch scope." },
      { label: "Training and revalidation", detail: "Mandatory training and revalidation history where declared." },
    ],
    weights: { skills: 20, experience: 20, industry: 15, seniority: 10, credentials: 25, language: 5, logistics: 5 },
    scoringNotes: [
      "Credentials are weighted heavily because they are legally load-bearing.",
      "A missing licence is an eligibility hold, not a low score — the candidate never ranks against qualified peers.",
      "Setting experience is scored separately from years, because five years in the wrong setting is not five years.",
    ],
    compliance: [
      { label: "Licence verification trail", detail: "Every licence claim is recorded with its source line and reviewer decision." },
      { label: "Background and clearance", detail: "Checks required by the role are captured as requirements before shortlisting." },
      { label: "Sensitive data handling", detail: "CVs stay in private storage with scoped access; contact details release separately." },
    ],
    approvalControls: [
      "admin_approval",
      "eligibility_hold",
      "evidence_verification",
      "second_reviewer",
      "contact_release",
      "undo_window",
      "audit_trail",
    ],
    approvalNote:
      "Strict configuration: eligibility holds on, second reviewer on stage moves, contact release held back until approval.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe", "payment-webhooks"],
    blueprint: {
      title: "Registered nurse — acute ward (example)",
      seniority: "Experienced",
      mustHaves: [
        "Active registration with the relevant nursing body",
        "Acute or ward-based experience in the last 24 months",
        "Mandatory training current",
      ],
      dealbreakers: ["Lapsed registration", "No recent clinical practice"],
      screeningQuestions: [
        "What is your current registration status and renewal date?",
        "Which clinical settings have you worked in over the last two years?",
      ],
    },
    intelligenceFocus: [
      "Eligibility holds caused by missing or lapsed credentials",
      "Compliance evidence gaps before interview",
      "Shift-coverage gaps in the shortlist",
    ],
  },

  "financial-services": {
    id: "financial-services",
    label: "Financial services",
    summary:
      "Domain context and regulatory footing weigh as heavily as raw skill.",
    roleFamilies: [
      { name: "Front office", examples: ["Investment banking", "Sales & trading", "Coverage", "Origination"] },
      { name: "Investment and advisory", examples: ["Private equity", "Venture capital", "Wealth management", "Research"] },
      { name: "Risk, compliance and audit", examples: ["Credit risk", "Financial crime", "Compliance", "Internal audit"] },
      { name: "Finance and control", examples: ["Financial control", "FP&A", "Fund accounting", "Treasury"] },
    ],
    requirementPatterns: [
      "Product and asset-class coverage stated explicitly",
      "Regulatory regimes the candidate has operated under",
      "Deal, portfolio or book size with dates",
      "Qualification progress (part-qualified vs qualified) captured precisely",
    ],
    evidenceTypes: [
      { label: "Deal and transaction record", detail: "Named deal types, sizes and the candidate's role in them." },
      { label: "Regulatory exposure", detail: "Regimes and controls owned, quoted from the CV." },
      { label: "Quantitative outcomes", detail: "Book size, AUM, savings or loss-rate movement with dates." },
      { label: "Qualifications", detail: "Charter, licence or accountancy progress, with awarding body." },
    ],
    weights: { skills: 25, experience: 20, industry: 20, seniority: 15, credentials: 10, language: 5, logistics: 5 },
    scoringNotes: [
      "Industry context is raised because sector vocabulary and regulation do not transfer cleanly.",
      "Seniority is scored on decision scope and mandate, not job title inflation.",
      "Unverifiable performance claims are recorded as claims, never scored as evidence.",
    ],
    compliance: [
      { label: "Regulated-role checks", detail: "Approved-person or licensing requirements captured before shortlisting." },
      { label: "Conflicts and confidentiality", detail: "Restrictions and notice terms recorded as requirements, not surprises." },
      { label: "Auditability", detail: "Every scoring run is immutable and tied to a rubric version." },
    ],
    approvalControls: [
      "admin_approval",
      "eligibility_hold",
      "evidence_verification",
      "second_reviewer",
      "contact_release",
      "undo_window",
      "audit_trail",
    ],
    approvalNote:
      "Controlled configuration: eligibility holds for regulated roles, second reviewer on offers, full audit trail retained.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe", "payment-webhooks", "google-sign-in"],
    blueprint: {
      title: "Compliance manager — financial crime (example)",
      seniority: "Manager",
      mustHaves: [
        "Owned AML or sanctions controls in a regulated firm",
        "Experience with regulator-facing reporting",
        "Relevant professional qualification or equivalent record",
      ],
      dealbreakers: ["No regulated-firm experience", "No hands-on control ownership"],
      screeningQuestions: [
        "Which controls did you own, and who was the regulator?",
        "Describe a remediation programme you led and its outcome.",
      ],
    },
    intelligenceFocus: [
      "Narrow pools created by over-specified product coverage",
      "Offer stalls beyond 48 hours",
      "Evidence gaps on regulated experience",
    ],
  },

  "industrial-operations": {
    id: "industrial-operations",
    label: "Industrial and infrastructure",
    summary:
      "Tickets, safety records and site logistics decide who is actually hireable.",
    roleFamilies: [
      { name: "Engineering", examples: ["Mechanical", "Electrical", "Process", "Civil / structural"] },
      { name: "Operations and maintenance", examples: ["Plant operations", "Maintenance", "Reliability", "Shift leadership"] },
      { name: "Safety and quality", examples: ["HSE", "Quality assurance", "Compliance", "Inspection"] },
      { name: "Supply chain and logistics", examples: ["Planning", "Procurement", "Warehousing", "Transport"] },
    ],
    requirementPatterns: [
      "Tickets, cards and certifications with expiry dates",
      "Plant, equipment or systems operated by name",
      "Site location, shift pattern and travel or rotation expectations",
      "Safety record and incident-response responsibility",
    ],
    evidenceTypes: [
      { label: "Certifications and tickets", detail: "Named cards and tickets, with issuing body and validity." },
      { label: "Equipment and systems", detail: "Specific plant, lines or control systems operated or maintained." },
      { label: "Safety and compliance record", detail: "Standards worked under and safety responsibility held." },
      { label: "Throughput outcomes", detail: "Uptime, output, downtime reduction or cost outcomes with dates." },
    ],
    weights: { skills: 25, experience: 20, industry: 15, seniority: 10, credentials: 15, language: 5, logistics: 10 },
    scoringNotes: [
      "Credentials and logistics are both raised: an expired ticket or an unworkable commute ends the match.",
      "Equipment specificity is scored, because 'maintenance experience' is not a qualification.",
      "Rotation and shift tolerance are treated as requirements, not preferences.",
    ],
    compliance: [
      { label: "Safety certification", detail: "Required tickets recorded as hard requirements with expiry tracking on the record." },
      { label: "Site access and clearance", detail: "Clearance or induction requirements captured before shortlisting." },
      { label: "Right to work and mobility", detail: "Work authorisation and rotation availability confirmed up front." },
    ],
    approvalControls: ["admin_approval", "eligibility_hold", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote:
      "Safety-first configuration: eligibility holds on expired or missing tickets, evidence verified before shortlist.",
    integrations: [...BASE_INTEGRATIONS, "attio", "microsoft-teams", "stripe"],
    blueprint: {
      title: "Maintenance engineer — production site (example)",
      seniority: "Experienced",
      mustHaves: [
        "Time-served mechanical or electrical qualification",
        "Hands-on maintenance on automated production lines",
        "Current safety certification for the site type",
      ],
      dealbreakers: ["No shift availability", "Expired mandatory ticket"],
      screeningQuestions: [
        "Which lines or equipment have you maintained, and at what uptime?",
        "Which safety tickets do you hold and when do they expire?",
      ],
    },
    intelligenceFocus: [
      "Holds caused by expired certifications",
      "Location and shift mismatches shrinking the pool",
      "Stage stalls waiting on site clearance",
    ],
  },

  "guest-experience": {
    id: "guest-experience",
    label: "Hospitality and guest services",
    summary:
      "Language, availability and service setting matter more than paper credentials.",
    roleFamilies: [
      { name: "Front of house", examples: ["Reception", "Guest relations", "Concierge", "Duty management"] },
      { name: "Food and beverage", examples: ["Chefs", "Restaurant management", "Bar", "Banqueting"] },
      { name: "Operations leadership", examples: ["General management", "Rooms division", "Revenue", "Housekeeping leadership"] },
      { name: "Events and travel", examples: ["Events delivery", "Travel operations", "Guest experience design"] },
    ],
    requirementPatterns: [
      "Working languages with proficiency level",
      "Property or venue type and scale (covers, keys, footfall)",
      "Availability across shifts, weekends and seasonal peaks",
      "Service standard worked to (luxury, lifestyle, high volume)",
    ],
    evidenceTypes: [
      { label: "Property and venue scale", detail: "Keys, covers or footfall handled, quoted from the CV." },
      { label: "Service standard", detail: "Brand tier and standards the candidate has actually operated under." },
      { label: "Language proficiency", detail: "Languages with stated level, separated from casual mentions." },
      { label: "Guest outcomes", detail: "Satisfaction, review or retention movement where declared." },
    ],
    weights: { skills: 20, experience: 20, industry: 15, seniority: 10, credentials: 5, language: 15, logistics: 15 },
    scoringNotes: [
      "Language and logistics are raised because they decide whether someone can do the shift at all.",
      "Credentials sit at the floor; demonstrated service setting is the stronger signal.",
      "Seasonal and peak-period availability is captured as a requirement, not inferred.",
    ],
    compliance: [
      { label: "Right to work", detail: "Work authorisation captured early for internationally mobile candidates." },
      { label: "Food safety and licensing", detail: "Required certificates recorded where the role demands them." },
      { label: "Working-time rules", detail: "Shift and rest requirements stated in the role definition." },
    ],
    approvalControls: ["admin_approval", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote:
      "High-throughput configuration: single approval step, contact release on approval, decisions reversible.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe"],
    blueprint: {
      title: "Front office manager — city hotel (example)",
      seniority: "Manager",
      mustHaves: [
        "Front office leadership in a comparable property size",
        "Two working languages at professional level",
        "Full shift and weekend availability",
      ],
      dealbreakers: ["No supervisory experience", "Cannot work rotating shifts"],
      screeningQuestions: [
        "How many keys did your property have and how large was your team?",
        "Which languages do you use at work, and at what level?",
      ],
    },
    intelligenceFocus: [
      "Availability mismatches reducing the usable pool",
      "Drop-off between shortlist and interview",
      "Response-rate decline in outreach",
    ],
  },

  "consumer-retail": {
    id: "consumer-retail",
    label: "Retail, e-commerce and media",
    summary:
      "Commercial outcomes and channel evidence outrank titles.",
    roleFamilies: [
      { name: "Store and field", examples: ["Store management", "Area management", "Visual merchandising"] },
      { name: "Digital and trading", examples: ["E-commerce trading", "Merchandising", "CRM", "Performance marketing"] },
      { name: "Buying and supply", examples: ["Buying", "Planning", "Sourcing", "Inventory"] },
      { name: "Content and brand", examples: ["Brand", "Content production", "Social", "Editorial"] },
    ],
    requirementPatterns: [
      "Channel, category and revenue scale owned",
      "Platform and tooling experience by name",
      "Peak-trading responsibility (seasonal, campaign, launch)",
      "Team size and P&L ownership where relevant",
    ],
    evidenceTypes: [
      { label: "Commercial outcomes", detail: "Revenue, margin, conversion or basket movement with the period stated." },
      { label: "Channel ownership", detail: "Which channels and categories the candidate actually owned." },
      { label: "Platform experience", detail: "Named platforms with depth of use, not tool lists." },
      { label: "Team and budget scope", detail: "Headcount and budget managed, quoted from the CV." },
    ],
    weights: { skills: 25, experience: 20, industry: 15, seniority: 15, credentials: 5, language: 10, logistics: 10 },
    scoringNotes: [
      "Outcome evidence is required before commercial claims count toward the score.",
      "Credentials are minimal; category and channel depth do the work.",
      "Multi-site or multi-market scope is scored under seniority, not experience length.",
    ],
    compliance: [
      { label: "Consumer data handling", detail: "GDPR-aware handling flagged for CRM and customer-data roles." },
      { label: "Right to work", detail: "Authorisation and location captured as requirements up front." },
      { label: "Advertising standards", detail: "Regulated-claims experience recorded where the role requires it." },
    ],
    approvalControls: ["admin_approval", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote:
      "Balanced configuration: one approval, evidence verified for commercial claims, reversible decisions.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe", "web-analytics"],
    blueprint: {
      title: "E-commerce trading manager (example)",
      seniority: "Manager",
      mustHaves: [
        "Owned online trading for a category with stated revenue",
        "Hands-on with a major commerce platform",
        "Peak-trading planning experience",
      ],
      dealbreakers: ["No P&L or revenue ownership", "Agency-only exposure where in-house ownership is required"],
      screeningQuestions: [
        "Which category did you trade and what was its annual revenue?",
        "What changed in conversion or margin under your ownership?",
      ],
    },
    intelligenceFocus: [
      "Score compression across similar commercial profiles",
      "Growing review queues during peak hiring",
      "Evidence gaps behind revenue claims",
    ],
  },

  "commercial-growth": {
    id: "commercial-growth",
    label: "Sales, marketing and customer success",
    summary:
      "Quota, segment and motion evidence decide the ranking.",
    roleFamilies: [
      { name: "Sales", examples: ["SDR / BDR", "Account executive", "Enterprise sales", "Sales leadership"] },
      { name: "Marketing", examples: ["Demand generation", "Product marketing", "Content", "Brand"] },
      { name: "Customer success", examples: ["CSM", "Onboarding", "Renewals", "Support leadership"] },
      { name: "Revenue operations", examples: ["RevOps", "Sales operations", "Analytics"] },
    ],
    requirementPatterns: [
      "Quota size, attainment and period",
      "Deal size, sales cycle and buyer segment",
      "Motion: inbound, outbound, partner, PLG or enterprise",
      "Territory, language and timezone coverage",
    ],
    evidenceTypes: [
      { label: "Quota and attainment", detail: "Number, period and attainment as stated on the CV." },
      { label: "Segment and deal shape", detail: "Average deal size, cycle length and buyer type." },
      { label: "Pipeline contribution", detail: "Sourced vs closed pipeline, separated rather than merged." },
      { label: "Retention outcomes", detail: "Renewal, churn or expansion figures with the period stated." },
    ],
    weights: { skills: 25, experience: 25, industry: 20, seniority: 15, credentials: 5, language: 5, logistics: 5 },
    scoringNotes: [
      "Experience and industry are raised: selling motion rarely transfers across segments.",
      "Attainment claims without a stated period are recorded as unverified.",
      "Team-quota and individual-quota records are never merged into one number.",
    ],
    compliance: [
      { label: "Restrictive covenants", detail: "Non-compete and non-solicit terms captured as requirements before offer." },
      { label: "Customer-data handling", detail: "CRM and prospect data handling flagged for GDPR-relevant roles." },
      { label: "Right to work", detail: "Territory coverage and authorisation confirmed early." },
    ],
    approvalControls: ["admin_approval", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote:
      "Speed configuration: single approval, evidence verification focused on quota claims.",
    integrations: [...BASE_INTEGRATIONS, "attio", "microsoft-teams", "stripe", "web-analytics"],
    blueprint: {
      title: "Enterprise account executive (example)",
      seniority: "Senior",
      mustHaves: [
        "Carried an individual quota above a stated threshold",
        "Closed six-figure deals in a comparable segment",
        "Outbound-led motion experience",
      ],
      dealbreakers: ["Team quota only", "No experience in the target segment"],
      screeningQuestions: [
        "What was your quota, and what did you attain in the last two full years?",
        "What was your average deal size and cycle length?",
      ],
    },
    intelligenceFocus: [
      "Declining outreach response rates",
      "Offer stalls and competing processes",
      "Pool size against over-narrow segment requirements",
    ],
  },

  "professional-services": {
    id: "professional-services",
    label: "Professional and advisory services",
    summary:
      "Qualification status and client-facing scope are the ranking backbone.",
    roleFamilies: [
      { name: "Legal", examples: ["Corporate", "Litigation", "In-house counsel", "Paralegal"] },
      { name: "Consulting", examples: ["Strategy", "Operations", "Technology consulting", "Change"] },
      { name: "People and talent", examples: ["HR business partnering", "Talent acquisition", "Reward", "L&D"] },
      { name: "Property and asset advisory", examples: ["Real estate advisory", "Valuation", "Asset management"] },
    ],
    requirementPatterns: [
      "Qualification, admission or chartership with jurisdiction",
      "Practice area or sector specialism",
      "Client-facing scope: matter size, engagement value, client tier",
      "Billable expectation or utilisation where relevant",
    ],
    evidenceTypes: [
      { label: "Qualification and admission", detail: "Body, jurisdiction and date, quoted from the CV." },
      { label: "Matter and engagement record", detail: "Types, sizes and the candidate's role in them." },
      { label: "Client scope", detail: "Client tier, sector and relationship ownership." },
      { label: "Outcome evidence", detail: "Delivered results with dates rather than responsibilities lists." },
    ],
    weights: { skills: 20, experience: 25, industry: 15, seniority: 15, credentials: 15, language: 5, logistics: 5 },
    scoringNotes: [
      "Credentials and experience are both raised: admission plus practice depth is the qualification.",
      "Jurisdiction is a hard requirement where the role is regulated, not a scoring nuance.",
      "Engagement scope is scored above firm brand.",
    ],
    compliance: [
      { label: "Admission and practising status", detail: "Recorded with jurisdiction and validity before shortlisting." },
      { label: "Conflicts of interest", detail: "Prior client conflicts captured as part of the requirement set." },
      { label: "Confidentiality", detail: "Candidate records stay scoped; contact release stays a separate permission." },
    ],
    approvalControls: [
      "admin_approval",
      "eligibility_hold",
      "evidence_verification",
      "second_reviewer",
      "contact_release",
      "undo_window",
      "audit_trail",
    ],
    approvalNote:
      "Advisory configuration: eligibility holds on practising status, second reviewer for partner-track decisions.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe", "google-sign-in"],
    blueprint: {
      title: "Corporate counsel (example)",
      seniority: "Senior",
      mustHaves: [
        "Qualified in the relevant jurisdiction with current practising status",
        "Commercial contracts experience in-house or in practice",
        "Direct business-stakeholder advisory experience",
      ],
      dealbreakers: ["Not admitted in the required jurisdiction", "No commercial contract work"],
      screeningQuestions: [
        "Where are you admitted, and is your practising certificate current?",
        "Which matter types have you led in the last three years?",
      ],
    },
    intelligenceFocus: [
      "Holds from jurisdiction mismatches",
      "Slow partner or panel review stages",
      "Evidence gaps behind engagement claims",
    ],
  },

  "public-education": {
    id: "public-education",
    label: "Public sector, education and non-profit",
    summary:
      "Clearances, safeguarding and structured fairness shape every step.",
    roleFamilies: [
      { name: "Teaching and academic", examples: ["Teachers", "Lecturers", "Researchers", "Academic leadership"] },
      { name: "Student and public services", examples: ["Student services", "Admissions", "Casework", "Community programmes"] },
      { name: "Public administration", examples: ["Policy", "Programme delivery", "Procurement", "Governance"] },
      { name: "Non-profit operations", examples: ["Fundraising", "Programme management", "Volunteer management"] },
    ],
    requirementPatterns: [
      "Qualified status, licence or accreditation with awarding body",
      "Safeguarding and background-check requirements",
      "Grade, band or pay-scale alignment",
      "Funding, grant or programme context",
    ],
    evidenceTypes: [
      { label: "Qualified status", detail: "Teaching status, accreditation or licence, quoted from the CV." },
      { label: "Safeguarding record", detail: "Checks and training declared, with dates." },
      { label: "Programme delivery", detail: "Cohorts, caseloads or programmes delivered with measurable scope." },
      { label: "Stakeholder and governance work", detail: "Boards, panels and public accountability held." },
    ],
    weights: { skills: 20, experience: 20, industry: 15, seniority: 10, credentials: 20, language: 5, logistics: 10 },
    scoringNotes: [
      "Credentials are raised because qualified status is often a statutory requirement.",
      "Structured, identical criteria are applied to every applicant to support fair-process expectations.",
      "Every score is traceable to a rubric version, which supports panel and appeal review.",
    ],
    compliance: [
      { label: "Safeguarding and background checks", detail: "Recorded as hard requirements before any client visibility." },
      { label: "Fair and structured assessment", detail: "Identical criteria and an immutable audit trail for every applicant." },
      { label: "Data minimisation", detail: "CVs held in private storage with scoped, logged access." },
    ],
    approvalControls: [
      "admin_approval",
      "eligibility_hold",
      "evidence_verification",
      "second_reviewer",
      "contact_release",
      "undo_window",
      "audit_trail",
    ],
    approvalNote:
      "Panel configuration: eligibility holds, two named reviewers and a complete audit trail on every decision.",
    integrations: [...BASE_INTEGRATIONS, "google-sign-in", "attio"],
    blueprint: {
      title: "Secondary teacher — sciences (example)",
      seniority: "Experienced",
      mustHaves: [
        "Qualified teacher status or local equivalent",
        "Recent classroom experience in the subject",
        "Current safeguarding training",
      ],
      dealbreakers: ["No qualified status where it is statutory", "Outstanding background-check requirement"],
      screeningQuestions: [
        "What is your qualified status and awarding body?",
        "Which year groups and subjects have you taught most recently?",
      ],
    },
    intelligenceFocus: [
      "Holds waiting on background checks",
      "Time lost between panel stages",
      "Pool size against strict qualification requirements",
    ],
  },

  generic: {
    id: "generic",
    label: "Standard configuration",
    summary:
      "The default balance, used until a role is tuned to its sector.",
    roleFamilies: [
      { name: "Individual contributors", examples: ["Specialists", "Analysts", "Coordinators"] },
      { name: "Management", examples: ["Team leads", "Managers", "Heads of function"] },
      { name: "Leadership", examples: ["Directors", "Executives"] },
    ],
    requirementPatterns: [
      "Must-have skills stated as capabilities, not keywords",
      "Comparable role scope with years and team size",
      "Location, work model and language requirements",
      "Explicit dealbreakers, separated from preferences",
    ],
    evidenceTypes: [
      { label: "Scope owned", detail: "What the candidate actually ran, quoted from the CV." },
      { label: "Outcomes", detail: "Measurable results with dates attached." },
      { label: "Skill depth", detail: "Years of applied use, separated from tools merely listed." },
      { label: "Credentials", detail: "Qualifications with awarding body and date." },
    ],
    weights: { ...DEFAULT_WEIGHTS },
    scoringNotes: [
      "The default weighting applies until the role blueprint tunes it.",
      "Every dimension stays between 5 and 35, so no single factor can dominate a decision.",
      "Weights always total 100, and the version used is stored with the score.",
    ],
    compliance: [
      { label: "Right to work", detail: "Captured as a requirement when the role depends on it." },
      { label: "Data protection", detail: "CVs stay in private storage with scoped access and logged reads." },
      { label: "Auditability", detail: "Scores are immutable and linked to the rubric version that produced them." },
    ],
    approvalControls: ["admin_approval", "evidence_verification", "contact_release", "undo_window", "audit_trail"],
    approvalNote: "Default configuration: one approval step before client visibility, decisions reversible.",
    integrations: [...BASE_INTEGRATIONS, "attio", "stripe"],
    blueprint: {
      title: "Operations manager (example)",
      seniority: "Manager",
      mustHaves: ["Managed a team of comparable size", "Owned a measurable operational outcome", "Relevant sector exposure"],
      dealbreakers: ["No people-management experience"],
      screeningQuestions: [
        "How large was the team you managed, and what did you own?",
        "Which measurable outcome improved under your ownership?",
      ],
    },
    intelligenceFocus: [
      "Requirements narrower than the available pool",
      "Stages that stall longer than the target",
      "Candidates advancing on thin evidence",
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Slug → configuration mapping                                        */
/* ------------------------------------------------------------------ */

/** Data-side industry slug → vertical configuration id. */
const SLUG_TO_CONFIG: Record<string, string> = {
  // Technology and product
  tech: "technology",
  technology: "technology",
  saas: "technology",
  "ai-ml": "technology",
  "data-analytics": "technology",
  cybersecurity: "technology",
  devops: "technology",
  gaming: "technology",
  web3: "technology",
  edtech: "technology",
  proptech: "technology",
  telecom: "technology",
  telecommunications: "technology",
  "product-management": "technology",
  design: "technology",

  // Healthcare and life sciences
  healthcare: "regulated-care",
  healthtech: "regulated-care",
  pharmaceuticals: "regulated-care",
  biotech: "regulated-care",
  "medical-devices": "regulated-care",

  // Financial services
  finance: "financial-services",
  fintech: "financial-services",
  accounting: "financial-services",
  insurance: "financial-services",
  "investment-banking": "financial-services",
  "wealth-management": "financial-services",
  "private-equity": "financial-services",
  "venture-capital": "financial-services",

  // Industrial and infrastructure
  manufacturing: "industrial-operations",
  automotive: "industrial-operations",
  construction: "industrial-operations",
  architecture: "industrial-operations",
  energy: "industrial-operations",
  "renewable-energy": "industrial-operations",
  "oil-gas": "industrial-operations",
  agriculture: "industrial-operations",
  aviation: "industrial-operations",
  defense: "industrial-operations",
  logistics: "industrial-operations",

  // Hospitality and guest services
  hospitality: "guest-experience",
  travel: "guest-experience",
  "food-beverage": "guest-experience",
  sports: "guest-experience",

  // Retail, commerce and media
  retail: "consumer-retail",
  ecommerce: "consumer-retail",
  "e-commerce": "consumer-retail",
  fashion: "consumer-retail",
  media: "consumer-retail",

  // Commercial growth
  sales: "commercial-growth",
  marketing: "commercial-growth",
  "customer-success": "commercial-growth",

  // Professional and advisory services
  legal: "professional-services",
  consulting: "professional-services",
  "staffing-agencies": "professional-services",
  "human-resources": "professional-services",
  "real-estate": "professional-services",

  // Public sector, education and non-profit
  "public-sector": "public-education",
  nonprofit: "public-education",
  "non-profit": "public-education",
  education: "public-education",
  "higher-education": "public-education",
};

/** Resolve any industry slug (public or data-side) to its configuration. */
export function resolveVerticalConfig(slug: string): VerticalConfig {
  const key = SLUG_TO_CONFIG[slug];
  return (key ? VERTICAL_CONFIGS[key] : undefined) ?? VERTICAL_CONFIGS.generic;
}

/** Ordered list for comparison views (generic last). */
export const VERTICAL_CONFIG_LIST: VerticalConfig[] = [
  VERTICAL_CONFIGS.technology,
  VERTICAL_CONFIGS["regulated-care"],
  VERTICAL_CONFIGS["financial-services"],
  VERTICAL_CONFIGS["industrial-operations"],
  VERTICAL_CONFIGS["guest-experience"],
  VERTICAL_CONFIGS["consumer-retail"],
  VERTICAL_CONFIGS["commercial-growth"],
  VERTICAL_CONFIGS["professional-services"],
  VERTICAL_CONFIGS["public-education"],
  VERTICAL_CONFIGS.generic,
];

/** Which industry slugs use a given configuration (public-facing slugs). */
export function slugsForConfig(configId: string): string[] {
  return Object.entries(SLUG_TO_CONFIG)
    .filter(([, id]) => id === configId)
    .map(([slug]) => slug);
}

/** Sanity guard used by tests: weights are in-bounds and total 100. */
export function validateWeights(weights: Record<WeightKey, number>): boolean {
  const values = WEIGHT_DIMENSIONS.map((d) => weights[d.key]);
  const total = values.reduce((a, b) => a + b, 0);
  return total === 100 && values.every((v) => v >= WEIGHT_MIN && v <= WEIGHT_MAX);
}
