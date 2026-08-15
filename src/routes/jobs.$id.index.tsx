import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { useEffect } from "react";
import { track } from "@/lib/candidate/funnel-events.functions";
import { deviceBucket } from "@/lib/candidate/funnel-events";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPositionClosure, getPublicPosition, listPublicPositions } from "@/lib/jobs.functions";
import { buildJobPostingJsonLd } from "@/lib/marketing/job-posting-schema";
import { buildJobSlug, extractJobUuid } from "@/lib/marketing/job-slug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/marketing/site-shell";
import { parseJobDescription } from "@/lib/marketing/job-description";
import {
  NOT_SPECIFIED,
  RANGE_ON_CALL,
  type PublicJobFacts,
} from "@/lib/jobs/public-facts";
import {
  APPLY_STEPS,
  EFFORT_DEFAULT,
  applyEffortLine,
  applyEffortProvenance,
} from "@/lib/jobs/apply-effort";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Clock,
  ListOrdered,
  MapPin,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";



export const Route = createFileRoute("/jobs/$id/")({
  loader: async ({ context, params }) => {
    // Support both slugged (`title-uuid`) and bare UUID URLs. The DB
    // lookup always uses the trailing UUID; a bare-UUID visit 301s
    // to the canonical slugged URL for SEO consolidation.
    const uuid = extractJobUuid(params.id);
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["public-position", uuid],
      queryFn: () => getPublicPosition({ data: { id: uuid } }),
    });
    if (!data) {
      // The role may simply be over rather than missing — say so plainly.
      const closure = await getPositionClosure({ data: { id: uuid } });
      if (closure) {
        const others = await context.queryClient
          .ensureQueryData({
            queryKey: ["public-positions"],
            queryFn: () => listPublicPositions(),
          })
          .catch(() => []);
        return { closed: closure, alternatives: (others ?? []).slice(0, 3) } as const;
      }
      throw notFound();
    }
    const canonicalParam = buildJobSlug(data);
    if (params.id !== canonicalParam) {
      throw redirect({
        to: "/jobs/$id",
        params: { id: canonicalParam },
        statusCode: 301,
      });
    }
    return { closed: null, position: data } as const;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Role not available — TaaSFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    if (loaderData.closed) {
      const t = `${loaderData.closed.title} — no longer accepting applications · TaaSFlow`;
      return {
        meta: [
          { title: t },
          {
            name: "description",
            content: `This role at ${loaderData.closed.organization_name} is closed. Browse other open roles on the TaaSFlow job board.`,
          },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const pos = loaderData.position;
    if (!pos) return { meta: [{ title: "TaaSFlow job board" }] };
    const title = `${pos.title} — ${pos.organization_name} · TaaSFlow`;
    const desc = pos.description.replace(/\s+/g, " ").trim().slice(0, 155);
    const canonical = `https://taasflow.com/jobs/${buildJobSlug(pos)}`;
    const image = pos.organization_logo_url;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "TaaSFlow" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildJobPostingJsonLd(pos, canonical)),
        },
      ],
    };
  },
  // A failed load shows one error card for the whole page — never a partial
  // job with some facts missing, which reads as "the employer withheld this".
  errorComponent: makeRouteErrorComponent("public", "src/routes/jobs.$id.index.tsx"),
  pendingComponent: JobDetailPending,

  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">We couldn't find that role</h1>
        <p className="mt-3 text-muted-foreground">
          The link may be wrong or the listing may have been removed. The job board has every
          role that's open right now.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/jobs">Browse open roles</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  ),
  component: JobDetail,
});

const CLOSED_COPY: Record<string, string> = {
  filled: "This role has been filled, so applications are closed.",
  closed: "This role has closed and is no longer accepting applications.",
  archived: "This role has closed and is no longer accepting applications.",
  paused: "Hiring for this role is on hold, so applications are closed for now.",
};

function ClosedRole({
  closure,
  alternatives,
}: {
  closure: { title: string; status: string; organization_name: string };
  alternatives: Array<{ id: string; title: string; organization_name: string; location: string | null }>;
}) {
  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-20">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All open roles
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
          {closure.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{closure.organization_name}</p>
        <div
          className="mt-6 rounded-xl border bg-muted/30 p-5 text-[0.95rem] leading-relaxed"
          role="status"
        >
          {CLOSED_COPY[closure.status] ?? CLOSED_COPY.closed}{" "}
          If you already applied, your application is still tracked — you can check its status
          any time.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/jobs">Browse open roles</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/apply/status">Check an application</Link>
          </Button>
        </div>

        {alternatives.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="text-lg font-semibold tracking-tight">Open right now</h2>
            <ul className="mt-4 space-y-3">
              {alternatives.map((role) => (
                <li key={role.id}>
                  <Link
                    to="/jobs/$id"
                    params={{ id: buildJobSlug(role) }}
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{role.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {[role.organization_name, role.location].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </SiteShell>
  );
}


function labelWorkModel(m: string | null) {
  return m === "remote" ? "Remote" : m === "hybrid" ? "Hybrid" : m === "onsite" ? "Onsite" : null;
}
function labelEmployment(e: string | null) {
  return e ? e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}


/**
 * The seven deciding facts, in a fixed order, directly under the title.
 * Every row renders a value — resolvers upstream guarantee a non-empty line,
 * so a blank row is structurally impossible.
 */
function FactsBlock({ facts }: { facts: PublicJobFacts }) {
  const rows: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: Wallet, label: "Compensation", value: facts.compensation },
    { icon: Building2, label: "Work arrangement", value: facts.workArrangement },
    { icon: MapPin, label: "Location", value: facts.location },
    { icon: ShieldCheck, label: "Work authorisation", value: facts.workAuthorisation },
    { icon: Clock, label: "Employment type", value: facts.employmentType },
    { icon: ListOrdered, label: "Interview stages", value: facts.stages },
    { icon: CalendarDays, label: "Posted", value: facts.posted },
  ];
  return (
    <section aria-labelledby="job-facts" className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h2 id="job-facts" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          The deciding facts
        </h2>
        {/* Label over value at every width — a two-column row truncates the
            value on a 375px screen, which is exactly the fact people came for. */}
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-0 items-start gap-3">
              <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd
                  className={
                    isUnstated(row.value)
                      ? "text-sm italic text-muted-foreground break-words"
                      : "text-sm font-medium break-words"
                  }
                >
                  {row.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Not-specified and range-on-call read as asides, not as facts. */
function isUnstated(value: string) {
  return value.startsWith(NOT_SPECIFIED) || value === RANGE_ON_CALL;
}

/** Loading: seven skeleton rows, so the block never pops in from nothing. */
function FactsBlockSkeleton() {
  return (
    <section className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function JobDetailPending() {
  return (
    <SiteShell>
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-5 h-9 w-full max-w-lg animate-pulse rounded bg-muted" />
        </div>
      </header>
      <FactsBlockSkeleton />
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-10 sm:px-6 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </SiteShell>
  );
}






function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-foreground/90">
          <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function JobDetail() {
  const loaderData = Route.useLoaderData();
  const { id: rawId } = Route.useParams();
  const id = extractJobUuid(rawId);
  const { data: fetched } = useSuspenseQuery({
    queryKey: ["public-position", id],
    queryFn: () => getPublicPosition({ data: { id } }),
  });
  useEffect(() => {
    track("job_viewed", { position_id: id, device: deviceBucket(window.innerWidth) });
  }, [id]);
  if (loaderData.closed) {
    return (
      <ClosedRole closure={loaderData.closed} alternatives={loaderData.alternatives ?? []} />
    );
  }
  const pos = fetched;
  if (!pos) return null;

  const blocks = parseJobDescription(pos.description);
  const workModel = labelWorkModel(pos.work_model);
  const employment = labelEmployment(pos.employment_type);

  // What applying costs, stated before the button is pressed. The text is the
  // button's accessible description, so a screen reader hears the cost as part
  // of the action rather than as stray prose somewhere else on the page.
  const effort = pos.apply_effort ?? EFFORT_DEFAULT;
  const effortLine = applyEffortLine(effort, APPLY_STEPS);

  const applyButton = pos.accepting_applications ? (
    <div className="w-full sm:w-auto">
      <Button asChild size="lg" className="w-full sm:w-auto" aria-describedby="apply-effort">
        <Link to="/jobs/$id/apply" params={{ id: pos.id }}>Apply for this role</Link>
      </Button>
      <p
        id="apply-effort"
        title={applyEffortProvenance(effort)}
        className="mt-2 max-w-xs text-sm text-muted-foreground sm:text-right"
      >
        {effortLine}
      </p>
    </div>
  ) : (
    <Button size="lg" disabled className="w-full sm:w-auto">
      Applications paused
    </Button>
  );


  return (
    <SiteShell>
      {/* Header band — the role, where it is, and the one action that matters. */}
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All open roles
          </Link>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-primary">{pos.organization_name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Posted {pos.facts.posted}</span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                {pos.title}
              </h1>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {workModel && <Badge variant="secondary">{workModel}</Badge>}
                {employment && <Badge variant="outline">{employment}</Badge>}
                {pos.seniority && <Badge variant="outline">{pos.seniority}</Badge>}
                {pos.department && <Badge variant="outline">{pos.department}</Badge>}
              </div>
            </div>
            <div className="shrink-0">{applyButton}</div>
          </div>
        </div>
      </header>

      {/* Directly under the title, above the description: the block a
          candidate needs to decide whether to spend the next three minutes. */}
      <FactsBlock facts={pos.facts} />


      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {!pos.accepting_applications && (
          <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            This role is paused — applications are temporarily closed. The listing stays up so you
            can review the requirements, and applications reopen if hiring resumes.
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column: the description, rendered with real hierarchy. */}
          <div className="order-2 min-w-0 lg:order-1">

            {pos.company_intro ? (
              <section className="mb-8 rounded-xl border bg-muted/30 p-6">
                <h2 className="text-xl font-semibold tracking-tight">About the company</h2>
                <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/90">
                  {pos.company_intro}
                </p>
              </section>
            ) : null}

            <section>
              <h2 className="text-xl font-semibold tracking-tight">About the role</h2>
              <div className="mt-4 space-y-4">
                {blocks.map((block, i) =>
                  block.kind === "heading" ? (
                    <h3
                      key={i}
                      className="pt-4 text-base font-semibold tracking-tight first:pt-0"
                    >
                      {block.text}
                    </h3>
                  ) : block.kind === "list" ? (
                    <BulletList key={i} items={block.items} />
                  ) : (
                    <p key={i} className="text-[0.95rem] leading-relaxed text-foreground/90">
                      {block.text}
                    </p>
                  ),
                )}
              </div>
            </section>

            {pos.requirements.length > 0 && (
              <section className="mt-10 rounded-xl border p-6">
                <h2 className="text-xl font-semibold tracking-tight">What you need</h2>
                <BulletList items={pos.requirements} />
              </section>
            )}

            {pos.preferred_requirements.length > 0 && (
              <section className="mt-6 rounded-xl border bg-muted/30 p-6">
                <h2 className="text-xl font-semibold tracking-tight">Nice to have</h2>
                <BulletList items={pos.preferred_requirements} />
              </section>
            )}

            {[
              { title: "Responsibilities", body: pos.responsibilities },
              { title: "Benefits", body: pos.benefits },
              { title: "Languages", body: pos.languages },
              { title: "Travel", body: pos.travel },
              { title: "Work authorization", body: pos.work_authorization_note },
              { title: "Accessibility and accommodations", body: pos.accessibility_note },
              { title: "Equal opportunity", body: pos.eeo_statement },
            ]
              .filter((sec) => sec.body)
              .map((sec) => (
                <section key={sec.title} className="mt-6">
                  <h2 className="text-xl font-semibold tracking-tight">{sec.title}</h2>
                  <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/90">
                    {sec.body}
                  </p>
                </section>
              ))}

            {pos.application_deadline ? (
              <p className="mt-6 text-sm text-muted-foreground">
                {pos.deadline_passed
                  ? `Applications closed on ${pos.application_deadline}.`
                  : `Applications close on ${pos.application_deadline}.`}
              </p>
            ) : null}

            <section className="mt-10">
              <h2 className="text-xl font-semibold tracking-tight">How hiring works here</h2>
              <ol className="mt-4 space-y-4">
                {[
                  `Apply in about 3 minutes — share your details, upload your CV${
                    pos.questions.length > 0
                      ? `, and answer ${pos.questions.length} short screening ${
                          pos.questions.length === 1 ? "question" : "questions"
                        }.`
                      : "."
                  }`,
                  "TaaSFlow reviewers verify your fit against the role's requirements and preferred qualifications.",
                  `Shortlisted candidates are introduced to ${pos.organization_name} within a few business days.`,
                ].map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-[0.95rem] leading-relaxed text-foreground/90">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
              {/* Set expectations before someone applies, not after they
                  submit — it is the only point where it changes a decision. */}
              <dl className="mt-6 grid gap-4 rounded-xl border bg-muted/30 p-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    When you hear from us
                  </dt>
                  <dd className="mt-1 text-[0.95rem] text-foreground/90">
                    A confirmation straight away, and a real decision on your application
                    within five business days.
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    If it is a no
                  </dt>
                  <dd className="mt-1 text-[0.95rem] text-foreground/90">
                    We tell you, in writing. We do not leave applications unanswered.
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Who sees your application
                  </dt>
                  <dd className="mt-1 text-[0.95rem] text-foreground/90">
                    TaaSFlow reviewers first. {pos.organization_name} sees it only if you are
                    shortlisted for this role.
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tracking it
                  </dt>
                  <dd className="mt-1 text-[0.95rem] text-foreground/90">
                    Every stage is visible in your application tracker, with the next step
                    named.
                  </dd>
                </div>
              </dl>
            </section>


            <div className="mt-12 flex flex-wrap gap-3 border-t pt-8">
              {pos.accepting_applications && (
                <Button asChild size="lg">
                  <Link to="/jobs/$id/apply" params={{ id: pos.id }}>Apply now</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/jobs">Back to job board</Link>
              </Button>
            </div>
          </div>

          {/* Sidebar: a persistent apply, plus locations. The deciding facts
              now live in the fixed block under the title, so they are not
              repeated here. */}
          <aside className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Apply to this role
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {pos.seniority ? `${pos.seniority} · ` : ""}
                {pos.openings > 1 ? `${pos.openings} openings` : "1 opening"}
              </p>



              {pos.locations.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Hiring locations
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pos.locations.map((l, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {[l.city, l.region, l.country].filter(Boolean).join(", ")}
                        {l.work_model ? ` · ${l.work_model}` : ""}
                        {l.headcount && l.headcount > 1 ? ` · ${l.headcount} hires` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">{applyButton}</div>
              <p className="mt-3 text-xs text-muted-foreground">
                PDF CV, about 3 minutes. You'll get a reference you can track.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}

