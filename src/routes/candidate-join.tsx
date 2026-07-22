import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";

const CANONICAL = "https://clear-path-hubs.lovable.app/candidate-join";
const TITLE = "Join TaaSFlow — how to become a candidate | TaaSFlow";
const DESC =
  "Everything you need to join TaaSFlow as a candidate: what to prepare, how the application works, what to expect after applying, and how to sign in later.";

export const Route = createFileRoute("/candidate-join")({
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
  component: CandidateJoinPage,
});

const PREP = [
  "Up-to-date CV or resume as a PDF or DOCX (under 10 MB).",
  "Your working preference: remote, hybrid or on-site — and eligible regions.",
  "Compensation range and notice period, so we only match viable briefs.",
  "Optional: LinkedIn URL, portfolio or references you'd like on file.",
];

const STEPS = [
  {
    step: "01",
    title: "Browse open briefs",
    body: "Every brief lists the requirements, working model and any relocation scope up front.",
  },
  {
    step: "02",
    title: "Apply to one that fits",
    body:
      "Upload your CV and answer the brief's screening questions. This creates your candidate account.",
  },
  {
    step: "03",
    title: "Confirm your profile",
    body:
      "We parse your CV into a structured profile you can edit at any time from your dashboard.",
  },
  {
    step: "04",
    title: "Track and be considered",
    body:
      "Sign in to see application status, receive matches for future briefs, and message the team.",
  },
];

const AFTER = [
  "You get an application confirmation with a reference ID.",
  "Structured status updates appear in your dashboard as the review progresses.",
  "For briefs you rank on, we ask consent before sending your details to the client.",
  "You can pause, edit or delete your profile at any time.",
];

const FAQ = [
  {
    q: "Is joining TaaSFlow free for candidates?",
    a: "Yes. TaaSFlow is free for professionals. Employers subscribe to the service.",
  },
  {
    q: "Do I need to be actively job hunting?",
    a: "No. Many members stay privately discoverable and are only contacted for briefs that fit.",
  },
  {
    q: "Is my profile public?",
    a: "Never. Your profile is not indexed publicly and is not shown to any client without your explicit consent for that specific brief.",
  },
  {
    q: "What if I already have an account?",
    a: "Use candidate sign in below to reach your dashboard, applications and messages.",
  },
];

function CandidateJoinPage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Join TaaSFlow" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            For candidates
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Join TaaSFlow in a few minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/75">
            Applying to any open brief creates your candidate account. No separate signup form —
            your first application is your join.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse open briefs
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              Candidate sign in
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                What to prepare
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {PREP.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                What happens after you apply
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {AFTER.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {p}
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
            How it works
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                  {s.step}
                </p>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{s.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Common questions
          </h2>
          <div className="mt-6 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--brand-navy)]">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{f.a}</p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Join TaaSFlow"
        title="Your first application is your join."
        description="Pick a brief that fits and apply — your candidate account is created in the same step."
        primary={{ to: "/jobs", label: "Browse open briefs" }}
        secondary={{ to: "/login", label: "Candidate sign in" }}
      />
    </SiteShell>
  );
}
