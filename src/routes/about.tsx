import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

// ─── LEADERSHIP — Edit this block to publish the named founder narrative ────
// The rest of the About page reads from this constant. Update once, publish.
// If any field is empty string, that block hides gracefully.
const LEADERS = [
  {
    name: "João Luciano",
    title: "Co-founder & CEO",
    location: "Lisbon · Global",
    photoUrl: "",
    linkedin: "https://www.linkedin.com/in/joaoluciano/",
    quote:
      "We built TaaSFlow because we were tired of hiring being the least explainable part of running a company.",
    bio: "Operator turned founder. Ran hiring at venture-backed teams across LATAM and EMEA before realising the tooling gap was structural, not brand. Focused on building a recruiting function that behaves like software — visible, priced predictably, and accountable to evidence.",
    tags: ["Product-led recruiting", "Operator background", "Evidence-first", "GTM"],
  },
  {
    name: "Christian Brogger",
    title: "Co-founder & COO",
    location: "London · Global",
    photoUrl: "https://taasflow.com/assets/christian-9Ad2XECQ.jpg",
    linkedin: "https://www.linkedin.com/in/christian-brogger/",
    quote:
      "Great hiring starts with great process. We just made it repeatable.",
    bio: "25 years designing and driving value creation across Fortune 500s and private equity. Former Director at UBS Investment Bank; led strategic programmes for Google, Barclays, HSBC, IBM and AstraZeneca. Pragmatic, disruption-minded, technology-as-enabler — with deep experience partnering directly with leadership teams to execute business strategy.",
    tags: ["Process excellence", "Enterprise transformation", "Global delivery", "Operational strategy"],
  },
  {
    name: "João Bogo",
    title: "Co-founder & CMO",
    location: "Lisbon · LATAM & EMEA",
    photoUrl: "https://taasflow.com/assets/joao-BvCqv2_l.jpg",
    linkedin: "https://www.linkedin.com/in/joaomarcoscsilva/",
    quote:
      "The best candidates aren't looking. You need to know where they are and how to reach them.",
    bio: "Former strategist for Hilton, Marriott, Four Seasons, and Philips. Represented at G20 and B20 forums. Has built and scaled talent acquisition campaigns across the US, LATAM, Europe, and the Gulf — with a focus on employer branding, global talent markets, and building real connections at scale.",
    tags: ["Global talent markets", "Employer branding", "Strategic partnerships", "Recruitment marketing"],
  },
] as const;

const WHY_NOW =
  "TaaSFlow started because the recruiting market is stuck between two bad options: an ATS that gives you tooling but no work done, or an agency that does the work but hides how. Both leave hiring teams guessing. We built a third model — a recruiting function delivered through a transparent product, priced like software, run by people who care whether the candidate was actually a good fit.";

const PRINCIPLES = [
  {
    title: "Evidence over opinion",
    body: "Every score cites the exact CV quote it came from. If we cannot cite it, we do not claim it.",
  },
  {
    title: "Transparency by default",
    body: "The workspace your client sees is the same workspace our recruiters use. Nothing lives in a private inbox.",
  },
  {
    title: "You own your pipeline",
    body: "Every candidate we source stays in your workspace — even between roles. No gatekeeping, no lock-in.",
  },
  {
    title: "Respect the candidate",
    body: "Applicants get a real answer, real feedback, real timelines. Silence is not a delivery mode.",
  },
];

const SERVES = [
  {
    who: "Series A–C operators",
    body: "Scaling teams that need predictable throughput without building an internal recruiting org overnight.",
  },
  {
    who: "50–5,000-employee businesses",
    body: "Established teams running multiple parallel searches that need one operating model, not five agency contracts.",
  },
  {
    who: "Founders leading a hire personally",
    body: "Operators who want to run the search themselves without losing their week to sourcing.",
  },
];

export const Route = createFileRoute("/about")({
  head: () =>
    marketingHead(undefined, "/about", {
      title: "About TaaSFlow — a recruiting function delivered as product",
      description:
        "TaaSFlow was founded to make recruiting explainable. Evidence-based scoring, a shared workspace, and a subscription model that aligns incentives with your hires.",
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteShell>
      {/* Purpose */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            About TaaSFlow
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            We exist to make recruiting explainable again.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow is an on-demand recruiting function delivered through a
            transparent product — human recruiters, AI-supported structure,
            and a live workspace on a flat subscription. Every shortlist,
            every score, every decision traces to the evidence behind it,
            because hiring should never be a black box.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Leadership */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Leadership
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet the founders
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Careers built advising global enterprises. Now applying the same
            rigor to the world of hiring.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
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
                      <p className="text-sm font-medium text-[color:var(--brand-navy)]/70">
                        {leader.title}
                      </p>
                      {leader.location ? (
                        <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/55">
                          {leader.location}
                        </p>
                      ) : null}
                    </figcaption>
                  </div>

                  <blockquote className="mt-5 border-l-2 border-[color:var(--brand-navy)]/20 pl-4 text-[color:var(--brand-navy)]">
                    <p className="text-base leading-relaxed">"{leader.quote}"</p>
                  </blockquote>

                  <p className="mt-5 text-sm text-[color:var(--brand-navy)]/75">
                    {leader.bio}
                  </p>

                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {leader.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-mist)]/60 px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]/75"
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

          <div className="mt-12 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
              Why TaaSFlow, why now
            </h3>
            <p className="mt-4 text-[color:var(--brand-navy)]/75">{WHY_NOW}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/journey"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Read the full journey
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
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
                <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]/25">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Who TaaSFlow serves */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Who TaaSFlow serves
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SERVES.map((s) => (
              <div
                key={s.who}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {s.who}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">{s.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready when you are"
        title="Start hiring with an evidence-first model."
        description="Submit a role in the guided intake — your workspace is ready as soon as you finish."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/journey", label: "Explore our journey" }}
      />
    </SiteShell>
  );
}
