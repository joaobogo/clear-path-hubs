import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

// ─── FOUNDER — Edit this block to publish the named founder narrative ────
// The rest of the About page reads from this constant. Update once, publish.
// If any field is empty string, that block hides gracefully.
const FOUNDER = {
  name: "João Luciano",
  title: "Founder & CEO, TaaSFlow",
  location: "Lisbon · Remote",
  photoUrl: "", // Add a photo URL to render the portrait; empty renders initials.
  // Named founder voice replacing the generic "founding team" quote.
  quote:
    "I spent years buying agency shortlists I could not explain. TaaSFlow is the recruiting system I always wanted on the buying side — one workspace, one rubric, one evidence file per candidate.",
  // One-paragraph "why TaaSFlow, why now".
  why: "TaaSFlow started because the recruiting market is stuck between two bad options: an ATS that gives you tooling but no work done, or an agency that does the work but hides how. Both leave hiring teams guessing. We built a third model — a recruiting function delivered through a transparent product, priced like software, run by people who care whether the candidate was actually a good fit.",
} as const;

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
  const initials = FOUNDER.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

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
            TaaSFlow is subscription recruiting delivered through a transparent
            product. Our purpose is simple: give hiring teams a system where
            every shortlist, every score, and every decision can be traced to
            the evidence behind it.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Founder-led narrative */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
          {/* Founder card */}
          <figure className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-4">
              {FOUNDER.photoUrl ? (
                <img
                  src={FOUNDER.photoUrl}
                  alt={FOUNDER.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--brand-navy)] font-[family-name:var(--brand-font-display)] text-xl font-semibold text-white"
                >
                  {initials}
                </div>
              )}
              <figcaption>
                <p className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
                  {FOUNDER.name}
                </p>
                <p className="text-sm text-[color:var(--brand-navy)]/60">
                  {FOUNDER.title}
                </p>
                {FOUNDER.location ? (
                  <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/50">
                    {FOUNDER.location}
                  </p>
                ) : null}
              </figcaption>
            </div>
            <blockquote className="mt-6 border-l-2 border-[color:var(--brand-navy)]/20 pl-4 text-[color:var(--brand-navy)]">
              <p className="text-base leading-relaxed sm:text-lg">
                "{FOUNDER.quote}"
              </p>
            </blockquote>
          </figure>

          <div>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Why TaaSFlow, why now
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/75">
              {FOUNDER.why}
            </p>
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
