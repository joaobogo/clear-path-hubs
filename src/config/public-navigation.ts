/**
 * TaaSFlow Public Navigation — Single Source of Truth
 * ---------------------------------------------------
 * Every rendered public header/footer link on the destination MUST come from
 * this file. Placeholders / not-yet-migrated routes are marked with
 * `hidden: true` and never rendered — no broken links in production.
 */

export type NavLink = {
  to: string;
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
  label: "Start Hiring",
  description: "Launch a role — canonical employer intake",
};

export const SECONDARY_CTAS: NavLink[] = [
  { to: "/jobs",           label: "Browse Jobs" },
  { to: "/candidate-join", label: "Join the Talent Network" },
  { to: "/login",          label: "Sign in" },
];

/* -------------------------------------------------------------- Primary nav (ordered) */

export const PRIMARY_ITEMS: PrimaryItem[] = [
  { kind: "link", to: "/platform", label: "Platform" },
  { kind: "link", to: "/system", label: "The System" },
  { kind: "link", to: "/how-it-works", label: "How It Works" },
  {
    kind: "group",
    label: "Solutions",
    links: [
      { to: "/solutions",             label: "Growing Companies",     description: "On-demand recruiting for scaling teams" },
      { to: "/enterprise",            label: "Enterprise",            description: "Compliance, security, and scale" },
      { to: "/partnerships/staffing", label: "Staffing Partnerships", description: "White-label and referral programs" },
      { to: "/employer-onboarding",   label: "Employer Onboarding",   description: "Get your first role live" },
    ],
  },
  {
    kind: "group",
    label: "Industries",
    links: [
      { to: "/industries/tech",             label: "Technology",        description: "Product, engineering, platform" },
      { to: "/industries/ai-ml",            label: "AI & Machine Learning", description: "Research, applied ML, MLOps, LLM" },
      { to: "/industries/fintech",          label: "FinTech",           description: "Payments, banking, embedded finance" },
      { to: "/industries/saas",             label: "SaaS",              description: "Growth, RevOps, customer teams" },
      { to: "/industries/healthcare",       label: "Healthcare",        description: "Clinical, life sciences, operations" },
      { to: "/industries/pharmaceuticals",  label: "Pharmaceuticals",   description: "Clinical, regulatory, medical affairs" },
      { to: "/industries/finance",          label: "Finance",           description: "Capital markets, corporate finance" },
      { to: "/industries/investment-banking",label: "Investment Banking",description: "M&A, ECM, DCM, coverage" },
      { to: "/industries/legal",            label: "Legal",             description: "In-house and law firm roles" },
      { to: "/industries/consulting",       label: "Consulting",        description: "Strategy, transformation, advisory" },
      { to: "/industries/manufacturing",    label: "Manufacturing",     description: "Precision production and supply chain" },
      { to: "/industries/renewable-energy", label: "Renewable Energy",  description: "Wind, solar, storage, hydrogen" },
      { to: "/industries",                  label: "View All 57 Industries", description: "Every sector we support" },
    ],
  },
  { kind: "link", to: "/pricing", label: "Pricing" },
  {
    kind: "group",
    label: "Resources",
    links: [
      { to: "/resources",      label: "Resources",     description: "Playbooks, guides, and templates" },
      { to: "/blog",           label: "Blog",          description: "Hiring analysis and market data" },
      { to: "/case-studies",   label: "Case Studies",  description: "Real recruiting outcomes" },
      { to: "/knowledge-base", label: "Knowledge Base",description: "How TaaSFlow works, in detail" },
      { to: "/faq",            label: "FAQ",           description: "Common questions answered" },
    ],
  },
  {
    kind: "group",
    label: "Company",
    links: [
      { to: "/about",   label: "About",             description: "Who we are and why" },
      { to: "/journey", label: "TaaSFlow Journey",  description: "How we got here" },
      { to: "/contact", label: "Contact",           description: "Talk to the team" },
    ],
  },
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
      { to: "/industries/tech",       label: "Technology" },
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
      { to: "/privacy",     label: "Privacy" },
      { to: "/terms",       label: "Terms" },
      { to: "/sitemap.xml", label: "Sitemap", external: true },
    ],
  },
];

export const FOOTER_DESCRIPTION =
  "TaaSFlow is subscription recruiting. We deliver ranked, pre-screened candidate shortlists through a live dashboard for one flat monthly fee.";

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
  SECONDARY_CTAS.forEach(push);
  return Array.from(out);
}
