import { BOOKING_ROUTE } from "@/config/booking";
import { PRICE_PILOT_USD } from "@/config/pricing-core";


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
  to: "/intake",
  label: `Start your first role — $${PRICE_PILOT_USD}`,
  description: "One role, one-time pilot, guaranteed top 10",
};

/** Secondary header CTA — rendered next to the primary CTA. */
export const BOOK_CALL_CTA: NavLink = {
  to: BOOKING_ROUTE,
  label: "Book a 20-minute call",
  description: "Bring one role. We will show you how we would run it.",
};

export const SECONDARY_CTAS: NavLink[] = [
  { to: "/jobs",           label: "Browse Jobs" },
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

export const PRIMARY_ITEMS: PrimaryItem[] = [
  { kind: "link", to: "/how-it-works", label: "How it works" },
  { kind: "link", to: "/pricing", label: "Pricing" },
  { kind: "link", to: "/industries", label: "Industries" },
  { kind: "link", to: "/compare", label: "Compare" },
  { kind: "link", to: "/resources", label: "Resources" },
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
    label: "Explore",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/pricing", label: "Pricing" },
      { to: "/industries", label: "Industries" },
      { to: "/compare", label: "Compare" },
      { to: "/resources", label: "Resources" },
    ],
  },
  {
    label: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/security", label: "Security" },
      { to: "/ai-hiring-compliance", label: "AI in hiring" },
      { to: "/trust", label: "Trust" },
      { to: "/contact", label: "Contact" },
      { to: "/jobs", label: "Open roles" },
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

// Canonical brand boilerplate — same one-liner used in title tags, meta
// descriptions and Organization schema, reused verbatim network-wide.
export const FOOTER_DESCRIPTION =
  "Flat-fee recruiting run by AI agents and senior recruiters. Start with one $699 role, get a guaranteed top 10, and keep the candidates sourced for your company." as const;

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
