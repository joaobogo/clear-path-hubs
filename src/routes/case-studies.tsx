import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () =>
    marketingHead(entry, "/case-studies", {
      title: "Case studies — TaaSFlow",
      description:
        "Documented recruiting engagements with real timelines and outcomes. No invented metrics.",
    }),
  component: CaseStudiesPage,
});

// Only stories with explicit client approval and verifiable outcomes appear here.
// Everything not listed below is intentionally excluded until we have the client's sign-off.
type CaseStudy = {
  slug: string;
  industry: string;
  client: string;
  title: string;
  challenge: string;
  solution: string;
  outcomes: { label: string; value: string }[];
  quote?: { text: string; attribution: string };
};

const APPROVED_CASE_STUDIES: CaseStudy[] = [];

function CaseStudiesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Case studies
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Measured results — not marketing claims
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We publish case studies only when the client approves the story and
            every metric is verifiable from our own delivery records.
          </p>
        </header>

        {APPROVED_CASE_STUDIES.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Approved case studies are being finalized
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Our earliest engagements are still under client review. Rather
              than publish unverified numbers, we're waiting for written sign-off
              on the outcomes and quotes before adding them here.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              In the meantime, the fastest way to see how TaaSFlow delivers is
              to run a paid pilot on one of your live roles — you'll see the
              full sourcing, scoring, and shortlist workflow inside your own
              dashboard within 7–14 days.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/pilot"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Start a pilot
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                See how it works
              </Link>
              <Link
                to="/contact"
                className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Talk to us
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {APPROVED_CASE_STUDIES.map((c) => (
              <li
                key={c.slug}
                className="flex flex-col rounded-2xl border border-border/60 bg-card p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {c.industry}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  <strong>Client:</strong> {c.client}
                </p>
                <p className="mt-4 text-sm">{c.challenge}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {c.solution}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-3">
                  {c.outcomes.map((o) => (
                    <div
                      key={o.label}
                      className="rounded-lg bg-muted/40 p-3 text-center"
                    >
                      <dt className="text-xs text-muted-foreground">
                        {o.label}
                      </dt>
                      <dd className="text-lg font-semibold">{o.value}</dd>
                    </div>
                  ))}
                </dl>
                {c.quote && (
                  <blockquote className="mt-6 border-l-2 border-primary/40 pl-4 text-sm italic text-muted-foreground">
                    "{c.quote.text}"
                    <footer className="mt-2 not-italic text-xs">
                      — {c.quote.attribution}
                    </footer>
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 rounded-xl border border-border/60 bg-muted/30 p-6">
          <h2 className="text-lg font-semibold">Our publishing policy</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Only published with explicit written client approval.</li>
            <li>
              Every metric traceable to our delivery records or the client's ATS.
            </li>
            <li>No composite, stylized, or "typical customer" numbers.</li>
            <li>Quotes attributed to a real, named person at the client.</li>
          </ul>
        </div>
      </section>
    </SiteShell>
  );
}
