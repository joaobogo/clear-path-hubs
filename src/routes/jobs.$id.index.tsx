import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPublicPosition } from "@/lib/jobs.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/marketing/site-shell";

export const Route = createFileRoute("/jobs/$id/")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["public-position", params.id],
      queryFn: () => getPublicPosition({ data: { id: params.id } }),
    });
    if (!data) throw notFound();
    return data;
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
    const title = `${loaderData.title} — ${loaderData.organization_name} · TaaSFlow`;
    const desc = loaderData.description.slice(0, 155);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-muted-foreground">
      Couldn't load this role. {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h1 className="text-2xl font-semibold">Role not available</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been closed or paused. Browse other open roles.
      </p>
      <div className="mt-6">
        <Button asChild><Link to="/jobs">Back to job board</Link></Button>
      </div>
    </div>
  ),
  component: JobDetail,
});

function labelWorkModel(m: string | null) {
  return m === "remote" ? "Remote" : m === "hybrid" ? "Hybrid" : m === "onsite" ? "Onsite" : null;
}
function labelEmployment(e: string | null) {
  return e ? e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

// Very light heuristic: split description into an overview and a responsibilities
// list when the client wrote bullets or the classic "Responsibilities:" header.
function splitOverviewAndResponsibilities(description: string): {
  overview: string;
  responsibilities: string[];
} {
  const text = description.trim();
  const headerMatch = text.match(
    /^([\s\S]*?)(?:\n|^)\s*(?:responsibilities|what you'?ll do|key responsibilities|your role)\s*:?\s*\n([\s\S]+)$/i,
  );
  if (headerMatch) {
    const overview = headerMatch[1].trim();
    const bullets = headerMatch[2]
      .split(/\n+/)
      .map((l) => l.replace(/^[-*•\d.\)\s]+/, "").trim())
      .filter(Boolean);
    if (bullets.length >= 2) return { overview, responsibilities: bullets.slice(0, 12) };
  }
  return { overview: text, responsibilities: [] };
}

function JobDetail() {
  const { id } = Route.useParams();
  const { data: pos } = useSuspenseQuery({
    queryKey: ["public-position", id],
    queryFn: () => getPublicPosition({ data: { id } }),
  });
  if (!pos) return null;
  const { overview, responsibilities } = splitOverviewAndResponsibilities(pos.description);

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-sm text-muted-foreground">{pos.organization_name}</div>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">{pos.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {labelWorkModel(pos.work_model) && (
            <Badge variant="secondary">{labelWorkModel(pos.work_model)}</Badge>
          )}
          {labelEmployment(pos.employment_type) && (
            <Badge variant="outline">{labelEmployment(pos.employment_type)}</Badge>
          )}
          {pos.seniority && <Badge variant="outline">{pos.seniority}</Badge>}
          {pos.department && <Badge variant="outline">{pos.department}</Badge>}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {[pos.location, pos.compensation_display].filter(Boolean).join(" · ") || null}
        </div>

        <div className="mt-6">
          <Button asChild size="lg">
            <Link to="/jobs/$id/apply" params={{ id: pos.id }}>Apply for this role</Link>
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">About the role</h2>
          <p className="mt-3 whitespace-pre-wrap text-foreground/90 leading-relaxed">
            {overview}
          </p>
        </section>

        {responsibilities.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Responsibilities</h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-foreground/90">
              {responsibilities.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Requirements</h2>
          <ul className="mt-3 list-disc pl-5 space-y-1 text-foreground/90">
            {pos.requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>

        {pos.preferred_requirements.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Preferred qualifications</h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-foreground/90">
              {pos.preferred_requirements.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-lg border bg-muted/30 p-6">
          <h2 className="text-lg font-semibold">Application process</h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-foreground/90">
            <li>
              Apply in about 3 minutes — share your details, upload your CV
              {pos.questions.length > 0
                ? `, and answer ${pos.questions.length} short screening ${
                    pos.questions.length === 1 ? "question" : "questions"
                  }.`
                : "."}
            </li>
            <li>
              TaaSFlow reviewers verify fit against the role's requirements and preferred
              qualifications.
            </li>
            <li>
              Shortlisted candidates are introduced to {pos.organization_name} within a few
              business days.
            </li>
          </ol>
        </section>

        <div className="mt-12 border-t pt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/jobs/$id/apply" params={{ id: pos.id }}>Apply now</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/jobs">Back to job board</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
