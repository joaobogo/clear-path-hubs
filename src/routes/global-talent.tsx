import { canonicalUrl } from "@/lib/canonical-origin";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";
import { EcosystemCrossSell } from "@/components/marketing/ecosystem-cross-sell";

const CANONICAL = canonicalUrl("/global-talent");
const TITLE = "Global Talent — remote-first hiring with clear scope | TaaSFlow";
const DESC =
  "Hire globally with TaaSFlow: remote-first briefs, regional sourcing, and relocation only when the employer commits. Clear scope, no unverified promises.";

export const Route = createFileRoute("/global-talent")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: GlobalTalentPage,
});

const COVERAGE = [
  {
    title: "EMEA",
    body:
      "Active sourcing across the UK, EU-27, EFTA and select MENA markets. Local time-zone screening and language filters.",
  },
  {
    title: "Americas",
    body:
      "North America, LATAM and Caribbean coverage with time-zone-aligned pipelines for cross-region teams.",
  },
  {
    title: "APAC",
    body:
      "Established reach across Australia, New Zealand, India, Singapore and Southeast Asia. Explicit local-hours filters.",
  },
];

const REMOTE = [
  "Remote-first is the default working model on most briefs.",
  "Time-zone constraints are captured at intake and enforced in scoring.",
  "Hybrid and on-site briefs state the required city or region up front.",
  "Working preference is a candidate-owned field — filters, not assumptions.",
];

const RELOCATION = [
  {
    title: "Only when the employer commits",
    body:
      "Relocation and visa support are brief-specific. They appear on the job details only when the client has confirmed it in writing.",
  },
  {
    title: "Scope is on the brief",
    body:
      "If a role offers relocation, the type of support (bonus, agency, sponsorship) is stated on the job page — never implied by us.",
  },
  {
    title: "Eligibility captured up front",
    body:
      "Candidates share work authorisation and relocation openness during intake, so mismatches never reach the shortlist.",
  },
];

const SOURCING = [
  "Structured multi-channel sourcing per brief, not blanket outreach.",
  "Role-specific rubrics adapt to regional titles, credentials and market norms.",
  "Language proficiency captured as a first-class attribute where the brief requires it.",
  "Every candidate is reviewed by a human before introduction.",
];

const EMPLOYER_OPTIONS = [
  {
    title: "Direct hire (permanent)",
    body: "Employer of record is the client. Introductions include eligibility and location.",
  },
  {
    title: "Contract engagements",
    body: "Fixed-term contracts where the client already has the entity or contractor framework in place.",
  },
  {
    title: "Employer-of-record partners",
    body:
      "Where an EOR is required, we introduce with the client's chosen partner — we don't act as the employer of record ourselves.",
  },
];

function GlobalTalentPage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Global Talent" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Global reach
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Hire globally, without vague promises.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            Remote-first sourcing across EMEA, the Americas and APAC. Relocation and visa support are
            offered per brief, only when the employer has confirmed the scope in writing.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Start an international hire
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              Browse remote briefs
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Remote-first default", "Time-zone captured at intake", "Relocation stated on the brief"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1 text-[color:var(--brand-navy)]/80"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Geographic coverage
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            Coverage means active sourcing, screening and time-zone alignment — not country checklists.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {COVERAGE.map((c) => (
              <div key={c.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{c.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                Remote hiring, done properly
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {REMOTE.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                International sourcing
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {SOURCING.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Relocation support
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {RELOCATION.map((r) => (
              <div key={r.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {r.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{r.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
            We do not publish country totals or visa outcomes. Every brief states what the employer
            commits to, and nothing more.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Employer options
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {EMPLOYER_OPTIONS.map((o) => (
              <div key={o.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {o.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{o.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Global reach"
        title="Open a role across time zones."
        description="Structured intake captures region, remote scope and any relocation commitment before sourcing starts."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/jobs", label: "See open briefs" }}
      />
      <EcosystemCrossSell trigger="market-entry" />
    </SiteShell>
  );
}
