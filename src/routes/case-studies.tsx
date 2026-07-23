import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, FileText, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () =>
    marketingHead(entry, "/case-studies", {
      title: "Case studies — TaaSFlow",
      description:
        "Documented recruiting engagements with client-approved outcomes. No invented metrics, no composite stories.",
    }),
  component: CaseStudiesPage,
});

// APPROVED case studies only — must have written client sign-off and
// metrics verifiable from TaaSFlow delivery records or the client's ATS.
// Fabricated stories, composite numbers, and stylized quotes are forbidden.
type CaseStudy = {
  slug: string;
  industry: string;
  client: string;
  headline: string;
  challenge: string;
  approach: string;
  result: string;
  featured?: boolean;
};

const APPROVED: CaseStudy[] = [];

const FEATURED = APPROVED.find((c) => c.featured);
const GRID = APPROVED.filter((c) => c !== FEATURED);

function EmptyState() {
  return (
    <div className="mt-14 rounded-3xl border border-dashed border-border/60 bg-muted/20 p-10 md:p-14">
      <div className="max-w-3xl">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          Approved case studies are being finalized
        </h2>
        <p className="mt-3 text-muted-foreground">
          Early engagements are under client review. Rather than publish
          unverified numbers or composite stories, we wait for written sign-off
          on every outcome, quote, and attribution before adding it here.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          To see how a TaaSFlow engagement is structured today, review the
          delivery model and workspace walkthrough below.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/how-it-works"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            See how it works
          </Link>
          <Link
            to="/intake"
            className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Start hiring
          </Link>
          <Link
            to="/contact"
            className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </div>
  );
}

function StudyCard({ study, featured }: { study: CaseStudy; featured?: boolean }) {
  return (
    <article
      className={`flex flex-col rounded-2xl border border-border/60 bg-card p-6 md:p-8 ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
        {featured ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : null}
        <span>{study.industry}</span>
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        {study.headline}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong className="text-foreground">Client:</strong> {study.client}
      </p>
      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Challenge
          </dt>
          <dd className="mt-1.5 text-sm">{study.challenge}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            TaaSFlow approach
          </dt>
          <dd className="mt-1.5 text-sm">{study.approach}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Result
          </dt>
          <dd className="mt-1.5 text-sm">{study.result}</dd>
        </div>
      </dl>
    </article>
  );
}

function CaseStudiesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Case studies
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Documented engagements — not marketing claims
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            TaaSFlow publishes case studies only when the client approves the
            story in writing and every outcome is verifiable from delivery
            records.
          </p>
        </header>

        {APPROVED.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-12 space-y-10">
            {FEATURED && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Featured study
                </p>
                <div className="mt-4">
                  <StudyCard study={FEATURED} featured />
                </div>
              </div>
            )}
            {GRID.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  All studies
                </p>
                <ul className="mt-4 grid gap-6 md:grid-cols-2">
                  {GRID.map((c) => (
                    <li key={c.slug}>
                      <StudyCard study={c} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <section className="mt-16 rounded-2xl border border-border/60 bg-background p-6 md:p-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            Publishing policy
          </h2>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Only published with explicit written client approval.</li>
            <li>
              Every metric traceable to TaaSFlow delivery records or the
              client's ATS.
            </li>
            <li>No composite, stylized, or "typical customer" numbers.</li>
            <li>Quotes attributed to a real, named person at the client.</li>
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-muted/20 p-8 md:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Prefer to see delivery live?
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start hiring with TaaSFlow and see sourcing, scoring, and shortlist
            delivery inside your own dedicated workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start Hiring
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              See How It Works
            </Link>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
