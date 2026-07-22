import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("index");

export const Route = createFileRoute("/")({
  head: () =>
    marketingHead(entry, "/", {
      title: "TaaSFlow — Subscription recruiting. Ranked candidates in 14 days.",
      description:
        "TaaSFlow delivers ranked, enriched shortlists in 14 days for a flat monthly fee. No placement fees, ever.",
    }),
  component: Home,
});

function Home() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center gap-6">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              Talent as a Service
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Your hiring team.
              <br />
              On demand.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              TaaSFlow is a subscription recruiting model. We deliver ranked, enriched
              candidates in 14 days — tracked in a live dashboard, for one flat monthly
              fee. No placement fees. Ever.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/intake"
                className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Start hiring
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
              >
                See how it works
              </Link>
              <Link
                to="/pilot"
                className="rounded-md px-5 py-3 text-sm font-semibold text-primary hover:underline"
              >
                Start a $399 pilot →
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Ranked candidates · Live dashboard · No placement fees ·{" "}
              <Link to="/jobs" className="underline hover:text-foreground">
                Looking for a role? Browse jobs
              </Link>
            </p>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "20,000+", v: "Candidates placed" },
                { k: "50+", v: "Countries covered" },
                { k: "14 days", v: "To first shortlist" },
                { k: "80+", v: "Companies served" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
                >
                  <div className="text-2xl font-bold text-foreground">{s.k}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          {[
            {
              t: "Ranked shortlist",
              d: "Every candidate scored 0–100 across Role Fit, Evidence, Logistics, and Signal.",
            },
            {
              t: "Enriched profiles",
              d: "Recruiter-written fit narratives, strengths, and gaps for every candidate.",
            },
            {
              t: "Live dashboard",
              d: "Shortlist, interview, reject, or request more information in one click.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-border/60 bg-card p-6">
              <h3 className="text-lg font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {entry ? (
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Markdown>{entry.markdown}</Markdown>
        </section>
      ) : null}

      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            Start hiring without the placement fee.
          </h2>
          <p className="mt-3 text-muted-foreground">
            One flat monthly fee. Ranked, enriched candidates every week. A live
            dashboard so you always know where each role stands.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start hiring
            </Link>
            <Link
              to="/contact"
              className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Book a 20-min intro call
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
