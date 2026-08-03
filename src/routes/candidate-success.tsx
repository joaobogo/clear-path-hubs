import { canonicalUrl } from "@/lib/canonical-origin";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";

const CANONICAL = canonicalUrl("/candidate-success");
const TITLE = "Candidate Success — how the TaaSFlow process works | TaaSFlow";
const DESC =
  "How TaaSFlow supports candidates from application to decision: transparent scoring, structured feedback, and a dashboard that tracks every step.";

export const Route = createFileRoute("/candidate-success")({
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
  component: CandidateSuccessPage,
});

/**
 * NOTE: We intentionally do not publish fabricated testimonials or
 * named quotes. When approved, real stories will be added here as
 * structured entries. Until then, this page describes the transparent
 * process that leads to a good outcome.
 */

const PROMISES = [
  {
    title: "You know where you stand",
    body:
      "Every application has a live status: submitted, in review, shortlisted, interview, decision. No silent rejections.",
  },
  {
    title: "You see how you were scored",
    body:
      "On briefs you consent to, you can download the evidence used to rank you — requirement by requirement.",
  },
  {
    title: "You keep control of your data",
    body:
      "Edit, pause, export or delete your profile at any time from your candidate dashboard.",
  },
];

const JOURNEY = [
  {
    step: "01",
    title: "Apply to a brief",
    body: "Upload your CV and answer the role's screening questions. Takes minutes, not evenings.",
  },
  {
    step: "02",
    title: "Structured review",
    body:
      "Your CV is parsed for evidence against the brief's rubric. A human reviewer confirms the ranking before it reaches the client.",
  },
  {
    step: "03",
    title: "Consent before introduction",
    body:
      "If you rank, we ask before sending your details. You see the client and full brief first.",
  },
  {
    step: "04",
    title: "Interview and decision",
    body:
      "Interview activity, feedback and offers are captured in your dashboard so nothing slips.",
  },
];

const APPROVED_STORIES: Array<{ role: string; region: string; summary: string }> = [
  // Intentionally empty. Populate only with reviewed and consented case studies.
];

function CandidateSuccessPage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Candidate Success" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            For candidates
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A transparent process, from application to decision.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            We publish how the process works — not fabricated quotes. Candidate stories are added
            here only when the person has reviewed and approved the write-up.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse open briefs
            </Link>
            <Link
              to="/talent-network"
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              Join the network
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)] underline underline-offset-4"
            >
              Candidate sign in
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            What we commit to
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {PROMISES.map((p) => (
              <div key={p.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{p.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            The candidate journey
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((j) => (
              <div key={j.step} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                  {j.step}
                </p>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {j.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{j.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            Stories
          </h2>
          {APPROVED_STORIES.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--brand-navy)]/20 bg-white p-6 text-sm text-[color:var(--brand-navy)]/80">
              <p>
                We only publish candidate stories with explicit written consent from the person
                involved. When approved stories are available, they will appear here with the role,
                region and a short first-person summary.
              </p>
              <p className="mt-3">
                If you've been placed through TaaSFlow and would like to share your story, please{" "}
                <Link to="/contact" className="underline underline-offset-4">
                  get in touch
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {APPROVED_STORIES.map((s) => (
                <div key={`${s.role}-${s.region}`} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                    {s.role} · {s.region}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.summary}</p>
                </div>
              ))}
            </div>
          )}
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="For candidates"
        title="Your next role, matched by evidence."
        description="Browse open briefs, join the network, or sign in to your dashboard."
        primary={{ to: "/jobs", label: "Browse briefs" }}
        secondary={{ to: "/login", label: "Candidate sign in" }}
      />
    </SiteShell>
  );
}
