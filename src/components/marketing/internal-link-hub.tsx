import { Link } from "@tanstack/react-router";
import { CTA_PRIMARY } from "@/config/cta";
import { INDUSTRY_ENTRIES } from "@/content/industries-v2";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";

/**
 * Site-wide SEO internal-link hub. Rendered above the footer on every
 * marketing page by `SiteShell`. Purpose: give crawlers a rich, keyword-
 * anchored path from any leaf back to homepage, solutions, industries,
 * and top resource clusters — and to raise topical authority.
 *
 * All links use TanStack `<Link>` (client-navigable + SEO-crawlable).
 */

const SOLUTION_LINKS = [
  { to: "/", label: "TaaSFlow home", desc: "The homepage" },
  { to: "/solutions", label: "Who TaaSFlow is for", desc: "HR teams, operators, founders and agencies" },
  { to: "/enterprise", label: "Enterprise", desc: "Scale, controls and procurement" },
  { to: "/how-it-works", label: "How it works", desc: "Four steps from role brief to shortlist" },
  { to: "/pricing", label: "Pricing", desc: "The pilot and package pricing" },
  { to: "/partnerships/staffing", label: "Staffing partnerships", desc: "White-label and referrals" },
  { to: "/global-talent", label: "Global talent", desc: "Hire across borders" },
  { to: "/talent-marketplace", label: "Talent marketplace", desc: "Vetted specialist bench" },
] as const;

const RESOURCE_LINKS = [
  { to: "/blog", label: "Talent strategy blog" },
  { to: "/case-studies", label: "Case studies & outcomes" },
  { to: "/resources", label: "Playbooks & templates" },
  { to: "/faq", label: "Frequently asked questions" },
  { to: "/about", label: "About TaaSFlow" },
  { to: "/contact", label: "Message the team" },
] as const;

const CANDIDATE_LINKS = [
  { to: "/jobs", label: "Browse open roles" },
  { to: "/talent-network", label: "How the talent network works" },
] as const;

// Deterministic top-24 industries + "view all"; ensures every page anchors
// to major industry landing pages without visual overload.
const TOP_INDUSTRIES_SLUGS = [
  "tech",
  "ai-ml",
  "saas",
  "fintech",
  "finance",
  "investment-banking",
  "healthcare",
  "pharmaceuticals",
  "legal",
  "consulting",
  "manufacturing",
  "renewable-energy",
  "retail",
  "hospitality",
  "logistics",
  "real-estate",
  "insurance",
  "education",
  "energy",
  "media",
  "gaming",
  "biotech",
  "cyber",
  "climate-tech",
];

function pickIndustries() {
  const map = new Map(INDUSTRY_ENTRIES.map((e) => [e.slug, e]));
  return TOP_INDUSTRIES_SLUGS.map((s) => map.get(s)).filter(
    (e): e is (typeof INDUSTRY_ENTRIES)[number] => Boolean(e),
  );
}

export function InternalLinkHub() {
  const industries = pickIndustries();

  return (
    <section
      aria-label="Site links"
      className="border-t border-[color:var(--brand-navy)]/10 bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
        {/* Subtle inline CTA band */}
        <div className="mb-10 flex flex-col items-start justify-between gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-[color:var(--brand-navy)]/80">
            <span className="font-semibold text-[color:var(--brand-navy)]">
              Ready when you are.
            </span>{" "}
            Start with one role, or see how TaaSFlow works first.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
            >
              {CTA_PRIMARY.label}
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/15 px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Solutions
            </p>
            <ul className="mt-2 space-y-0.5 sm:mt-4">
              {SOLUTION_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="inline-flex min-h-11 items-center text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Industries we serve
              </p>
              <Link
                to="/industries"
                className="text-xs font-semibold text-[color:var(--brand-navy)]/80 underline underline-offset-4 hover:opacity-80"
              >
                All industries →
              </Link>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 sm:mt-4 sm:grid-cols-3">
              {industries.map((e) => (
                <li key={e.slug}>
                  <Link
                    to="/industries/$slug"
                    params={{ slug: toPublicSlug(e.slug) }}
                    className="inline-flex min-h-11 items-center text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                  >
                    {e.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Resources
            </p>
            <ul className="mt-2 space-y-0.5 sm:mt-4">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="inline-flex min-h-11 items-center text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              For candidates
            </p>
            <ul className="mt-2 space-y-0.5 sm:mt-4">
              {CANDIDATE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="inline-flex min-h-11 items-center text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
