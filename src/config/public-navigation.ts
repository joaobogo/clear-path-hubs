import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH_SHORT } from "@/config/offer-facts";


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
  to: CTA_PRIMARY.to,
  label: CTA_PRIMARY.label,
  description: "Run one role end to end before you commit to more",
};

/** Secondary header CTA, rendered next to the primary CTA on wide screens. */
export const MESSAGE_CTA: NavLink = {
  to: CTA_MESSAGE.to,
  label: CTA_MESSAGE.label,
  description: "Send the team a note about your roles",
};

export const SECONDARY_CTAS: NavLink[] = [
  { to: "/jobs",           label: "Browse jobs" },
  { to: "/login",          label: "Sign in" },
];

/** Candidate-journey CTAs — used on candidate-facing public pages so the
 *  header never pushes an employer offer at a job seeker. */
export const CANDIDATE_PRIMARY_CTA: NavLink = {
  to: "/jobs",
  label: "Browse open roles",
  description: "Live roles we are hiring for right now",
};

/** No secondary CTA on candidate-facing pages — the primary "Browse open
 *  roles" action is the only one we want to push at job seekers. */
export const CANDIDATE_SECONDARY_CTA: NavLink | null = null;

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

/**
 * The header carries six items. The old "Platform" dropdown contents now live in
 * the workspace section of the How it works page.
 */
export const PRIMARY_ITEMS: PrimaryItem[] = [
  { kind: "link", to: "/how-it-works", label: "How it works" },
  { kind: "link", to: "/pricing", label: "Pricing" },
  { kind: "link", to: "/industries", label: "Industries" },
  { kind: "link", to: "/compare", label: "Compare" },
  { kind: "link", to: "/resources", label: "Resources" },
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
    label: "Product",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/agents", label: "Agents" },
      { to: "/integrations", label: "Integrations" },
      { to: "/security", label: "Security" },
    ],
  },
  {
    label: "For companies",
    links: [
      { to: "/pricing", label: "Pricing" },
      { to: "/compare", label: "Compare" },
      { to: "/for-hr-teams", label: "For HR teams" },
      { to: "/for-founders", label: "For founders" },
      { to: CTA_PRIMARY.to, label: CTA_PRIMARY.label },
      { to: CTA_MESSAGE.to, label: CTA_MESSAGE.label },
      { to: "/enterprise", label: "Enterprise" },
      { to: "/partnerships/staffing", label: "Staffing partnerships" },
      { to: "/login", label: "Sign in" },
    ],
  },
  {
    label: "Industries",
    links: [
      { to: "/industries/technology", label: "Technology" },
      { to: "/industries/saas", label: "SaaS" },
      { to: "/industries/finance", label: "Finance" },
      { to: "/industries/healthcare", label: "Healthcare" },
      { to: "/industries/legal", label: "Legal" },
      { to: "/industries/consulting", label: "Consulting" },
      { to: "/industries", label: "All industries" },
    ],
  },
  {
    label: "For candidates",
    links: [
      { to: "/jobs", label: "Browse jobs" },
      { to: "/talent-network", label: "Talent network" },
      { to: "/candidate-join", label: "Join the network" },
      { to: "/login", label: "Sign in" },
    ],
  },
  {
    label: "Resources",
    links: [
      { to: "/resources", label: "Resources" },
      { to: "/blog", label: "Blog" },
      { to: "/case-studies", label: "Case studies" },
      { to: "/faq", label: "FAQ" },
    ],
  },
  {
    label: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/solutions", label: "Who we are for" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    // Rendered in the bottom bar, not as a column.
    label: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];


// Canonical brand boilerplate — same one-liner used in title tags, meta
// descriptions and Organization schema, reused verbatim network-wide.
export const FOOTER_DESCRIPTION =
  `TaaSFlow is a ${OFFER_CATEGORY.toLowerCase()}. ${WHO_RUNS_THE_SEARCH_SHORT} Start with one role for $${PRICE_PILOT_USD}.`;

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
  push(MESSAGE_CTA);
  SECONDARY_CTAS.forEach(push);
  return Array.from(out);
}
