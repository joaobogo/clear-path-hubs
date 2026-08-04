import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import { EnterpriseStakeholderSelector } from "@/components/marketing/enterprise-stakeholder-selector";
import {
  Building2,
  Globe2,
  Lock,
  ListChecks,
  CalendarClock,
  Scale,
  Layers,
  Users,
  Eye,
  Gauge,
  ShieldCheck,
  MessagesSquare,
  LineChart,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { PageConnections } from "@/components/marketing/page-connections";
import { AgencyFeeComparison } from "@/components/marketing/agency-fee-comparison";
import {
  PRICE_SUB_BRONZE_DISPLAY,
  PRICE_SUB_SILVER_DISPLAY,
  PRICE_SUB_GOLD_DISPLAY,
  PRICE_SUB_ENTERPRISE_DISPLAY,
  SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL,
  POSITION_BANDS,
} from "@/config/pricing-core";

// Enterprise metadata authored inline. Legacy JSON contained unapproved
// commercial and volume claims — kept out on purpose.
export const Route = createFileRoute("/enterprise")({
  head: () =>
    marketingHead(undefined, "/enterprise", {
      title: "Enterprise Hiring Intelligence | TaaSFlow",
      description:
        "The AI Hiring Intelligence Platform for teams hiring at scale: ranked, evidence-backed shortlists, governance controls and audit trails in one workspace.",
    }),
  component: EnterprisePage,
});

const DECISION_PATH = [
  { href: "#volume", label: "Hiring volume" },
  { href: "#governance", label: "Dashboard governance" },
  { href: "#quality", label: "Candidate quality controls" },
  { href: "#reporting", label: "Reporting" },
  { href: "#regions", label: "Regions served" },
  { href: "#compliance", label: "Compliance & privacy" },
  { href: "#cost", label: "Cost model" },
  { href: "#timeline", label: "Implementation" },
];

// Subscription programmes start at 11+ active roles (POSITION_BANDS.subscription).
// Buyers with 1–10 roles purchase the one-off packages instead — see /pricing.
const VOLUME_BANDS = [
  {
    band: "Bronze — up to 15 positions / month",
    price: PRICE_SUB_BRONZE_DISPLAY,
    cadence: "Weekly ranked delivery",
    agentCapacity: "One agent capacity block",
    fit: "A single function hiring steadily — usually one hiring manager group.",
  },
  {
    band: "Silver — 16–30 positions / month",
    price: PRICE_SUB_SILVER_DISPLAY,
    cadence: "Weekly delivery per role family",
    agentCapacity: "Agent capacity per role family",
    fit: "Two or three functions hiring in parallel with shared standards.",
  },
  {
    band: "Gold — 31–50 positions / month",
    price: PRICE_SUB_GOLD_DISPLAY,
    cadence: "Twice-weekly delivery on priority roles",
    agentCapacity: "Agent capacity plus a named account lead",
    fit: "Multi-business-unit hiring with executive reporting.",
  },
  {
    band: "Enterprise — 50+ or continuous hiring",
    price: PRICE_SUB_ENTERPRISE_DISPLAY,
    cadence: "Cadence agreed per business unit",
    agentCapacity: "Programme-scale agent capacity",
    fit: "Programme hiring where volume shifts by quarter.",
  },
];

const QUALITY_CONTROLS = [
  {
    title: "Approved criteria before sourcing",
    body: "No search starts until must-haves, nice-to-haves and weightings are signed off in writing at intake.",
  },
  {
    title: "Every claim quoted from the CV",
    body: "Each score line carries the source text it came from, so a hiring committee can check the reasoning.",
  },
  {
    title: "Human review before delivery",
    body: "A recruiter reads and signs off every shortlist. Nothing reaches your dashboard unread.",
  },
  {
    title: "Rescoring when the role changes",
    body: "Change the brief and affected candidates are flagged for re-review rather than left on a stale score.",
  },
  {
    title: "Consistent rubric across every role family",
    body: "The same role family is scored against the same rubric version, whichever recruiter runs the search.",
  },
  {
    title: "Reasons captured on every decision",
    body: "Advance, hold and pass all require a reason code, which feeds calibration for the next batch.",
  },
];

const REGIONS = [
  {
    title: "EMEA",
    body: "UK, EU-27, EFTA and select MENA markets, with local time-zone screening and language filters.",
  },
  {
    title: "Americas",
    body: "North America, LATAM and the Caribbean, with time-zone-aligned pipelines for cross-region teams.",
  },
  {
    title: "APAC",
    body: "Australia, New Zealand, India, Singapore and Southeast Asia, with explicit local-hours filters.",
  },
];

const COMPLIANCE_POSTURE = [
  {
    title: "Tenant isolation by default",
    body: "Every account is isolated at the database layer. Your candidates and pipelines are never visible to another tenant.",
  },
  {
    title: "Least-privilege access",
    body: "Access is scoped to business unit, team or requisition, and candidate contact details are released deliberately, not by default.",
  },
  {
    title: "Consent captured at source",
    body: "Candidates apply directly and consent to processing. CVs are stored as PDFs in private storage with time-limited access links.",
  },
  {
    title: "Audit trail on record changes",
    body: "Score changes, decisions, releases and exports are logged with actor and timestamp for internal review.",
  },
  {
    title: "Data subject requests",
    body: "Candidate export and deletion requests are handled on request, including removal from active pipelines.",
  },
  {
    title: "Scoped in your review",
    body: "DPAs, sub-processor lists, retention windows and security questionnaires are completed during onboarding.",
  },
];

const IMPLEMENTATION = [
  { step: "Week 0", title: "Scoping call", body: "Role families, business units, expected volume, stakeholders and reporting needs." },
  { step: "Week 1", title: "Account design", body: "Business units, hiring teams, permissions and dashboards configured to match your org." },
  { step: "Week 1–2", title: "Intake and calibration", body: "Criteria and weightings approved per role family. Agent capacity assigned and oversight briefed." },
  { step: "Week 2–3", title: "First ranked shortlists", body: "Delivery begins in the workspace, 7–14 days from an approved brief." },
  { step: "Ongoing", title: "Review cadence", body: "Calibration on the first batches, then a standing review on volume, quality and cycle time." },
];

function EnterprisePage() {
  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-10 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Enterprise
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Your hiring function. Scaled. On one workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            Every open role, every ranked candidate, every piece of evidence —
            in a single account your TA, hiring managers, and executives share.
            Agents run the search, with configurable expert oversight. Flat subscription;
            direct handover after shortlist.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Build an enterprise recruiting plan
            </Link>
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-center text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Start with one search
            </Link>
          </div>

          <nav aria-label="Enterprise decision path" className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              What enterprise buyers ask
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {DECISION_PATH.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-4 text-sm font-medium text-[color:var(--brand-navy)]/85 transition-colors hover:border-[color:var(--brand-navy)]/35 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </PublicPage>
      </PublicSection>

      {/* ── Challenges of scale hiring ───────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            The challenge
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Scale hiring breaks the tools built for one role at a time.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <IssueCard
              title="Fragmented pipelines"
              body="Roles live in different spreadsheets, ATSes, and inboxes. Nobody has a single view of what is actually happening."
            />
            <IssueCard
              title="Inconsistent criteria"
              body="Every recruiter scores differently. Hiring managers see different signals for what is supposedly the same role."
            />
            <IssueCard
              title="Black-box agencies"
              body="Batches of résumés arrive without evidence. Decisions rely on trust rather than what the CV actually says."
            />
            <IssueCard
              title="Stakeholder churn"
              body="TA leads, business partners, and hiring managers all need context — and end up reconstructing it in status meetings."
            />
            <IssueCard
              title="No handover story"
              body="Interviews start with no shared record of what was assessed at sourcing, so questions get repeated and time is lost."
            />
            <IssueCard
              title="Reporting after the fact"
              body="Cycle time and stage health are calculated retroactively from stale exports rather than a live account view."
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Hiring volume ────────────────────────────────────────── */}
      <PublicSection id="volume" className="scroll-mt-24 py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Hiring volume
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            How the model scales with your requisition count.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            Subscription programmes cover {POSITION_BANDS.subscription.min}+ active roles or
            continuous hiring. Volume can move up or down between review
            cycles — {SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL.toLowerCase()} on subscriptions.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            Hiring {POSITION_BANDS.pilot.min}–{POSITION_BANDS.sprint.max} roles? Those buy the
            one-off packages instead — Pilot, Multi Position or Hiring Sprint on the{" "}
            <Link to="/pricing" className="font-semibold underline underline-offset-4">
              pricing page
            </Link>
            .
          </p>

          <ul className="mt-8 space-y-3 md:hidden">
            {VOLUME_BANDS.map((b) => (
              <li key={b.band} className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-[color:var(--brand-navy)]">{b.band}</span>
                  <span className="shrink-0 font-semibold text-[color:var(--brand-navy)]">{b.price}</span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--brand-navy)]/80">{b.fit}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-[color:var(--brand-navy)]/70">Cadence:</dt>
                    <dd className="text-[color:var(--brand-navy)]/85">{b.cadence}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-[color:var(--brand-navy)]/70">Coverage:</dt>
                    <dd className="text-[color:var(--brand-navy)]/85">{b.agentCapacity}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">

              <caption className="sr-only">
                Subscription bands by number of active roles
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/[0.03]">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">Subscription programme</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">Monthly</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">System operating cadence</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">Agent capacity and oversight</th>
                </tr>
              </thead>
              <tbody>
                {VOLUME_BANDS.map((b) => (
                  <tr key={b.band} className="border-b border-[color:var(--brand-navy)]/8 align-top">
                    <td className="px-4 py-4">
                      <span className="font-semibold text-[color:var(--brand-navy)]">{b.band}</span>
                      <span className="mt-1 block text-xs text-[color:var(--brand-navy)]/80">{b.fit}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-[color:var(--brand-navy)]">{b.price}</td>
                    <td className="px-4 py-4 text-[color:var(--brand-navy)]/80">{b.cadence}</td>
                    <td className="px-4 py-4 text-[color:var(--brand-navy)]/80">{b.agentCapacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
            Bands are indicative. Your plan is scoped to your role families and approved before anything starts.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── TaaSFlow enterprise operating model ──────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            The operating model
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            One account. Many searches. Same standard of evidence.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            An enterprise account is structured around your organization — business units,
            role families, and hiring teams — with agent capacity aligned to them. Every
            search follows the same intake, sourcing, and ranked-delivery workflow, so
            standards travel across roles instead of resetting per requisition.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Pillar
              icon={<Building2 className="h-5 w-5" aria-hidden />}
              title="Account structure"
              body="Business units, teams, and hiring managers modeled explicitly so requisitions, permissions, and reporting line up with how you actually operate."
            />
            <Pillar
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="Aligned agent capacity"
              body="Dedicated agent capacity per role family or business unit. Standards stay consistent as volume changes and new requisitions open."
            />
            <Pillar
              icon={<Layers className="h-5 w-5" aria-hidden />}
              title="One workspace, many pipelines"
              body="Every open role is a separate pipeline inside the same Client workspace — no context switching between tools per requisition."
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Stakeholder selector ─────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Stakeholder view
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Pick your seat at the table.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            The same account looks different depending on who is signed in.
            Choose your role to see what the workspace shows you, what matters
            to you, and why it holds up in review.
          </p>
          <div className="mt-8">
            <EnterpriseStakeholderSelector />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Multi-role & multi-stakeholder visibility ────────────── */}
      <PublicSection id="governance" className="scroll-mt-24 py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Multi-role visibility
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Every stakeholder sees the same picture.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                TA leaders see the full requisition portfolio. Hiring managers see their own
                pipelines. Business partners see progress across their org. Nobody is stuck
                asking a recruiter for a status update in a DM.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Requisition portfolio view for TA leadership",
                  "Role-scoped pipelines for hiring managers",
                  "Business-unit rollups for people partners",
                  "Role-based access so people see the pipelines they own",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <RequisitionPortfolioMock />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Ranking & evidence at scale ──────────────────────────── */}
      <PublicSection id="quality" className="scroll-mt-24 py-10">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <RankedEvidenceMock />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Ranking & evidence at scale
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Every candidate. Every requirement. Every role.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                Candidates arrive scored against the requirements your team actually
                approved at intake — with recruiter-written fit notes and quotes from the CV
                that make the score defensible in a hiring committee.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-[color:var(--brand-navy)]/80">
                {[
                  "Role-specific scoring aligned to your intake",
                  "Evidence per requirement, not one blanket score",
                  "Recruiter-written fit narratives",
                  "Same standard applied across every role",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h3 className="mt-14 font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
            The controls behind every shortlist.
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUALITY_CONTROLS.map((c) => (
              <div key={c.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <div className="flex items-start gap-2.5">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                  <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">{c.title}</h4>
                </div>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{c.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Workspace transparency & reporting ───────────────────── */}
      <PublicSection id="reporting" className="scroll-mt-24 py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Transparency & reporting
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Live account view — not a monthly export.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                The workspace is the report. Requisition health, stage distribution,
                sourcing throughput and decision reasons update as work happens — and
                everything is exportable for board reviews and internal reviews.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <MiniCard
                  icon={<Gauge className="h-4 w-4" aria-hidden />}
                  label="Requisition health"
                  body="At-a-glance view of every open role."
                />
                <MiniCard
                  icon={<LineChart className="h-4 w-4" aria-hidden />}
                  label="Cycle-time signals"
                  body="Time in stage, not lagging averages."
                />
                <MiniCard
                  icon={<Eye className="h-4 w-4" aria-hidden />}
                  label="Decision audit"
                  body="Who moved a candidate, when, and why."
                />
                <MiniCard
                  icon={<ClipboardList className="h-4 w-4" aria-hidden />}
                  label="Export for reviews"
                  body="Board-ready and internal-review outputs."
                />
              </div>
            </div>
            <ReportingMock />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Collaboration across hiring teams ────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Collaboration
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            One thread per role. No forwarded emails.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            TA, hiring managers, and your platform experts work in the same workspace with the
            same context. Decisions and reasons are captured next to the candidate they
            apply to — not lost in email threads.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Pillar
              icon={<MessagesSquare className="h-5 w-5" aria-hidden />}
              title="In-workspace messaging"
              body="Direct thread with your platform experts, scoped per role. No side channels."
            />
            <Pillar
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="Multi-manager assignment"
              body="Assign multiple hiring managers per requisition with role-based access."
            />
            <Pillar
              icon={<Eye className="h-5 w-5" aria-hidden />}
              title="Shared decision record"
              body="Every advance, hold, and pass is recorded with the reason — visible to your team."
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Regions served ───────────────────────────────────────── */}
      <PublicSection id="regions" className="scroll-mt-24 py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Regions served
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Where sourcing agents look, and how location is enforced.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {REGIONS.map((r) => (
              <Pillar key={r.title} icon={<Globe2 className="h-5 w-5" aria-hidden />} title={r.title} body={r.body} />
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            Time-zone and right-to-work constraints are captured at intake and enforced in scoring, so
            a candidate who cannot legally or practically work the role never reaches your shortlist.{" "}
            <Link to="/global-talent" className="font-semibold underline underline-offset-4">
              More on global coverage
            </Link>
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Security & support positioning ───────────────────────── */}
      <PublicSection id="compliance" className="scroll-mt-24 py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Security & support
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Compliance and privacy posture, stated plainly.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            What holds today, and what gets confirmed in writing before you sign.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPLIANCE_POSTURE.map((c) => (
              <div key={c.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <div className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                  <h3 className="text-sm font-semibold text-[color:var(--brand-navy)]">{c.title}</h3>
                </div>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              title="Role-based access"
              body="Access scoped to business unit, team, or requisition. People see what they own — and only that."
            />
            <Pillar
              icon={<Eye className="h-5 w-5" aria-hidden />}
              title="Named recruiter contact"
              body="You always know who to talk to. Your platform expert is a direct message in the workspace — not a ticket queue."
            />
            <Pillar
              icon={<MessagesSquare className="h-5 w-5" aria-hidden />}
              title="Security review support"
              body="We complete your questionnaire, DPA and sub-processor review as part of onboarding, not after go-live."
            />
          </div>
          <p className="mt-6 text-xs text-[color:var(--brand-navy)]/80">
            Specific security certifications, integrations, and support SLAs are confirmed
            during your enterprise consultation and scoped to your account.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Cost model ───────────────────────────────────────────── */}
      <PublicSection id="cost" className="scroll-mt-24 py-10">
        <PublicPage>
          <div className="flex items-start gap-3">
            <Scale className="mt-1 h-5 w-5 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
            <p className="text-sm text-[color:var(--brand-navy)]/80">
              At enterprise volume the difference is structural: a placement fee scales with every
              hire and every salary. A subscription does not.
            </p>
          </div>
          <div className="mt-8">
            <AgencyFeeComparison />
          </div>
          <div className="mt-8">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Build an enterprise recruiting plan
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Enterprise engagement path ───────────────────────────── */}
      <PublicSection id="timeline" className="scroll-mt-24 py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Implementation timeline
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            From first call to first shortlist in weeks, not quarters.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
            No integration project, no data migration, no implementation fee. Your team logs into a
            workspace that is already configured.
          </p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {IMPLEMENTATION.map((s) => (
              <Step key={s.step} step={s.step} title={s.title} body={s.body} />
            ))}
          </ol>
          <p className="mt-6 flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/80">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Timings assume criteria are approved on schedule; scoping calls are usually booked within a week.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <CtaSection
        eyebrow="Enterprise"
        title="Build an enterprise recruiting plan."
        description="One call to scope role families, volume, governance and reporting. You get a written plan before anything starts."
        primary={{ to: "/contact", label: "Build an enterprise recruiting plan" }}
        secondary={{ to: "/pricing", label: "See pricing" }}
      />
          <PageConnections
        commercial={{ to: "/contact", label: "Talk to enterprise sales", desc: "Get a scoped rollout and pricing proposal." }}
        explainer={{ to: "/how-it-works", label: "The operating model", desc: "How multi-role portfolios run through the workspace." }}
        resource={{ to: "/case-studies", label: "Portfolio outcomes", desc: "How large teams govern hiring at scale." }}
        audience={{ to: "/global-talent", label: "Global talent options", desc: "Hire compliantly across borders." }}
      />
    </SiteShell>
  );
}

/* ── Building blocks ──────────────────────────────────────────── */

function IssueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{body}</p>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]">
        {icon}
      </div>
      <h3 className="mt-4 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{body}</p>
    </div>
  );
}

function MiniCard({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4">
      <div className="flex items-center gap-2 text-[color:var(--brand-navy)]">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-1.5 text-xs text-[color:var(--brand-navy)]/80">{body}</p>
    </div>
  );
}

function Step({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
        {step}
      </span>
      <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{body}</p>
    </li>
  );
}

/* ── Destination-product visual mocks ────────────────────────── */

function MockChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="img"
      aria-label={`TaaSFlow ${title} preview`}
      className="min-w-0 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-[color:var(--brand-navy)]/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400/70" aria-hidden />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400/70" aria-hidden />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400/70" aria-hidden />
        <span className="ml-3 min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--brand-navy)]/80">
          {title}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function RequisitionPortfolioMock() {
  const rows = [
    { role: "Senior Product Designer", unit: "Product · EU", mgr: "K. Adams", stage: "Shortlisted", pct: 78 },
    { role: "Staff Data Engineer", unit: "Platform · US", mgr: "J. Ortiz", stage: "Interview", pct: 62 },
    { role: "Enterprise AE", unit: "GTM · UK", mgr: "R. Novak", stage: "Under review", pct: 44 },
    { role: "VP Engineering", unit: "Executive · Global", mgr: "M. Chen", stage: "Sourcing", pct: 18 },
  ];
  return (
    <MockChrome title="Admin workspace · Requisition portfolio">
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.role}
            className="rounded-lg border border-[color:var(--brand-navy)]/10 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                  {r.role}
                </div>
                <div className="truncate text-xs text-[color:var(--brand-navy)]/80">
                  {r.unit} · Hiring mgr: {r.mgr}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[color:var(--brand-navy)]/8 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-navy)]">
                {r.stage}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
              <div
                className="h-full rounded-full bg-[color:var(--brand-navy)]"
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

function RankedEvidenceMock() {
  const reqs = [
    { label: "Design systems at scale", score: 96 },
    { label: "B2B SaaS experience", score: 92 },
    { label: "Team leadership", score: 88 },
    { label: "Timezone overlap (EU)", score: 100 },
  ];
  return (
    <MockChrome title="Client workspace · Ranked candidate · Evidence">
      <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[color:var(--brand-navy)]">
              Candidate #A-1042
            </div>
            <div className="text-xs text-[color:var(--brand-navy)]/80">
              Senior Product Designer · Remote · EU
            </div>
          </div>
          <div className="rounded-lg bg-[color:var(--brand-navy)]/8 px-2.5 py-1 text-sm font-semibold text-[color:var(--brand-navy)]">
            94
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {reqs.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_1fr_auto] items-center gap-3">
              <span className="truncate text-xs text-[color:var(--brand-navy)]/80">
                {r.label}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)]"
                  style={{ width: `${r.score}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-[color:var(--brand-navy)]/80">
                {r.score}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-[color:var(--brand-cream)] p-3 text-xs italic text-[color:var(--brand-navy)]/80">
          "Led the design system for a 40-engineer B2B SaaS across two product lines" —
          recruiter note, sourced from CV.
        </p>
      </div>
    </MockChrome>
  );
}

function ReportingMock() {
  const stages = [
    { label: "Applied", n: 412 },
    { label: "Under review", n: 168 },
    { label: "Shortlisted", n: 74 },
    { label: "Interview", n: 41 },
    { label: "Offer", n: 12 },
  ];
  const max = Math.max(...stages.map((s) => s.n));
  return (
    <MockChrome title="Admin workspace · Account reporting">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--brand-navy)]/80">
            Open requisitions
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--brand-navy)]">
            37
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--brand-navy)]/80">
            across 6 business units
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--brand-navy)]/80">
            Active candidates
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--brand-navy)]">
            412
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--brand-navy)]/80">
            across all pipelines
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
            Stage distribution
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-[color:var(--brand-navy)]/80" aria-hidden />
        </div>
        <div className="space-y-1.5">
          {stages.map((s) => (
            <div key={s.label} className="grid grid-cols-[110px_1fr_36px] items-center gap-2">
              <span className="truncate text-[11px] text-[color:var(--brand-navy)]/80">
                {s.label}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)]"
                  style={{ width: `${(s.n / max) * 100}%` }}
                />
              </div>
              <span className="text-right text-[11px] font-semibold text-[color:var(--brand-navy)]/80">
                {s.n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MockChrome>
  );
}
