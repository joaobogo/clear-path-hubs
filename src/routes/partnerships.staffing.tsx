import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import {
  StaffingWorkflow,
  StaffingOwnershipMatrix,
} from "@/components/marketing/staffing-workflow";
import {
  Handshake,
  Layers,
  Users,
  Eye,
  ShieldCheck,
  ClipboardList,
  Building2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/partnerships/staffing")({
  head: () =>
    marketingHead(undefined, "/partnerships/staffing", {
      title: "Staffing partnerships — TaaSFlow",
      description:
        "A partnership model for staffing and recruiting agencies. Extend delivery capacity, keep the client relationship, and operate inside a transparent workspace with ranked candidates and evidence per requirement.",
    }),
  component: PartnershipsStaffingPage,
});

function PartnershipsStaffingPage() {
  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-10 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Staffing partnerships
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            White-label recruiting execution behind your agency.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow extends staffing and search firms with ranked delivery,
            evidence per requirement, and a workspace clients can see into —
            while you keep the relationship and the fee. Human recruiters +
            AI-supported structure. Subscription, not placement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Discuss a Partnership
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              See How It Works
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Why staffing firms use TaaSFlow ─────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            Why staffing firms partner with TaaSFlow
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Agencies work with us when they need more delivery bandwidth, structured evidence
            for hiring managers, or coverage on role types outside their usual specialisation —
            without changing who owns the client.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Layers,
                title: "Expand capacity",
                body: "Take on more roles in parallel without hiring or training additional recruiters.",
              },
              {
                icon: ClipboardList,
                title: "Improve delivery quality",
                body: "Structured intake, ranked candidates, and evidence per requirement raise the bar on every shortlist.",
              },
              {
                icon: Handshake,
                title: "Keep the client relationship",
                body: "You remain the primary contact. We operate as a delivery layer behind your brand or alongside it.",
              },
              {
                icon: Eye,
                title: "Operate with transparency",
                body: "Every role, candidate, and note lives in one workspace your team and your client can trust.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <item.icon className="h-6 w-6 text-[color:var(--brand-navy)]" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{item.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Agency benefits ─────────────────────────────────────── */}
      <PublicSection className="bg-[color:var(--brand-cream)] py-16">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                For your agency
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                Delivery leverage without the overhead
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/70">
                Partner delivery is designed to slot into how your team already operates. You
                bring the client and the brief; we run structured sourcing, screening, and
                evidence work inside the same workspace you review in.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Extend delivery capacity without adding headcount",
                "Take on roles outside your usual specialisation",
                "Standardise how briefs, screens, and evidence are captured",
                "Reduce time your recruiters spend on top-of-funnel work",
                "Keep client-facing communication under your name",
                "One workspace that keeps the full search auditable",
              ].map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                  <span className="text-[color:var(--brand-navy)]/80">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Agency client benefits ──────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                For your clients
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                A better hiring experience they attribute to you
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/70">
                Your clients get ranked candidates with visible evidence, a shared review
                surface, and a consistent process across every role — while the account and
                commercial relationship stay with your agency.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Ranked candidates with evidence per requirement",
                "A shared workspace for reviews, notes, and decisions",
                "Consistent quality across every role type you deliver",
                "One clear process from brief through shortlist",
                "Visibility instead of black-box updates and PDFs",
                "Faster feedback loops with hiring managers",
              ].map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                  <span className="text-[color:var(--brand-navy)]/80">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── How partner delivery works ──────────────────────────── */}
      <PublicSection className="bg-[color:var(--brand-cream)] py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            How partner delivery works
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Partnerships are set up per account. The workflow is the same one we run for direct
            clients — adapted so your agency stays in front of the relationship.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                n: "01",
                icon: Handshake,
                title: "Partnership setup",
                body: "We align on scope, role types, brand posture, and how your clients will be introduced to the workspace.",
              },
              {
                n: "02",
                icon: ClipboardList,
                title: "Role intake",
                body: "For each role, we run a structured intake so requirements, must-haves, and context are captured cleanly.",
              },
              {
                n: "03",
                icon: Workflow,
                title: "Sourcing & screening",
                body: "Our delivery layer sources, screens, and captures evidence against each requirement.",
              },
              {
                n: "04",
                icon: Users,
                title: "Ranked shortlist",
                body: "Candidates surface in your workspace with a rank, an evidence view, and the notes your team needs.",
              },
              {
                n: "05",
                icon: Eye,
                title: "Client review",
                body: "Your client sees the same ranked view, reviews evidence, and gives feedback in the workspace.",
              },
              {
                n: "06",
                icon: MessagesSquare,
                title: "Ongoing cadence",
                body: "Your agency stays in front of decisions, interviews, and outcomes. We keep delivery moving underneath.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[color:var(--brand-navy)]/50">
                    {step.n}
                  </span>
                  <step.icon className="h-5 w-5 text-[color:var(--brand-navy)]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* ── White-label / support options ───────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            White-label or co-branded — where approved
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Depending on the partnership, delivery can be positioned in a few ways. The exact
            model is agreed together and documented per account.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Behind-the-scenes support",
                body: "TaaSFlow is invisible to your client. Your agency stays the single point of contact and delivery layer.",
              },
              {
                icon: Building2,
                title: "Co-branded workspace",
                body: "Your client sees both brands and understands your agency is delivering with a structured platform.",
              },
              {
                icon: Handshake,
                title: "White-label delivery",
                body: "Where approved, delivery runs under your agency&rsquo;s brand inside a workspace tailored to your account.",
              },
            ].map((opt) => (
              <div
                key={opt.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <opt.icon className="h-6 w-6 text-[color:var(--brand-navy)]" />
                <h3 className="mt-4 text-lg font-semibold">{opt.title}</h3>
                <p
                  className="mt-2 text-sm text-[color:var(--brand-navy)]/70"
                  dangerouslySetInnerHTML={{ __html: opt.body }}
                />
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-[color:var(--brand-navy)]/50">
            Positioning, branding, and exclusivity are confirmed in the partnership agreement.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Engagement paths ────────────────────────────────────── */}
      <PublicSection className="bg-[color:var(--brand-cream)] py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            Ways to engage
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Partnerships are shaped to your book of business. Most agencies start narrow and
            expand once the delivery model is proven inside their account.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Overflow delivery",
                body: "Send us the roles you can&rsquo;t staff this quarter. We run them inside your workspace and deliver ranked shortlists.",
              },
              {
                title: "Category extension",
                body: "Cover role types outside your specialisation — technical, functional, or regional — without hiring for them.",
              },
              {
                title: "Strategic partnership",
                body: "A defined partnership with agreed scope, cadence, and reporting. Reviewed together on a regular rhythm.",
              },
            ].map((path) => (
              <div
                key={path.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold">{path.title}</h3>
                <p
                  className="mt-2 text-sm text-[color:var(--brand-navy)]/70"
                  dangerouslySetInnerHTML={{ __html: path.body }}
                />
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <div className="rounded-2xl bg-[color:var(--brand-navy)] px-6 py-14 text-white sm:px-12 sm:py-16">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-white">
                  Let&rsquo;s design a partnership that fits your agency.
                </h2>
                <p className="mt-3 max-w-2xl text-white/70">
                  Tell us about your book, the role types you struggle to deliver, and how you
                  want your clients to experience the workspace. We&rsquo;ll take it from there.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/contact"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:opacity-90"
                >
                  Discuss a Partnership
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  See How It Works
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

    </SiteShell>
  );
}
