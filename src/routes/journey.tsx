import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/journey")({
  head: () =>
    marketingHead(undefined, "/journey", {
      title: "Candidate journey — from application to hire | TaaSFlow",
      description:
        "See exactly what happens after you apply: how your CV is reviewed, how evidence is captured, and how you stay informed at every stage.",
    }),
  component: JourneyPage,
});

const STEPS = [
  {
    n: "01",
    t: "Apply in minutes",
    d: "Upload your CV, answer a few role-specific questions, and confirm consent. You get an application reference immediately.",
  },
  {
    n: "02",
    t: "Information reviewed",
    d: "Your CV is parsed and matched against the role's requirements. No black boxes — every match is evidence-backed.",
  },
  {
    n: "03",
    t: "Under consideration",
    d: "A recruiter reviews the evidence and writes a fit narrative. Strong candidates are ranked and delivered to the hiring team.",
  },
  {
    n: "04",
    t: "Shortlisted",
    d: "You're on the client's shortlist. We reach out with next steps and prep material.",
  },
  {
    n: "05",
    t: "Interview requested",
    d: "The client requests an interview. You'll see the format, the interviewers, and what they're looking for.",
  },
  {
    n: "06",
    t: "Decision",
    d: "Offer, further round, or a clear no with reasons. Every outcome is recorded in your candidate workspace.",
  },
] as const;

function JourneyPage() {
  return (
    <SiteShell>
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            For candidates
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Your journey, in the open.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Most recruiting is a black box. TaaSFlow shows you exactly where you
            stand — from the day you apply to the final decision.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/jobs"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Browse open roles
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Candidate login
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <ol className="space-y-6">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <div className="shrink-0 text-2xl font-bold text-primary tabular-nums">
                {s.n}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{s.t}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What you can expect</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Clear status updates", "Real-time updates in your workspace — no wondering."],
              ["Honest feedback", "If it's a no, you'll know why. No ghosting."],
              ["Your data, your control", "Withdraw consent or delete your profile anytime."],
              ["Direct messaging", "Talk to your recruiter without email chains."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-border/60 bg-card p-5">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
