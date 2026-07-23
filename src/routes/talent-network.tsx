import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import {
  Search,
  UserPlus,
  LogIn,
  Users,
  Sparkles,
  ShieldCheck,
  Inbox,
  ArrowRight,
  ClipboardList,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/talent-network")({
  head: () =>
    marketingHead(undefined, "/talent-network", {
      title: "Talent Network — TaaSFlow",
      description:
        "Join the TaaSFlow Talent Network. Browse open roles, join for private matching to future briefs, and stay in control of your visibility and data.",
    }),
  component: TalentNetworkPage,
});

function TalentNetworkPage() {
  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-10 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Talent Network
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Be considered for the right roles &mdash; on your terms.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Browse roles that are open today, or join the network so we can match you to briefs
            as they come in. Your profile stays private until you choose to be considered.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/jobs"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Browse Open Roles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              to="/candidate-join"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Join the Talent Network
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)]"
            >
              <LogIn className="h-4 w-4" />
              Candidate Sign In
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Three primary paths ─────────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Browse open roles",
                body: "See roles that are actively hiring today. Apply directly to the ones that fit.",
                cta: { label: "Browse Open Roles", to: "/jobs" },
              },
              {
                icon: UserPlus,
                title: "Join the network",
                body: "Add your profile once and be considered for future roles that match your background.",
                cta: { label: "Join the Talent Network", to: "/candidate-join" },
              },
              {
                icon: LogIn,
                title: "Candidate sign in",
                body: "Already applied or joined the network? Sign in to update your profile and check applications.",
                cta: { label: "Candidate Sign In", to: "/login" },
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <card.icon className="h-6 w-6 text-[color:var(--brand-navy)]" />
                <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm text-[color:var(--brand-navy)]/70">{card.body}</p>
                <Link
                  to={card.cta.to}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:opacity-80"
                >
                  {card.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Who this is for ─────────────────────────────────────── */}
      <PublicSection className="bg-[color:var(--brand-cream)] py-16">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Who this network is for
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                Experienced professionals who want to be found for the right work
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/70">
                The network is designed for candidates who value quality of match over volume of
                outreach. You choose what to share, and you only surface for roles where the
                brief fits.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Senior individual contributors and specialists",
                "Managers and leaders across functions",
                "Consultants and operators between engagements",
                "Professionals open to selective, well-scoped roles",
                "People who prefer briefed matches over cold pitches",
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

      {/* ── How matching works ──────────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            How matching works
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            When a client opens a role, we look at the requirements and see which network
            candidates are a genuine fit. If your background matches, we&rsquo;ll reach out with
            the brief so you can decide whether to be considered.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ClipboardList,
                title: "Structured brief",
                body: "Each role has a clear set of requirements. Matching is against the brief, not against keywords alone.",
              },
              {
                icon: Users,
                title: "Fit review",
                body: "We check the network for candidates whose background genuinely matches the role.",
              },
              {
                icon: Inbox,
                title: "You get the brief",
                body: "If your profile fits, we share the role privately so you can decide whether to move forward.",
              },
              {
                icon: Sparkles,
                title: "You stay in control",
                body: "Only your explicit go-ahead surfaces your profile for a specific role.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <step.icon className="h-6 w-6 text-[color:var(--brand-navy)]" />
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{step.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Privacy & control ───────────────────────────────────── */}
      <PublicSection className="bg-[color:var(--brand-cream)] py-16">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                Privacy and control
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                Your profile, your choices
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/70">
                Joining the network doesn&rsquo;t put your profile in front of any employer. Your
                information stays private until you decide to be considered for a specific role.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                { icon: ShieldCheck, text: "Your profile isn't shared publicly or browsed by employers." },
                { icon: Eye, text: "Nothing surfaces to a client until you approve consideration for a role." },
                { icon: UserPlus, text: "You can update, pause, or delete your profile at any time from your workspace." },
                { icon: Inbox, text: "You choose which briefs to respond to — there's no obligation to move forward." },
              ].map((item) => (
                <li key={item.text} className="flex gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-navy)]" />
                  <span className="text-[color:var(--brand-navy)]/80">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── What happens after joining ──────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What happens after joining
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/70">
            Joining takes a few minutes. From there, activity is quiet by design — we only
            reach out when there&rsquo;s a real reason to.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                n: "01",
                title: "Create your profile",
                body: "Share your background, experience, and the kind of work you&rsquo;re open to.",
              },
              {
                n: "02",
                title: "Access your workspace",
                body: "A candidate workspace where you can update your profile and see any roles you&rsquo;ve applied to.",
              },
              {
                n: "03",
                title: "Receive relevant briefs",
                body: "When a role fits, we send you the brief privately so you can decide whether to move forward.",
              },
              {
                n: "04",
                title: "Choose to be considered",
                body: "If a role is interesting, you confirm consideration and we take it from there.",
              },
              {
                n: "05",
                title: "Follow the process",
                body: "Track application status, next steps, and messages inside your workspace.",
              },
              {
                n: "06",
                title: "Stay in control",
                body: "Update preferences, pause matching, or remove your profile whenever you need to.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <span className="text-sm font-semibold text-[color:var(--brand-navy)]/50">
                  {step.n}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p
                  className="mt-2 text-sm text-[color:var(--brand-navy)]/70"
                  dangerouslySetInnerHTML={{ __html: step.body }}
                />
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <div className="rounded-2xl bg-[color:var(--brand-navy)] px-6 py-14 text-white sm:px-12 sm:py-16">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-white">
                  Ready when you are.
                </h2>
                <p className="mt-3 max-w-2xl text-white/70">
                  See what&rsquo;s open today, or join the network so the right role can come to
                  you.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/jobs"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:opacity-90"
                >
                  Browse Open Roles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  to="/candidate-join"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Join the Talent Network
                </Link>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white"
                >
                  <LogIn className="h-4 w-4" />
                  Candidate Sign In
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
