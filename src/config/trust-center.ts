/**
 * Trust Center content — verified facts only.
 * ------------------------------------------------------------------
 * Every line below traces to one of three sources:
 *   1. `code`  — a mechanism that exists in this codebase / database.
 *   2. `doc`   — an internal certification or runbook under `docs/`.
 *   3. `legal` — the published Privacy Notice or Terms of Service.
 *
 * Anything without one of those sources is either omitted or marked
 * `in-progress`. No certification, uptime, penetration-test, residency-
 * option or compliance-framework claim appears here.
 */

export const TRUST_LAST_REVIEWED = "4 August 2026";

export type ClaimSource = "code" | "doc" | "legal";
export type SectionState = "documented" | "in-progress";

export interface TrustClaim {
  /** Plain-language statement a buyer can read without context. */
  text: string;
  source: ClaimSource;
  /** Where the statement comes from — shown as a short reference. */
  reference: string;
}

export interface TrustSection {
  id: string;
  title: string;
  /** One or two lines. Sets up the claims beneath. */
  summary: string;
  state: SectionState;
  claims: TrustClaim[];
  /** Only used for `in-progress` sections. */
  note?: string;
  links?: { label: string; to: string; external?: boolean }[];
}

export const TRUST_SECTIONS: TrustSection[] = [
  {
    id: "security-overview",
    title: "Security overview",
    summary:
      "TaaSFlow is a single multi-tenant application. Every customer works inside their own organisation, and the database itself — not the interface — decides what each person can read.",
    state: "documented",
    claims: [
      {
        text: "Access decisions are enforced in the database with Postgres row-level security, so a request that skips the interface still returns nothing it should not.",
        source: "code",
        reference: "RLS policies on every tenant-scoped table",
      },
      {
        text: "The application runs on managed infrastructure: a managed Postgres database with authentication and file storage, and an edge hosting network with CDN and WAF in front of it.",
        source: "legal",
        reference: "Privacy Notice §7",
      },
      {
        text: "Candidate files are held in a private storage bucket. There is no anonymous read path; downloads are issued as time-limited signed URLs from a permission-checked server function.",
        source: "code",
        reference: "CV download server function + private bucket policies",
      },
      {
        text: "Sensitive tables — audit events, scoring runs, extracted evidence, processing jobs, contact submissions — are readable by platform staff only.",
        source: "doc",
        reference: "Tenant isolation certification, 23 July 2026",
      },
    ],
  },
  {
    id: "data-protection",
    title: "Data protection",
    summary:
      "What we hold, why we hold it, and the safeguards described in the published Privacy Notice.",
    state: "documented",
    claims: [
      {
        text: "Candidate data covers identification and contact details, professional history, CVs, screening answers, interview notes and recruitment communications.",
        source: "legal",
        reference: "Privacy Notice §2",
      },
      {
        text: "Special-category data is not intentionally collected. Where it is legally required or volunteered, it is handled with additional safeguards.",
        source: "legal",
        reference: "Privacy Notice §2",
      },
      {
        text: "AI is used for CV parsing and role-fit scoring, and no final hiring decision is made solely by automated processing — every score is reviewable by a human, and candidates can request an explanation.",
        source: "legal",
        reference: "Privacy Notice §10",
      },
      {
        text: "Candidates with an account can export their personal data and request deletion from their profile settings; anyone can request the same by email.",
        source: "legal",
        reference: "Privacy Notice §9",
      },
    ],
    links: [{ label: "Read the Privacy Notice", to: "/privacy" }],
  },
  {
    id: "tenant-isolation",
    title: "Tenant isolation",
    summary:
      "Your organisation's data is separated from every other organisation's data at the database layer.",
    state: "documented",
    claims: [
      {
        text: "Every tenant-scoped table carries a policy that compares the signed-in user against the organisation that owns the row. If there is no membership, the row is simply not returned — not hidden in the interface, but absent from the result.",
        source: "code",
        reference: "is_org_member / is_org_viewer / is_org_editor / is_org_admin",
      },
      {
        text: "Isolation was probed across two live organisations with real positions, candidates, messages, interviews, files and audit rows. Edited URLs, copied record IDs, filter manipulation, global search, realtime subscriptions and direct file access all returned nothing cross-tenant.",
        source: "doc",
        reference: "Tenant isolation certification, 23 July 2026",
      },
      {
        text: "Candidates only become visible to a client organisation after an explicit approval for that organisation and role; releasing contact details is a separate permission again.",
        source: "code",
        reference: "client_visibility gate on candidate matches",
      },
      {
        text: "Realtime updates inherit the same policies, so a live subscription cannot deliver another organisation's changes.",
        source: "doc",
        reference: "Tenant isolation certification — realtime vector",
      },
    ],
  },
  {
    id: "access-controls",
    title: "Access controls",
    summary:
      "Roles are stored separately from user profiles and checked server-side on every request.",
    state: "documented",
    claims: [
      {
        text: "Client roles are admin, editor and viewer. Admins manage the team, editors move candidates and roles forward, viewers can read what has been shared with them.",
        source: "doc",
        reference: "Role and permission matrix",
      },
      {
        text: "Platform roles (platform admin, operations) are separate from customer roles and are never granted by a customer-side action.",
        source: "code",
        reference: "is_platform_staff helper + staff-only policies",
      },
      {
        text: "Role checks run in SECURITY DEFINER functions with a fixed search path, which prevents a caller from redirecting the check to their own objects.",
        source: "code",
        reference: "search_path pinned to public, extensions",
      },
      {
        text: "Support access by platform staff runs as a bounded, expiring session; every action is written to a support-action log and to the audit trail with the real actor retained.",
        source: "doc",
        reference: "Support-mode safety certification",
      },
    ],
  },
  {
    id: "authentication",
    title: "Authentication",
    summary: "Sign-in is handled by the managed authentication service, not by hand-rolled code.",
    state: "documented",
    claims: [
      {
        text: "Email and password sign-in, with password reset by emailed link. Failed sign-in returns a single generic message so it cannot be used to confirm whether an address exists.",
        source: "code",
        reference: "Sign-in route",
      },
      {
        text: "Google sign-in is available on the client start flow.",
        source: "code",
        reference: "Intake OAuth flow",
      },
      {
        text: "Anonymous sign-up is disabled; an account is always tied to a verified identity and an organisation membership.",
        source: "code",
        reference: "Auth configuration",
      },
      {
        text: "Server-side requests re-validate the caller's session token on every protected call rather than trusting anything sent from the browser.",
        source: "code",
        reference: "Authenticated server-function middleware",
      },
      {
        text: "Membership can be deactivated by an organisation admin, and the change is recorded in the audit trail.",
        source: "doc",
        reference: "Multi-org and revocation certification",
      },
    ],
  },
  {
    id: "encryption",
    title: "Encryption",
    summary:
      "Encryption is provided by the underlying infrastructure and described in the Privacy Notice. We restate it here rather than making separate claims of our own.",
    state: "documented",
    claims: [
      {
        text: "The published Privacy Notice records encryption in transit (TLS 1.3) and encryption at rest (AES-256) as technical measures applied by our infrastructure providers.",
        source: "legal",
        reference: "Privacy Notice §7",
      },
      {
        text: "CV files sit in private object storage and are only ever reachable through short-lived signed URLs generated after a permission check — verified in the codebase.",
        source: "code",
        reference: "Private bucket + signed-URL download path",
      },
    ],
    note: "Provider-level cryptographic attestations are held by our infrastructure providers. We do not operate our own key management service and do not claim customer-managed keys.",
  },
  {
    id: "data-retention",
    title: "Data retention",
    summary: "Retention periods are published, not negotiated case by case.",
    state: "documented",
    claims: [
      {
        text: "Candidate profiles: two years of inactivity, then deleted or anonymised unless consent is renewed.",
        source: "legal",
        reference: "Privacy Notice §8",
      },
      {
        text: "CVs and related artefacts: purged 90 days after a recruitment process concludes or after last use.",
        source: "legal",
        reference: "Privacy Notice §8",
      },
      {
        text: "Job submissions: anonymised for statistical purposes two years after a position is filled or closed.",
        source: "legal",
        reference: "Privacy Notice §8",
      },
      {
        text: "Audit and security logs: retained 12 months.",
        source: "legal",
        reference: "Privacy Notice §8",
      },
      {
        text: "Cross-position matching runs on consent for up to 12 months, and that consent can be withdrawn at any time.",
        source: "legal",
        reference: "Privacy Notice §8",
      },
    ],
  },
  {
    id: "audit-coverage",
    title: "Audit coverage",
    summary:
      "Anything that changes a hiring record leaves a record of its own. Nobody can quietly rewrite history.",
    state: "documented",
    claims: [
      {
        text: "Database triggers write an audit event on insert, update and delete for memberships, organisations, positions, candidate matches, scoring runs, scoring decisions, client decisions, interviews, files and screening questions.",
        source: "doc",
        reference: "Audit-trail completeness certification",
      },
      {
        text: "Each event stores the acting user, the organisation, the record, the action, and the state before and after the change.",
        source: "doc",
        reference: "Audit-trail completeness certification",
      },
      {
        text: "Domain actions that are not a plain row change — invitations, support sessions, publication decisions, membership deactivation, reconciliation runs — are written explicitly by the server.",
        source: "doc",
        reference: "Audit-trail completeness certification",
      },
      {
        text: "Scoring runs are append-only: once written, a run and the evidence it used cannot be edited, only superseded by a new run.",
        source: "code",
        reference: "Immutability triggers on score runs",
      },
    ],
  },
  {
    id: "subprocessors",
    title: "Subprocessors",
    summary:
      "The register in the Privacy Notice reflects the infrastructure and vendors actually in use, with purpose, jurisdiction and transfer safeguard for each.",
    state: "documented",
    claims: [
      {
        text: "Currently disclosed: managed database, authentication, storage and realtime; edge hosting, CDN, WAF and DNS; payments and tax; analytics, tag management and the AI models used for CV parsing and scoring; transactional email; sourcing and contact enrichment; consent-gated business-visitor identification; meeting scheduling; CRM; and productivity, mail and meetings.",
        source: "legal",
        reference: "Privacy Notice §6",
      },
      {
        text: "Material changes to the register are published before a new subprocessor begins processing candidate data.",
        source: "legal",
        reference: "Privacy Notice §6",
      },
    ],
    links: [{ label: "View the subprocessor register", to: "/privacy" }],
    note: "The register and the international-transfer wording are pending review by our legal counsel. Corrections are welcome at privacy@taasflow.com.",
  },
  {
    id: "data-residency",
    title: "Data residency",
    summary: "Where processing takes place today, stated plainly.",
    state: "documented",
    claims: [
      {
        text: "Processing may take place in the European Union and the United States. Our managed database and storage run in those regions, and hosting, CDN and WAF run on a global edge network.",
        source: "legal",
        reference: "Privacy Notice §7",
      },
      {
        text: "International transfers rely on Standard Contractual Clauses, and on the EU-U.S. Data Privacy Framework with the UK Extension where a provider is certified under it. A Transfer Impact Assessment is maintained internally.",
        source: "legal",
        reference: "Privacy Notice §7",
      },
    ],
    note: "We do not currently offer selectable or single-region residency, and we make no in-region-only guarantee. If residency is a requirement for your procurement, raise it with us before signing so we can answer against the real configuration.",
  },
  {
    id: "incident-response",
    title: "Incident response",
    summary:
      "Operational runbooks exist and are used. The externally-facing incident policy is being written down.",
    state: "in-progress",
    claims: [
      {
        text: "Fourteen operational runbooks cover the failure modes this system actually has — failed intake, CV parse failure, scoring failure, missing evidence, publication blockers, duplicate candidates, provider outage, email failure, realtime failure, access issues and migration problems.",
        source: "doc",
        reference: "docs/runbooks 01–14",
      },
      {
        text: "Any incorrect candidate visibility is treated as a security incident until proven otherwise: access is reconstructed from the audit trail, and affected users and trace IDs are recorded.",
        source: "doc",
        reference: "Runbook 08 — wrong client visibility",
      },
      {
        text: "Provider outages are posted to the internal status view and affected tenants are notified.",
        source: "doc",
        reference: "Runbook 10 — provider outage",
      },
    ],
    note: "Documentation in progress: a published incident-response policy with customer notification timelines and severity definitions. We are not stating a notification SLA until that document is signed off.",
  },
  {
    id: "business-continuity",
    title: "Business continuity",
    summary: "What we can verify today, and what is still being documented.",
    state: "in-progress",
    claims: [
      {
        text: "Database schema changes are applied as an ordered, reviewable migration history, which doubles as the record of what changed and when.",
        source: "code",
        reference: "Migration history",
      },
      {
        text: "Provider degradation has a defined operational response, including tenant notification.",
        source: "doc",
        reference: "Runbook 10 — provider outage",
      },
    ],
    note: "Documentation in progress: backup and restore procedures, tested recovery objectives, and a disaster-recovery plan. We make no uptime guarantee, and we will not publish recovery targets before they have been tested.",
  },
  {
    id: "not-claimed",
    title: "What we do not claim",
    summary:
      "The fastest way to trust a security page is to see what it refuses to say. None of the following is true of TaaSFlow today, so none of it appears above.",
    state: "documented",
    claims: [
      {
        text: "No SOC 2, ISO 27001, HIPAA or PCI certification, and no audit report.",
        source: "doc",
        reference: "No certification held",
      },
      {
        text: "No completed third-party penetration test to publish.",
        source: "doc",
        reference: "Not yet performed",
      },
      {
        text: "No contractual uptime guarantee or published availability figure.",
        source: "doc",
        reference: "No SLA published",
      },
      {
        text: "No claim of full GDPR, CCPA or PDPL 'compliance' as a status. The Privacy Notice describes how we process data under those laws; it does not certify us.",
        source: "legal",
        reference: "Privacy Notice §5",
      },
    ],
  },
  {
    id: "legal-documents",
    title: "Privacy and legal documents",
    summary: "The underlying documents, with the date each was last updated.",
    state: "documented",
    claims: [
      {
        text: "Global Recruitment Privacy Notice — last updated 12 May 2026. Covers collection, legal bases, subprocessors, transfers, retention, candidate rights and AI-assisted scoring.",
        source: "legal",
        reference: "/privacy",
      },
      {
        text: "Terms of Service — last updated 5 March 2026. Covers the subscription model, client obligations, candidate-data handling, liability and termination.",
        source: "legal",
        reference: "/terms",
      },
      {
        text: "Commercial trust pack — how pricing works, what you keep, and how scoring works.",
        source: "legal",
        reference: "/trust",
      },
    ],
    links: [
      { label: "Privacy Notice", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Commercial trust pack", to: "/trust" },
    ],
    note: "A Data Processing Agreement and a security questionnaire response pack are in progress. Ask us and we will send the current draft rather than a marketing summary.",
  },
];

export const TRUST_CONTACTS = [
  {
    label: "Security and vulnerability reports",
    value: "privacy@taasflow.com",
    href: "mailto:privacy@taasflow.com?subject=Security%20report",
    detail:
      "Report a suspected vulnerability here. Please include enough detail to reproduce it, and give us a reasonable window before disclosing publicly. We do not run a paid bounty programme.",
  },
  {
    label: "Privacy requests and data rights",
    value: "privacy@taasflow.com",
    href: "mailto:privacy@taasflow.com?subject=Privacy%20request",
    detail: "Access, correction, deletion, portability and consent withdrawal. We respond within 30 days.",
  },
  {
    label: "Legal, contracts and DPAs",
    value: "legal@taasflow.com",
    href: "mailto:legal@taasflow.com",
    detail: "Terms, data processing agreements and procurement paperwork.",
  },
];
