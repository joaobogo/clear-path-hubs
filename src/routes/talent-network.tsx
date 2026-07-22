import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";

const CANONICAL = "https://clear-path-hubs.lovable.app/talent-network";
const TITLE = "Talent Network — private matching for senior professionals | TaaSFlow";
const DESC =
  "Join the TaaSFlow Talent Network. Get privately matched to role-specific briefs, review evidence-based feedback, and stay in control of your visibility.";

export const Route = createFileRoute("/talent-network")({
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
  component: TalentNetworkPage,
});

const REASONS = [
  {
    title: "Fewer, better-matched briefs",
    body:
      "We only forward roles that match your captured direction, seniority and constraints — not blanket outreach.",
  },
  {
    title: "Evidence-based review",
    body:
      "Every application is scored against the actual requirements, and the reasoning is shared with you.",
  },
  {
    title: "Private by default",
    body:
      "Your profile is never public, never sold, and never sent to a client without your consent for that specific brief.",
  },
  {
    title: "Real feedback loop",
    body:
      "Structured status updates in your dashboard — no more silent rejections.",
  },
];

const INFO_NEEDED = [
  "Current or most recent role, employer and location",
  "Working preference: remote, hybrid or on-site, and eligible regions",
  "Compensation range and notice period, so we only match viable briefs",
  "CV or resume (PDF or DOCX) — parsed for evidence, editable by you",
  "Optional signals: languages, work authorisation, availability window",
];

const MATCHING = [
  {
    step: "01",
    title: "Structured intake",
    body: "You share the facts once. We convert them into a searchable profile you own.",
  },
  {
    step: "02",
    title: "Role-specific scoring",
    body:
      "When a brief is live, each requirement is scored with cited evidence from your CV — no keyword games.",
  },
  {
    step: "03",
    title: "Consent-based introduction",
    body:
      "If you rank, we ask before sending your details to the client. You see the brief in full first.",
  },
];

const EXPECT = [
  "A dashboard that tracks every application, stage and message in one place.",
  "Direct chat with the TaaSFlow team on live matches — no phone tag.",
  "Structured status updates: submitted, in review, shortlisted, interview, decision.",
  "Downloadable evidence of how you were scored on each brief you consent to.",
];

function TalentNetworkPage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Talent Network" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            For candidates
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A private talent network — matched by evidence, not keywords.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/75">
            Join once, then be considered for briefs that actually fit your direction, seniority and
            working preferences. You stay in control of your visibility at every step.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse open briefs
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              Join by applying
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)] underline underline-offset-4"
            >
              Candidate sign in
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Consent per introduction", "Free for professionals", "No public profile"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1 text-[color:var(--brand-navy)]/75"
              >
                {chip}
              </span>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Why join
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {r.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{r.body}</p>
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
                What information we need
              </h2>
              <p className="mt-3 text-[color:var(--brand-navy)]/75">
                Enough to match you accurately — nothing that isn't used for scoring or introductions.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {INFO_NEEDED.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                How opportunities are matched
              </h2>
              <div className="mt-5 space-y-4">
                {MATCHING.map((m) => (
                  <div
                    key={m.step}
                    className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                      {m.step}
                    </p>
                    <h3 className="mt-1 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                      {m.title}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/75">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            What you can expect
          </h2>
          <ul className="mt-5 grid gap-3 text-sm text-[color:var(--brand-navy)]/85 sm:grid-cols-2">
            {EXPECT.map((e) => (
              <li
                key={e}
                className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
              >
                {e}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
              Privacy and consent
            </h2>
            <div className="mt-5 grid gap-4 text-sm text-[color:var(--brand-navy)]/80 md:grid-cols-2">
              <p>
                Your profile is not indexed publicly and is not visible to any client until you
                consent to a specific introduction for a specific brief.
              </p>
              <p>
                You can pause visibility, edit any field, export your data, or delete your account at
                any time from your candidate dashboard.
              </p>
              <p>
                We only process the fields listed above for matching, scoring and communication about
                live briefs.
              </p>
              <p>
                Full detail — retention, data subject rights and processors — is documented on the{" "}
                <Link to="/privacy" className="underline underline-offset-4">
                  privacy page
                </Link>
                .
              </p>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="For candidates"
        title="Be considered for the next brief that fits."
        description="Apply to an open brief to join the network, or sign in if you already have an account."
        primary={{ to: "/jobs", label: "Browse open briefs" }}
        secondary={{ to: "/login", label: "Candidate sign in" }}
      />
    </SiteShell>
  );
}
