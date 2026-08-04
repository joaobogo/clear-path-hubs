import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { MODULE_SECTIONS } from "@/config/product-language";


/**
 * TaaSFlow Public Navigation — Single Source of Truth
 * ---------------------------------------------------
 * Every rendered public header/footer link on the destination MUST come from
 * this file. Placeholders / not-yet-migrated routes are marked with
 * `hidden: true` and never rendered — no broken links in production.
 */

export type NavLink = {
  to: string;
  /** Section id on the destination page, rendered as `#hash`. */
  hash?: string;
  label: string;
  description?: string;
  hidden?: boolean;
  external?: boolean;
};


export type NavGroup = {
  label: string;
  links: NavLink[];
};

/** Ordered primary items rendered by the desktop header. */
export type PrimaryItem =
  | { kind: "link"; to: string; label: string }
  | { kind: "group"; label: string; links: NavLink[] };

/* -------------------------------------------------------------- CTAs */

export const PRIMARY_CTA: NavLink = {
  to: "/pilot",
  label: `Start a $${PRICE_PILOT_USD} pilot`,
  description: "Run one role end-to-end before subscribing",
};

/** Secondary header CTA — rendered next to the primary CTA. */
export const BOOK_CALL_CTA: NavLink = {
  to: "/contact",
  label: "Book call",
  description: "Talk to a founder about your roles",
};

export const SECONDARY_CTAS: NavLink[] = [
  { to: "/jobs",           label: "Browse Jobs" },
  { to: "/candidate-join", label: "Join the Talent Network" },
  { to: "/login",          label: "Sign in" },
];

/** Candidate-journey CTAs — used on candidate-facing public pages so the
 *  header never pushes an employer offer at a job seeker. */
export const CANDIDATE_PRIMARY_CTA: NavLink = {
  to: "/jobs",
  label: "Browse open roles",
  description: "Live roles we are hiring for right now",
};

export const CANDIDATE_SECONDARY_CTA: NavLink = {
  to: "/candidate-join",
  label: "Join the talent network",
  description: "Be considered for roles before they are advertised",
};

/** Public routes that belong to the candidate journey, not the employer one. */
const CANDIDATE_PATH_PREFIXES = [
  "/jobs",
  "/apply",
  "/candidate-join",
  "/candidate-success",
  "/talent-network",
  "/talent-marketplace",
  "/global-talent",
];

export function isCandidateJourneyPath(pathname: string): boolean {
  return CANDIDATE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/* -------------------------------------------------------------- Primary nav (ordered) */

export const PRIMARY_ITEMS: PrimaryItem[] = [
  {
    kind: "group",
    label: "Platform",
    links: [
      { to: "/platform", label: "Platform overview", description: "The whole system, module by module" },
      ...MODULE_SECTIONS.map((m) => ({
        to: "/platform",
        hash: m.anchor,
        label: m.name,
        description: m.description,
      })),
      { to: "/how-it-works", label: "How It Works", description: "Intake, sourcing, scoring, decision — step by step" },
      { to: "/solutions", label: "Solutions", description: "How teams deploy the platform as they scale" },
      { to: "/industries", label: "Industries", description: "Role libraries and rubrics by sector" },
      { to: "/enterprise", label: "Enterprise", description: "Scale, controls, and procurement requirements" },
    ],
  },
  { kind: "link", to: "/agents", label: "Agents" },
  { kind: "link", to: "/system", label: "Intelligence" },
  { kind: "link", to: "/pricing", label: "Pricing" },
  { kind: "link", to: "/case-studies", label: "Customers" },
  { kind: "link", to: "/security", label: "Security" },
];


/* Legacy exports retained for older imports — derived from PRIMARY_ITEMS. */

export const NAV_GROUPS: NavGroup[] = PRIMARY_ITEMS.filter(
  (i): i is Extract<PrimaryItem, { kind: "group" }> => i.kind === "group",
).map(({ label, links }) => ({ label, links }));

export const PRIMARY_NAV: NavLink[] = PRIMARY_ITEMS.filter(
  (i): i is Extract<PrimaryItem, { kind: "link" }> => i.kind === "link",
).map(({ to, label }) => ({ to, label }));

/* -------------------------------------------------------------- Footer groups */

export const FOOTER_GROUPS: NavGroup[] = [
  {
    // Product column. Status and Changelog are intentionally absent: no such
    // route exists yet, and this file must never advertise a dead link.
    label: "Product",
    links: [
      { to: "/platform", label: "Platform" },
      { to: "/agents",   label: "Agents" },
      { to: "/system",   label: "Intelligence" },
      { to: "/security", label: "Security" },
    ],
  },
  {

    label: "For Companies",
    links: [
      { to: "/platform",              label: "Platform" },
      { to: "/how-it-works",          label: "How It Works" },
      { to: "/pricing",               label: "Pricing" },
      { to: "/enterprise",            label: "Enterprise" },
      { to: "/employer-onboarding",   label: "Employer Onboarding" },
      { to: "/partnerships/staffing", label: "Staffing Partnerships" },
      { to: "/intake",                label: "Start Hiring" },
    ],
  },
  {
    label: "Industries",
    links: [
      { to: "/industries/technology",       label: "Technology" },
      { to: "/industries/saas",       label: "SaaS" },
      { to: "/industries/finance",    label: "Finance" },
      { to: "/industries/healthcare", label: "Healthcare" },
      { to: "/industries/legal",      label: "Legal" },
      { to: "/industries/consulting", label: "Consulting" },
      { to: "/industries",            label: "View All Industries" },
    ],
  },
  {
    label: "For Candidates",
    links: [
      { to: "/jobs",              label: "Browse Jobs" },
      { to: "/talent-network",    label: "Talent Network" },
      { to: "/candidate-join",    label: "Join the Network" },
      { to: "/login",             label: "Candidate Sign In" },
      { to: "/candidate-success", label: "Candidate Stories" },
    ],
  },
  {
    label: "Resources",
    links: [
      { to: "/resources",      label: "Resources" },
      { to: "/blog",           label: "Blog" },
      { to: "/case-studies",   label: "Case Studies" },
      { to: "/knowledge-base", label: "Knowledge Base" },
      { to: "/faq",            label: "FAQ" },
    ],
  },
  {
    label: "Company",
    links: [
      { to: "/about",   label: "About" },
      { to: "/journey", label: "Journey" },
      { to: "/trust",   label: "Trust" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    label: "Legal",
    links: [
      { to: "/security",    label: "Trust Center" },
      { to: "/privacy",     label: "Privacy" },
      { to: "/terms",       label: "Terms" },
      { to: "/sitemap.xml", label: "Sitemap", external: true },
    ],
  },
];

export const FOOTER_DESCRIPTION =
  "TaaSFlow is an AI Hiring Intelligence Platform. Agents run the search, evidence backs every score, and ranked candidates land in a live Decision Workspace for one flat fee.";

export const SOCIAL_LINKS = [
  { href: "https://www.linkedin.com/company/taasflow", label: "LinkedIn" },
  { href: "mailto:hello@taasflow.com",                 label: "Email" },
] as const;

/** Utility: flat list of all rendered hrefs for QA / crawling. */
export function allNavHrefs(): string[] {
  const out = new Set<string>();
  const push = (l: NavLink) => { if (!l.hidden) out.add(l.to); };
  PRIMARY_ITEMS.forEach((i) => {
    if (i.kind === "link") out.add(i.to);
    else i.links.forEach(push);
  });
  FOOTER_GROUPS.forEach((g) => g.links.forEach(push));
  push(PRIMARY_CTA);
  push(BOOK_CALL_CTA);
  SECONDARY_CTAS.forEach(push);
  return Array.from(out);
}
