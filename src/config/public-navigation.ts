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
 * The header carries five links (The Run): how a role runs, what it costs,
 * what it produced, who it is for, and who does the work. No dropdowns.
 * "Platform" in the redesign document is "Agents" until /platform is rebuilt
 * (it currently redirects into How it works).
 */
export const PRIMARY_ITEMS: PrimaryItem[] = [
  { kind: "link", to: "/how-it-works", label: "How a role runs" },
  { kind: "link", to: "/pricing", label: "Pricing" },
  { kind: "link", to: "/case-studies", label: "Results" },
  { kind: "link", to: "/industries", label: "Industries" },
  { kind: "link", to: "/agents", label: "Agents" },
];

/** The line beside the wordmark in the header, the footer and share cards. */
export const BRAND_LINE = "Hiring, handled." as const;

/* Legacy exports retained for older imports — derived from PRIMARY_ITEMS. */

export const NAV_GROUPS: NavGroup[] = PRIMARY_ITEMS.filter(
  (i): i is Extract<PrimaryItem, { kind: "group" }> => i.kind === "group",
).map(({ label, links }) => ({ label, links }));

export const PRIMARY_NAV: NavLink[] = PRIMARY_ITEMS.filter(
  (i): i is Extract<PrimaryItem, { kind: "link" }> => i.kind === "link",
).map(({ to, label }) => ({ to, label }));

/* -------------------------------------------------------------- Footer groups */

/** Footer: the brand column, then these four, then one legal row. */
export const FOOTER_GROUPS: NavGroup[] = [
  {
    label: "Product",
    links: [
      { to: "/how-it-works", label: "How a role runs" },
      { to: "/agents", label: "Agents" },
      { to: "/industries", label: "Industries" },
      { to: "/integrations", label: "Integrations" },
      { to: "/security", label: "Security" },
    ],
  },
  {
    label: "Buying",
    links: [
      { to: "/pricing", label: "Pricing" },
      { to: CTA_PRIMARY.to, label: CTA_PRIMARY.label },
      { to: "/enterprise", label: "Enterprise" },
      { to: "/compare", label: "Compare" },
      { to: "/for-hr-teams", label: "For HR teams" },
      { to: "/for-founders", label: "For founders" },
      { to: "/partnerships/staffing", label: "Staffing partnerships" },
      { to: CTA_MESSAGE.to, label: CTA_MESSAGE.label },
    ],
  },
  {
    label: "Proof",
    links: [
      { to: "/case-studies", label: "Results" },
      { to: "/about", label: "About" },
      { to: "/solutions", label: "Who we are for" },
      { to: "/resources", label: "Resources" },
      { to: "/blog", label: "Blog" },
      { to: "/faq", label: "FAQ" },
    ],
  },
  {
    label: "Candidates",
    links: [
      { to: "/jobs", label: "Browse jobs" },
      { to: "/talent-network", label: "Talent network" },
      { to: "/candidate-join", label: "Join the network" },
      { to: "/login", label: "Sign in" },
    ],
  },
  {
    label: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];

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
