import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
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
import { PageConnections } from "@/components/marketing/page-connections";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import hiwHero from "@/assets/page-how-it-works-hero.jpg";
import { PRODUCT_CATEGORY, MODULES } from "@/config/product-language";

const entry = getPage("how-it-works");

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    marketingHead(entry, "/how-it-works", {
      title: "How it works — AI Hiring Intelligence Platform | TaaSFlow",
      description:
        "The operational explainer: Blueprint Compiler, Agent Layer discovery, Evidence Graph review, Scoring Engine ranking and Decision Workspace delivery.",
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
        title="The operational anatomy of a TaaSFlow hire."
        lead="The actual mechanics — blueprint, agents, evidence, scoring, decision — and who owns what."
        image={hiwHero}
        imageAlt="A hiring team reviewing candidate shortlists together at a table"
        stats={[
          { value: "5", label: "Stages, start to hire" },
          { value: "Days", label: "To first ranked shortlist" },
          { value: "Every score", label: "Backed by evidence" },
        ]}
        primary={{ to: "/intake", label: "Start a role" }}
        secondary={{ to: "/contact", label: "Talk to us" }}
        note={`The ${PRODUCT_CATEGORY}: ${MODULES.blueprint}, ${MODULES.agents}, ${MODULES.evidence}, ${MODULES.scoring} and the ${MODULES.workspace}.`}
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
                eyebrow="01 · Blueprint"
                title="The intake becomes an approved blueprint."
                lead="Your intake is not filed away — it becomes the scoring rubric, the search plan, and the screening spec. Weights and deal-breakers are approved before sourcing agents identify a single candidate."
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
                eyebrow="02 · Sourcing"
                title="22 channels. One rubric. No side-doors."
                lead="LinkedIn, sponsored ads, university partnerships, email marketing, web-scale intent scanning, billboards, radio, cold calling, job boards, communities, staffing partners, executive recruiters, inbound applications — every source feeds the same evidence-first scoring bar."
              />
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Digital, direct, AI-driven, inbound, offline — five families of channels working in parallel per role",
                  "AI intent scanning surfaces high-intent passive candidates other tools never see",
                  "Named-target outreach + a 20,000-strong talent network + silver-medalist rehydration",
                  "Universities, staffing partners, referrals, events, PR, radio and OOH when a role warrants it",
                  "Whatever the channel — LinkedIn or a billboard — the candidate is scored on the same rubric",
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
                eyebrow="03 · Evidence review"
                title="Every score has a quote. Every quote has a source."
                lead="Before publication, a recruiter reads each CV against the rubric and attaches evidence quotes to every requirement. If a requirement can't be evidenced, the candidate is not published."
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
            eyebrow="04 · Ranking"
            title="Ranking that responds to your weights."
            lead="Adjust the rubric weights and watch the order change. In your real workspace weights are approved at intake — this demo lets you see how the model reacts."
          />
          <div className="mt-6">
            <RankingDemo />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── 5 · Workspace delivery ────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <SectionHead
            eyebrow="05 · Workspace"
            title="The delivery is a workspace — not a PDF."
            lead="Candidates arrive in a Decision Workspace you and your platform experts share. Stage moves are validated, threads are scoped per role, and every decision is recorded next to the candidate it applies to."
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
            eyebrow="06 · Ownership"
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
        title="Submit your first role."
        description="Intake takes a few minutes. Draft saving is on — return anytime and pick up where you left off."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/pricing", label: "View Pricing" }}
      />
          <PageConnections
        commercial={{ to: "/intake", label: "Start a role", desc: "Kick off hiring in minutes with a guided intake." }}
        explainer={{ to: "/enterprise", label: "Enterprise mechanics", desc: "Governance and cross-role reporting." }}
        resource={{ to: "/case-studies", label: "See it in production", desc: "Weekly delivery on named roles." }}
        audience={{ to: "/solutions", label: "Solutions by team stage", desc: "How Series A–C operators use TaaSFlow." }}
      />
    </SiteShell>
  );
}
