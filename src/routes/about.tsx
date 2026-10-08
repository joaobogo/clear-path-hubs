import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { OFFER_CATEGORY, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";
import { PageConnections } from "@/components/marketing/page-connections";

// ─── LEADERSHIP — single source of truth for the named leadership narrative ──
// Canonical version: the two named leaders published on Flow Group Ventures'
// reviewed leadership register (Brøgger as CEO, Bogo Kasprzak as CMO). Name
// spellings follow that register: "Christian Brøgger" (ø) and
// "João (John) Bogo Kasprzak".
// Employers named in a bio are PRIOR EMPLOYERS/PROGRAMMES of that individual,
// never TaaSFlow clients — the disclaimer below is rendered with the cards and
// must stay whenever an employer brand is named.
// A `linkedin` value is published only when the profile has been confirmed to
// belong to that person. Leave it empty rather than link an unverified slug.
const LEADERS = [
  {
    name: "Christian Brøgger",
    title: "Chief Executive Officer",
    location: "North America · Europe",
    photoUrl: "/__l5e/assets-v1/15766c52-abcb-4608-ada7-4a2c2a5b34e9/christian-brogger.jpg",
    linkedin: "https://www.linkedin.com/in/christian-brogger/",
    quote:
      "Great hiring starts with great process. We just made it repeatable.",
    bio: "25 years designing and driving value creation across Fortune 500s and private equity. Former Director at UBS Investment Bank, and led strategic programmes for Google, Barclays, HSBC, IBM and AstraZeneca. Pragmatic and disruption-minded, with technology as the enabler — and deep experience working directly with leadership teams to execute business strategy.",
    tags: ["Process excellence", "Enterprise transformation", "Global delivery", "Operational strategy"],
  },
  {
    name: "João (John) Bogo Kasprzak",
    title: "Chief Marketing Officer",
    location: "Global · LATAM lead",
    photoUrl: "/__l5e/assets-v1/be65771c-f2ae-41cd-b895-a60020362f38/joao-bogo.jpg",
    // Unverified: the previously published slug (/in/joaomarcoscsilva/) spells a
    // different name and LinkedIn serves an auth wall for every slug, so it
    // cannot be confirmed. Restore only once the profile URL is confirmed.
    linkedin: "",
    quote:
      "The best candidates aren't looking. You need to know where they are and how to reach them.",
    bio: "Former strategist for Hilton, Marriott, Four Seasons and Philips. Has built and scaled talent acquisition campaigns across the US, LATAM, Europe and the Gulf, focused on employer branding, global talent markets and building real connections at scale.",
    tags: ["Global talent markets", "Employer branding", "Strategic partnerships", "Recruitment marketing"],
  },
] as const;

// Rendered under the leadership cards, per the FGV disclaimer standard.
const PRIOR_EXPERIENCE_DISCLAIMER =
  "Organisations named above are prior employers and programmes of the individual concerned. They are not TaaSFlow clients and imply no endorsement of TaaSFlow.";


const WHY_NOW =
  `TaaSFlow started because the recruiting market is stuck between two bad options: an ATS that gives you tooling but no work done, or an agency that does the work but hides how. Both leave hiring teams guessing. We built a third model: a recruiting platform with managed execution and fixed package prices. ${WHO_RUNS_THE_SEARCH}`;

const PRINCIPLES = [
  {
    title: "Evidence over opinion",
    body: "Every score cites the CV passage it came from. If we cannot cite it, we do not claim it.",
  },
  {
    title: "Transparency by default",
    body: "The workspace you see is the same workspace we work in. Nothing lives in a private inbox.",
  },
  {
    title: "You own your pipeline",
    body: "You can export your candidate records at any time. No gatekeeping, no lock-in.",
  },
  {
    title: "Respect the candidate",
    body: "Candidates should hear back. Silence is not a delivery mode.",
  },
];

const STORY = [
  {
    label: "What was broken",
    title: "Hiring had no shared surface.",
    body: "Agencies delivered names without reasoning, outsourced recruiting added process without improving quality, and every search started from a fresh set of spreadsheets. There was no shared place where the rubric, the evidence and the decisions lived together.",
  },
  {
    label: "Why the fee model failed",
    title: "Incentives pointed at the wrong outcome.",
    body: "Contingent fees reward speed to placement, not quality of match. A recruiter paid on placement has every reason to push a candidate over the line and little reason to explain why. Clients paid per placement and still had to trust a summary paragraph.",
  },
  {
    label: "What TaaSFlow changed",
    title: "A recruiting function, delivered as a product.",
    body: "Instead of a contingent fee, a flat one-time price per package. Instead of a private inbox, a workspace for each role. Instead of a summary paragraph, a rubric with citations. The model is deliberately plain: a clear process beats heroics.",
  },
] as const;

const FUTURE =
  "Every hire has a rubric behind it. Every rejection has a reason. Every candidate record can be exported by the company that paid for it. A recruiter stays in the loop, and the reasoning is visible. That is the version of hiring we want to work in.";

export const Route = createFileRoute("/about")({
  head: () =>
    marketingHead(
      undefined,
      "/about",
      {
        title: "About TaaSFlow | Recruiting Platform with Managed Execution",
        description:
          "TaaSFlow is a recruiting platform with managed execution. Every shortlist comes with the evidence behind each score, and package prices are fixed.",
      },
      {
        // Named leadership, matching the on-page cards exactly. Only fields
        // that are verifiably true are emitted — no sameAs for an unconfirmed
        // profile, no invented job history.
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AboutPage",
              url: "https://taasflow.com/about",
              mainEntity: {
                "@type": "Organization",
                "@id": "https://taasflow.com/#organization",
                name: "TaaSFlow",
                url: "https://taasflow.com",
                employee: LEADERS.map((leader) => ({
                  "@type": "Person",
                  name: leader.name,
                  jobTitle: leader.title,
                  description: leader.bio,
                  worksFor: { "@id": "https://taasflow.com/#organization" },
                  ...(leader.linkedin ? { sameAs: [leader.linkedin] } : {}),
                })),
              },
            }),
          },
        ],
      },
    ),

  component: AboutPage,
});


function AboutPage() {
  return (
    <SiteShell>
      {/* Purpose */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            About TaaSFlow
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            The team behind TaaSFlow.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            {OFFER_CATEGORY}. We exist to make recruiting explainable again.
            Every shortlist, every score and every decision traces to the
            evidence behind it, because hiring should never be a black box.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Leadership */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Leadership
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet the leadership
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            Careers built advising global enterprises. Now applying the same
            rigor to the world of hiring.
          </p>

          <div className="mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            {LEADERS.map((leader) => {
              const initials = leader.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("");
              return (
                <figure
                  key={leader.name}
                  className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8"
                >
                  <div className="flex items-center gap-4">
                    {leader.photoUrl ? (
                      <img
                        src={leader.photoUrl}
                        alt={leader.name}
                        loading="lazy"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--brand-navy)] font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-white"
                      >
                        {initials}
                      </div>
                    )}
                    <figcaption className="min-w-0">
                      <p className="font-[family-name:var(--brand-font-display)] text-xl font-semibold text-[color:var(--brand-navy)]">
                        {leader.name}
                      </p>
                      <p className="text-sm font-medium text-[color:var(--brand-navy)]/80">
                        {leader.title}
                      </p>
                      {leader.location ? (
                        <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/80">
                          {leader.location}
                        </p>
                      ) : null}
                    </figcaption>
                  </div>

                  <blockquote className="mt-5 border-l-2 border-[color:var(--brand-navy)]/20 pl-4 text-[color:var(--brand-navy)]">
                    <p className="text-base leading-relaxed">"{leader.quote}"</p>
                  </blockquote>

                  <p className="mt-5 text-sm text-[color:var(--brand-navy)]/80">
                    {leader.bio}
                  </p>

                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {leader.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-mist)]/60 px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]/80"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>

                  {leader.linkedin ? (
                    <a
                      href={leader.linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-navy)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                    >
                      Connect on LinkedIn →
                    </a>
                  ) : null}
                </figure>
              );
            })}
          </div>

          <p className="mt-6 max-w-3xl text-xs text-[color:var(--brand-navy)]/70">
            {PRIOR_EXPERIENCE_DISCLAIMER}
          </p>

          <div className="mt-12 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
              Why TaaSFlow, why now
            </h3>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">{WHY_NOW}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                See how it works
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Operating principles */}
      <PublicSection>
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Operating principles
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Four principles the product enforces.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <div
                key={p.title}
                className="flex gap-5 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]/80">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Company story (folded in from the retired /journey page) */}
      <PublicSection id="story" className="scroll-mt-24 border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Our story
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Why we built a better recruiting model.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            TaaSFlow was not built to be another agency with a nicer landing page. It was built to fix the specific things that go wrong when companies hire.
          </p>
          <div className="mt-10 space-y-10">
            {STORY.map((c, i) => (
              <article key={c.label} className="grid gap-4 md:grid-cols-[auto_1fr] md:gap-10">
                <div className="flex items-start gap-4 md:flex-col md:items-start">
                  <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold text-[color:var(--brand-ocean-text)]">
                    0{i + 1}
                  </span>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                    {c.label}
                  </p>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                    {c.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">{c.body}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-3xl text-[color:var(--brand-navy)]/80">{FUTURE}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            <Link to="/pricing" className="text-[color:var(--brand-navy)] underline underline-offset-4">
              See pricing
            </Link>
            <Link to="/solutions" className="text-[color:var(--brand-navy)] underline underline-offset-4">
              Who TaaSFlow is for
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready when you are"
        title="Hire with an evidence-first model."
        description="Request the pilot for one role, or send us a message to talk it through first."
        primary={CTA_PRIMARY}
        secondary={CTA_MESSAGE}
      />
          <PageConnections
        commercial={{ to: "/how-it-works", label: "See how it works", desc: "The four steps behind TaaSFlow." }}
        explainer={{ to: "/solutions", label: "Who TaaSFlow is for", desc: "HR teams, operators, founders and staffing agencies." }}
        resource={{ to: "/case-studies", label: "Example engagements", desc: "Example engagements and how we measure them." }}
        audience={{ to: "/enterprise", label: "Working with enterprise", desc: "How large orgs adopt TaaSFlow." }}
      />
    </SiteShell>
  );
}
