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
} from "@/components/marketing/how-it-works-deep";
import { PlatformArchitecture } from "@/components/marketing/platform-architecture";
import { EvidenceGraph } from "@/components/evidence/evidence-graph";
import { LifecyclePreview } from "@/components/marketing/product-preview/lifecycle-preview";
import { DecisionWorkspacePreview } from "@/components/marketing/product-preview/decision-workspace-preview";
import { REPRESENTATIVE_CHAIN } from "@/lib/evidence/evidence-graph";
import { INTAKE_STEPS, INTAKE_TOTAL_MINUTES } from "@/lib/express-intake-schema";
import { CHANNEL_AGENT_COUNT, CHANNEL_FAMILIES } from "@/config/channel-agents";
import { PageConnections } from "@/components/marketing/page-connections";
import { EditorialHero, PhotoBand } from "@/components/marketing/editorial-hero";
import hiwHero from "@/assets/page-how-it-works-hero.jpg";
import bandHire from "@/assets/band-hire.jpg";
import { CTA_MESSAGE, CTA_FULL_INTAKE, CTA_PRIMARY } from "@/config/cta";
import {
  FIRST_SHORTLIST_BUSINESS_DAYS,
  FIRST_SHORTLIST_TIMING,
  JOB_BOARD_NOTE,
  OFFER_CATEGORY,
  PROCESS_STEPS,
  PROCESS_STEP_COUNT,
  SEATS_NOTE,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    marketingHead(undefined, "/how-it-works", {
      title: "How TaaSFlow Works | Four Steps to a Shortlist",
      description:
        "Share the role, approve the plan, sourcing and screening, then review a ranked shortlist with the evidence behind each score. What you do and what we do at each step.",
    }),
  component: HowItWorksPage,
});

/** What happens, and what the employer does, at each of the four steps. */
const STEP_DETAIL: readonly { you: string; we: string }[] = [
  {
    you: `Complete the ${INTAKE_STEPS.length}-step intake, about ${INTAKE_TOTAL_MINUTES} minutes, or send a job description. Drafts are saved, so you can pause and resume.`,
    we: "We read the brief and ask for what is missing. Nothing is sourced until the scope is confirmed.",
  },
  {
    you: "Confirm the scoring rubric: must-haves, nice-to-haves and deal-breakers, with their weights.",
    we: `We turn your intake into a role-specific rubric and a search plan. Your workspace opens with the role and the rubric. ${SEATS_NOTE}`,
  },
  {
    you: "Nothing, unless we have a question. You can follow progress in the workspace.",
    we: "Agents source candidates, parse each application and extract evidence, and apply the rubric. A recruiter reviews the results before anyone reaches your shortlist.",
  },
  {
    you: "Review the ranked shortlist, then advance, hold or pass on each candidate with a reason. Run the interviews and make the hiring decision.",
    we: `${FIRST_SHORTLIST_TIMING} Every score arrives with its evidence, in the workspace.`,
  },
];

const PREPARE = [
  { title: "Role clarity", body: "Rough notes on responsibilities, must-haves and nice-to-haves. The intake structures them." },
  { title: "Compensation range", body: "An approved range for the role, shared with candidates at the right stage." },
  { title: "Hiring team", body: "Names and emails of the reviewers, interviewers and decision maker, to invite into the workspace." },
  { title: "Interview loop", body: "The stages, who owns each, and roughly how long each takes." },
  { title: "Screening questions", body: "A few role-specific questions. Optional: we can propose a set from the rubric." },
  { title: "Constraints", body: "Location model, visa policy and start-date flexibility. Anything that would disqualify late is better captured early." },
];

const SCORING_POINTS = [
  "Roles are split into requirements, and each requirement gets its own verdict and evidence quote.",
  "The 0 to 100 fit score is built from those verdicts, not the other way around.",
  "Each score shows its coverage, any contradiction flags and the rubric version it ran on.",
  "The same rubric is applied to every candidate on a role.",
  "Scoring uses the material a candidate submits, such as their CV and application answers. No external data-enrichment source is connected today.",
];

const CONTROLS = [
  { title: "Approval gates", detail: "No candidate reaches your shortlist until a recruiter has verified the evidence and approved the release." },
  { title: "Rubric versions", detail: "Each score names the rubric version it ran on. Versions are frozen once scored against." },
  { title: "Role-specific settings", detail: "Weights, must-haves and intensity (steady, standard or aggressive) are set per role." },
  { title: "Agent switches", detail: "Enable, pause or disable any agent per role. Paused agents stop, and the change is logged." },
  { title: "Audit history", detail: "State changes, overrides, releases and access events are appended, never edited." },
  { title: "Escalation", detail: "A path to a TaaSFlow recruiter inside the workspace." },
];

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
        lead={`TaaSFlow is a ${OFFER_CATEGORY.toLowerCase()}. ${PROCESS_STEP_COUNT} steps, and who owns each one. ${WHO_RUNS_THE_SEARCH}`}
        image={hiwHero}
        imageAlt="A hiring team reviewing candidate shortlists together at a table"
        stats={[
          { value: String(PROCESS_STEP_COUNT), label: "Steps, from brief to shortlist" },
          { value: `${FIRST_SHORTLIST_BUSINESS_DAYS} business days`, label: "Usual time to a first shortlist" },
          { value: "Every score", label: "Backed by evidence" },
        ]}
        primary={CTA_PRIMARY}
        secondary={CTA_MESSAGE}
        note={TIMING_FINE_PRINT}
      />

      {/* ── The four steps ─────────────────────────────────────── */}
      <PublicSection id="steps" className="scroll-mt-24 py-12">
        <PublicPage>
          <SectionHead
            eyebrow={`${PROCESS_STEP_COUNT} steps`}
            title="From your brief to a ranked shortlist."
            lead="The same four steps for every role, with what you do and what happens on our side."
          />
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {PROCESS_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-ocean-text)]">
                    0{i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">{step.title}</h3>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">{step.body}</p>
                    <dl className="mt-3 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                      <div>
                        <dt className="inline font-semibold text-[color:var(--brand-navy)]">You: </dt>
                        <dd className="inline">{STEP_DETAIL[i]?.you}</dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold text-[color:var(--brand-navy)]">TaaSFlow: </dt>
                        <dd className="inline">{STEP_DETAIL[i]?.we}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </li>
            ))}
          </ol>
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
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]"
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
                title={`${CHANNEL_AGENT_COUNT} channels, one rubric.`}
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
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]"
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── What you get in the workspace ─────────────────────── */}
      <PublicSection id="workspace" className="scroll-mt-24 border-t border-[color:var(--brand-navy)]/8 py-12">
        <PublicPage>
          <SectionHead
            eyebrow="Review your shortlist"
            title="What you get in the workspace."
            lead="The delivery is a workspace, not a PDF. You and your TaaSFlow recruiter share it: stage moves are validated, threads are scoped per role, and every decision is recorded next to the candidate it applies to."
          />
          <div className="mt-6">
            <WorkspaceDeliveryDemo />
          </div>
          <h3 className="mt-12 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            Pick a module and see what it does.
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--brand-navy)]/80">
            What enters it, what it does, what it produces, what you control and what gets recorded.
          </p>
          <div className="mt-6">
            <PlatformArchitecture />
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <LifecyclePreview />
            <DecisionWorkspacePreview />
          </div>
          <h3 className="mt-12 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            The controls that sit over it.
          </h3>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <div key={c.title} className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <dt className="text-base font-semibold text-[color:var(--brand-navy)]">{c.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-3xl text-sm text-[color:var(--brand-navy)]/80">
            Want the detail on each agent? See the{" "}
            <Link to="/agents" className="font-semibold underline underline-offset-4">
              agents behind each step
            </Link>
            .
          </p>
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

      {/* ── How candidates are scored ─────────────────────────── */}
      <PublicSection id="scoring" className="scroll-mt-24 py-12">
        <PublicPage>
          <SectionHead
            eyebrow="Evidence review"
            title="How candidates are scored: the evidence behind each score."
            lead="Before you see a shortlist, a recruiter reviews each candidate against the rubric and checks the evidence behind every requirement. A requirement that cannot be evidenced is flagged, not hidden."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <ul className="space-y-2 text-sm text-[color:var(--brand-navy)]/80">
              {SCORING_POINTS.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]" />
                  {t}
                </li>
              ))}
            </ul>
            <EvidenceReviewPanel />
          </div>
          <div className="mt-10">
            <EvidenceGraph
              nodes={REPRESENTATIVE_CHAIN.nodes}
              meta={REPRESENTATIVE_CHAIN.meta}
              variant="compact"
              representative
              idPrefix="public-evidence-graph"
              title="Evidence graph: a scored candidate"
              description="Representative data for one senior platform role. In the workspace this is the real record, with reviewer history attached."
            />
          </div>
          <div className="mt-12">
            <SectionHead
              eyebrow="Ranking"
              title="Ranking that responds to your weights."
              lead="Adjust the rubric weights and watch the order change. In your real workspace the weights are approved at intake. This demo shows how the ranking reacts."
            />
            <div className="mt-6">
              <RankingDemo />
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── What you do and what we do ────────────────────────── */}
      <PublicSection id="responsibilities" className="scroll-mt-24 bg-[color:var(--brand-cream)] py-12">
        <PublicPage>
          <SectionHead
            eyebrow="Ownership"
            title="What you do and what we do."
            lead="Here is who owns each activity: us, you, or both. A recruiter reviews every shortlist, and you make every hiring decision."
          />
          <div className="mt-6">
            <ResponsibilityMatrix />
          </div>
          <h3 className="mt-12 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            What to have ready before you start.
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--brand-navy)]/80">
            None of this is required up front. Having it ready makes the first pass quicker.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PREPARE.map((p) => (
              <div key={p.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <h4 className="text-base font-semibold text-[color:var(--brand-navy)]">{p.title}</h4>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{p.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl rounded-xl border border-dashed border-[color:var(--brand-navy)]/20 bg-white p-4 text-sm text-[color:var(--brand-navy)]/80">
            What we do not claim: there is no fully autonomous AI recruiter here, and no black box. Software does the mechanical work, and people review, calibrate and decide.
          </p>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready when you are"
        title="Share your first role."
        description="Request the pilot for one role, or send us a message to talk it through first."
        primary={CTA_PRIMARY}
        secondary={CTA_MESSAGE}
      />
      <PageConnections
        commercial={{ to: CTA_FULL_INTAKE.to, label: CTA_FULL_INTAKE.label, desc: "Already have a job description? Go straight to the full intake." }}
        explainer={{ to: "/agents", label: "The agents behind each step", desc: "Every agent, with its inputs, outputs and approval gates." }}
        resource={{ to: "/case-studies", label: "Example engagements", desc: "Example engagements and how we measure them." }}
        audience={{ to: "/solutions", label: "Who TaaSFlow is for", desc: "HR teams, operators, founders and staffing agencies." }}
      />
    </SiteShell>
  );
}
