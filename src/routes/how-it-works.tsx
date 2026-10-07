import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import {
  RoleBlueprintMock,
  SourcingEcosystemMap,
  EvidenceReviewPanel,
  RankingDemo,
  WorkspaceDeliveryDemo,
  ResponsibilityMatrix,
  StepRail,
} from "@/components/marketing/how-it-works-deep";
import { CHANNEL_AGENT_COUNT, CHANNEL_FAMILIES } from "@/config/channel-agents";
import { PageConnections } from "@/components/marketing/page-connections";
import { EditorialHero, PhotoBand } from "@/components/marketing/editorial-hero";
import hiwHero from "@/assets/page-how-it-works-hero.jpg";
import bandHire from "@/assets/band-hire.jpg";
import { CTA_BOOK, CTA_FULL_INTAKE, CTA_PRIMARY } from "@/config/cta";
import {
  FIRST_SHORTLIST_BUSINESS_DAYS,
  JOB_BOARD_NOTE,
  PROCESS_STEP_COUNT,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    marketingHead(undefined, "/how-it-works", {
      title: "How TaaSFlow Recruiting Works | TaaSFlow",
      description:
        "Four steps from your hiring brief to a ranked shortlist: share the role, approve the plan, sourcing and screening, then review the evidence behind each score.",
    }),
  component: HowItWorksPage,
});

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-3 text-[color:var(--brand-navy)]/80">{lead}</p>
      ) : null}
    </div>
  );
}

function HowItWorksPage() {
  return (
    <SiteShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <EditorialHero
        eyebrow="How it works"
        title="From your hiring brief to a ranked shortlist."
        lead={`${PROCESS_STEP_COUNT} steps, and who owns each one. ${WHO_RUNS_THE_SEARCH}`}
        image={hiwHero}
        imageAlt="A hiring team reviewing candidate shortlists together at a table"
        stats={[
          { value: String(PROCESS_STEP_COUNT), label: "Steps, from brief to shortlist" },
          { value: `${FIRST_SHORTLIST_BUSINESS_DAYS} business days`, label: "Usual time to a first shortlist" },
          { value: "Every score", label: "Backed by evidence" },
        ]}
        primary={CTA_PRIMARY}
        secondary={CTA_BOOK}
        note={TIMING_FINE_PRINT}
      />

      <PublicSection className="py-8">
        <PublicPage>
          <StepRail />
        </PublicPage>
      </PublicSection>

      {/* ── 1 · Role blueprint ─────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="Approve the plan"
                title="The intake becomes an approved blueprint."
                lead="Your intake is not filed away — it becomes the scoring rubric, the search plan, and the screening spec. Weights and deal-breakers are approved before sourcing starts."
              />
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Weighted rubric — not a wishlist",
                  "Must-haves, nice-to-haves, and deal-breakers made explicit",
                  "Search plan reviewed with you before launch",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <RoleBlueprintMock />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── 2 · Sourcing ecosystem ─────────────────────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <SourcingEcosystemMap />
            <div>
              <SectionHead
                eyebrow="Sourcing and screening"
                title={`${CHANNEL_AGENT_COUNT} channels. One rubric. No side-doors.`}
                lead="Professional networks, sponsored ads, university partnerships, email, public-signal scanning, referrals, events, inbound applications and more. Channels are chosen per role, and every source feeds the same evidence-first scoring bar."
              />
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  `${CHANNEL_FAMILIES.length} families of channels: digital, direct, AI and intent, inbound, and offline`,
                  "Public-signal scanning surfaces people who have just become reachable",
                  "Named-target outreach, our own talent network and past finalists come first",
                  "Universities, partners, referrals, events and press when a role warrants it",
                  JOB_BOARD_NOTE,
                  "Whatever the channel, the candidate is scored on the same rubric",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── 3 · Evidence review ───────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="Evidence review"
                title="Every score has a quote. Every quote has a source."
                lead="Before you see a shortlist, a recruiter reviews each candidate against the rubric and checks the evidence behind every requirement. A requirement that cannot be evidenced is flagged, not hidden."
              />
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Recruiter-approved before it reaches your workspace",
                  "Match / partial / gap called honestly per requirement",
                  "Fit narrative written by a human, not a template",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <EvidenceReviewPanel />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── 4 · Ranking demo ──────────────────────────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <SectionHead
            eyebrow="Ranking"
            title="Ranking that responds to your weights."
            lead="Adjust the rubric weights and watch the order change. In your real workspace weights are approved at intake — this demo lets you see how the model reacts."
          />
          <div className="mt-6">
            <RankingDemo />
          </div>
        </PublicPage>
      </PublicSection>

      <PhotoBand
        className="py-8"
        image={bandHire}
        imageAlt="A candidate and hiring manager shaking hands after an interview"
        eyebrow="The outcome"
        caption="You interview fewer people, and better ones."
        stats={[
          { value: `${FIRST_SHORTLIST_BUSINESS_DAYS} business days`, label: "Usual time to a first shortlist" },
          { value: "Evidence", label: "Behind every ranking" },
          { value: "Yours", label: "Candidate records" },
        ]}
      />

      {/* ── 5 · Workspace delivery ────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <SectionHead
            eyebrow="Review your shortlist"
            title="The delivery is a workspace — not a PDF."
            lead="Candidates arrive in a workspace you and your TaaSFlow recruiter share. Stage moves are validated, threads are scoped per role, and every decision is recorded next to the candidate it applies to."
          />
          <div className="mt-6">
            <WorkspaceDeliveryDemo />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── 6 · Responsibility matrix ─────────────────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <SectionHead
            eyebrow="Ownership"
            title="Who owns what. No ambiguity."
            lead="A model this transparent only works if roles are clear. Here is exactly who owns each step — us, you, or both."
          />
          <div className="mt-6">
            <ResponsibilityMatrix />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <CtaSection
        eyebrow="Ready when you are"
        title="Share your first role."
        description="Request the pilot for one role, or book a call to talk it through first."
        primary={CTA_PRIMARY}
        secondary={CTA_BOOK}
      />
          <PageConnections
        commercial={{ to: CTA_FULL_INTAKE.to, label: CTA_FULL_INTAKE.label, desc: "Already have a job description? Go straight to the full intake." }}
        explainer={{ to: "/enterprise", label: "Enterprise mechanics", desc: "Governance and cross-role reporting." }}
        resource={{ to: "/case-studies", label: "Example engagements", desc: "Example engagements and how we measure them." }}
        audience={{ to: "/solutions", label: "Solutions by team stage", desc: "How teams at different stages use TaaSFlow." }}
      />
    </SiteShell>
  );
}
