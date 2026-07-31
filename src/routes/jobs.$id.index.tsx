import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPublicPosition } from "@/lib/jobs.functions";
import { buildJobSlug, extractJobUuid } from "@/lib/marketing/job-slug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/marketing/site-shell";
import { parseJobDescription } from "@/lib/marketing/job-description";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  MapPin,
  TrendingUp,
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
  errorComponent: makeRouteErrorComponent("public", "src/routes/jobs.$id.index.tsx"),
  notFoundComponent: () => (
    <SiteShell>
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
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
      </main>
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
      <main className="mx-auto max-w-2xl px-4 py-16 sm:py-20">
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
      </main>
    </SiteShell>
  );
}


function labelWorkModel(m: string | null) {
  return m === "remote" ? "Remote" : m === "hybrid" ? "Hybrid" : m === "onsite" ? "Onsite" : null;
}
function labelEmployment(e: string | null) {
  return e ? e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

function FactRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
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
  const { id: rawId } = Route.useParams();
  const id = extractJobUuid(rawId);
  const { data: pos } = useSuspenseQuery({
    queryKey: ["public-position", id],
    queryFn: () => getPublicPosition({ data: { id } }),
  });
  if (!pos) return null;

  const blocks = parseJobDescription(pos.description);
  const workModel = labelWorkModel(pos.work_model);
  const employment = labelEmployment(pos.employment_type);

  const applyButton = pos.accepting_applications ? (
    <Button asChild size="lg" className="w-full sm:w-auto">
      <Link to="/jobs/$id/apply" params={{ id: pos.id }}>Apply for this role</Link>
    </Button>
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

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {!pos.accepting_applications && (
          <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            This role is paused — applications are temporarily closed. The listing stays up so you
            can review the requirements, and applications reopen if hiring resumes.
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column: the description, rendered with real hierarchy. */}
          <div className="min-w-0">
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

          {/* Sidebar: the facts a candidate scans for, plus a persistent apply. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Role at a glance
              </h2>
              <div className="mt-4 space-y-4">
                {pos.location && (
                  <FactRow icon={MapPin} label="Location" value={pos.location} />
                )}
                {workModel && (
                  <FactRow icon={Building2} label="Work model" value={workModel} />
                )}
                {employment && (
                  <FactRow icon={Clock} label="Employment" value={employment} />
                )}
                {pos.compensation_display && (
                  <FactRow icon={Wallet} label="Compensation" value={pos.compensation_display} />
                )}
                {pos.seniority && (
                  <FactRow icon={TrendingUp} label="Seniority" value={pos.seniority} />
                )}
              </div>

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

