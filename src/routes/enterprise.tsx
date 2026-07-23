import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import { EnterpriseStakeholderSelector } from "@/components/marketing/enterprise-stakeholder-selector";
import {
  Building2,
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

// Enterprise metadata authored inline. Legacy JSON contained unapproved
// commercial and volume claims — kept out on purpose.
export const Route = createFileRoute("/enterprise")({
  head: () =>
    marketingHead(undefined, "/enterprise", {
      title: "Enterprise — TaaSFlow for scale hiring",
      description:
        "Run parallel searches across teams and business units on one operating system. Shared workspace, ranked delivery, evidence per requirement, and account-level reporting — with a direct handover after shortlist.",
    }),
  component: EnterprisePage,
});

function EnterprisePage() {
  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-10 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Enterprise
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Your hiring function. Scaled. On one workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Every open role, every ranked candidate, every piece of evidence —
            in a single account your TA, hiring managers, and executives share.
            Human recruiters + AI-supported structure. Flat subscription;
            direct handover after shortlist.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Book Enterprise Consultation
            </Link>
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Start Hiring
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Challenges of scale hiring ───────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
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

      {/* ── TaaSFlow enterprise operating model ──────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            The operating model
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            One account. Many searches. Same standard of evidence.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
            An enterprise account is structured around your organization — business units,
            role families, and hiring teams — with recruiter pods aligned to them. Every
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
              title="Aligned recruiter pods"
              body="Dedicated pods per role family or business unit. Standards stay consistent as volume changes and new requisitions open."
            />
            <Pillar
              icon={<Layers className="h-5 w-5" aria-hidden />}
              title="One workspace, many pipelines"
              body="Every open role is a separate pipeline inside the same Client workspace — no context switching between tools per requisition."
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Multi-role & multi-stakeholder visibility ────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Multi-role visibility
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Every stakeholder sees the same picture.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/75">
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
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <RankedEvidenceMock />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Ranking & evidence at scale
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Every candidate. Every requirement. Every role.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/75">
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
        </PublicPage>
      </PublicSection>

      {/* ── Workspace transparency & reporting ───────────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Transparency & reporting
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
                Live account view — not a monthly export.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/75">
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Collaboration
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            One thread per role. No forwarded emails.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
            TA, hiring managers, and the TaaSFlow pod work in the same workspace with the
            same context. Decisions and reasons are captured next to the candidate they
            apply to — not lost in email threads.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Pillar
              icon={<MessagesSquare className="h-5 w-5" aria-hidden />}
              title="In-workspace messaging"
              body="Direct thread with your recruiter pod, scoped per role. No side channels."
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

      {/* ── Security & support positioning ───────────────────────── */}
      <PublicSection className="py-10 bg-[color:var(--brand-cream)]">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Security & support
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Enterprise access, private data, dedicated recruiter contact.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              title="Role-based access"
              body="Access scoped to business unit, team, or requisition. People see what they own — and only that."
            />
            <Pillar
              icon={<Eye className="h-5 w-5" aria-hidden />}
              title="Tenant isolation"
              body="Every enterprise account is isolated. Your candidates and pipelines are not visible outside your tenant."
            />
            <Pillar
              icon={<MessagesSquare className="h-5 w-5" aria-hidden />}
              title="Named recruiter contact"
              body="You always know who to talk to. Your recruiter pod is a direct message in the workspace — not a ticket queue."
            />
          </div>
          <p className="mt-6 text-xs text-[color:var(--brand-navy)]/55">
            Specific security certifications, integrations, and support SLAs are confirmed
            during your enterprise consultation and scoped to your account.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Enterprise engagement path ───────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Engagement path
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            From consultation to a live enterprise account.
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            <Step step="01" title="Consultation" body="Scope your role families, business units, expected volume, and stakeholders." />
            <Step step="02" title="Account design" body="We model business units, hiring teams, permissions, and reporting to match your org." />
            <Step step="03" title="Pod alignment" body="Dedicated recruiter pods are assigned to role families with consistent standards." />
            <Step step="04" title="Launch & iterate" body="Requisitions open in the workspace. Ranked delivery begins. Reviews cadence is set." />
          </ol>
        </PublicPage>
      </PublicSection>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <CtaSection
        eyebrow="Enterprise"
        title="Design your enterprise recruiting account."
        description="Book a consultation to scope role families, business units, and reporting. Or start a single search today and expand from there."
        primary={{ to: "/contact", label: "Book Enterprise Consultation" }}
        secondary={{ to: "/intake", label: "Start Hiring" }}
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
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
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
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
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
      <p className="mt-1.5 text-xs text-[color:var(--brand-navy)]/70">{body}</p>
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
      <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/50">
        {step}
      </span>
      <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
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
        <span className="ml-3 min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--brand-navy)]/70">
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
                <div className="truncate text-xs text-[color:var(--brand-navy)]/60">
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
            <div className="text-xs text-[color:var(--brand-navy)]/60">
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
              <span className="truncate text-xs text-[color:var(--brand-navy)]/75">
                {r.label}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)]"
                  style={{ width: `${r.score}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-[color:var(--brand-navy)]/70">
                {r.score}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-[color:var(--brand-cream)] p-3 text-xs italic text-[color:var(--brand-navy)]/75">
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
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--brand-navy)]/60">
            Open requisitions
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--brand-navy)]">
            37
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--brand-navy)]/60">
            across 6 business units
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--brand-navy)]/60">
            Active candidates
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--brand-navy)]">
            412
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--brand-navy)]/60">
            across all pipelines
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--brand-navy)]/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/60">
            Stage distribution
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-[color:var(--brand-navy)]/40" aria-hidden />
        </div>
        <div className="space-y-1.5">
          {stages.map((s) => (
            <div key={s.label} className="grid grid-cols-[110px_1fr_36px] items-center gap-2">
              <span className="truncate text-[11px] text-[color:var(--brand-navy)]/75">
                {s.label}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)]"
                  style={{ width: `${(s.n / max) * 100}%` }}
                />
              </div>
              <span className="text-right text-[11px] font-semibold text-[color:var(--brand-navy)]/70">
                {s.n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MockChrome>
  );
}
