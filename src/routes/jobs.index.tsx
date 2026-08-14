import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listPublicPositions } from "@/lib/jobs.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { buildJobSlug } from "@/lib/marketing/job-slug";

export const positionsQuery = queryOptions({
  queryKey: ["public-positions"],
  queryFn: () => listPublicPositions(),
});

const PAGE_SIZE = 20;

/** Filters live in the URL so any search can be copied, shared or bookmarked. */
const jobsSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  location: fallback(z.string(), "").default(""),
  work: fallback(z.string(), "any").default("any"),
  type: fallback(z.string(), "any").default("any"),
  level: fallback(z.string(), "any").default("any"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: zodValidator(jobsSearchSchema),
  search: {
    middlewares: [
      stripSearchParams({ q: "", location: "", work: "any", type: "any", level: "any", page: 1 }),
    ],
  },
  head: () => ({
    meta: [
      { title: "Open roles — TaaSFlow job board" },
      {
        name: "description",
        content:
          "Browse roles open through TaaSFlow. Every application gets a structured screening against what the role asks for — apply in minutes, no account needed.",
      },
      { property: "og:title", content: "Open roles — TaaSFlow" },
      {
        property: "og:description",
        content: "Roles currently open through TaaSFlow. Apply in minutes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://taasflow.com/jobs" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://taasflow.com/jobs" }],
  }),
  loader: async ({ context }) => context.queryClient.ensureQueryData(positionsQuery),
  component: JobsPage,
  errorComponent: makeRouteErrorComponent("public", "jobs.index"),
  notFoundComponent: makeRouteNotFoundComponent("public"),
});

function labelWorkModel(m: string | null) {
  if (m === "remote") return "Remote";
  if (m === "hybrid") return "Hybrid";
  if (m === "onsite") return "Onsite";
  return null;
}

function labelEmployment(e: string | null) {
  if (!e) return null;
  return e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats the real published date. Returns null when the role has no date on
 * record so the card omits the line entirely rather than inventing one.
 */
function formatPosted(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ChipProps = { label: string; onClear: () => void };
function FilterChip({ label, onClear }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-muted"
        aria-label={`Remove filter ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function JobsPage() {
  const { data: positions } = useSuspenseQuery(positionsQuery);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/jobs/" });

  const workModel = search.work;
  const employment = search.type;
  const seniority = search.level;
  const page = Math.max(1, search.page);

  // Every filter change rewrites the URL (replace, so Back leaves the board
  // rather than walking every keystroke).
  const setParam = (patch: Record<string, string | number>) =>
    navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as never,
      replace: true,
    });
  const setPage = (v: number | ((p: number) => number)) =>
    navigate({
      search: (prev: { page: number }) =>
        ({ ...prev, page: typeof v === "function" ? v(prev.page) : v }) as never,
      replace: true,
    });

  // Text filters keep their own state and write to the URL on a short debounce.
  // Writing on every keystroke raced the router: fast typing fired several
  // replace-navigations in the same tick and the last ones were dropped, so the
  // box showed "Sales" while the URL — and therefore the filtering — stayed empty.
  const [qText, setQText] = useState(search.q);
  const [locationText, setLocationText] = useState(search.location);
  const q = qText.slice(0, 120);
  const location = locationText.slice(0, 120);

  // Keep the inputs honest when the URL changes from outside typing
  // (chip removal, Clear all, Back/Forward, a shared link).
  useEffect(() => {
    setQText(search.q);
  }, [search.q]);
  useEffect(() => {
    setLocationText(search.location);
  }, [search.location]);

  useEffect(() => {
    if (search.q === qText && search.location === locationText) return;
    const t = setTimeout(() => {
      setParam({ q: qText, location: locationText, page: 1 });
    }, 250);
    return () => { clearTimeout(t); };
    // setParam is stable enough for this effect: it only closes over navigate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText, locationText, search.q, search.location]);


  const seniorityOptions = useMemo(() => {
    const s = new Set<string>();
    positions.forEach((p) => p.seniority && s.add(p.seniority));
    return Array.from(s).sort();
  }, [positions]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    return positions.filter((p) => {
      if (needle) {
        const hay = `${p.title} ${p.organization_name} ${p.description_preview}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (workModel !== "any" && p.work_model !== workModel) return false;
      if (employment !== "any" && p.employment_type !== employment) return false;
      if (seniority !== "any" && p.seniority !== seniority) return false;
      if (loc && !(p.location ?? "").toLowerCase().includes(loc)) return false;
      return true;
    });
  }, [positions, q, workModel, employment, seniority, location]);

  // Reset paging on filter change
  const activeChips: ChipProps[] = [];
  if (q.trim()) activeChips.push({ label: `“${q.trim()}”`, onClear: () => { setParam({ q: "", page: 1 }); } });
  if (location.trim())
    activeChips.push({ label: `Location: ${location.trim()}`, onClear: () => { setParam({ location: "", page: 1 }); } });
  if (workModel !== "any")
    activeChips.push({
      label: `Work: ${labelWorkModel(workModel) ?? workModel}`,
      onClear: () => { setParam({ work: "any", page: 1 }); },
    });
  if (employment !== "any")
    activeChips.push({
      label: `Type: ${labelEmployment(employment) ?? employment}`,
      onClear: () => { setParam({ type: "any", page: 1 }); },
    });
  if (seniority !== "any")
    activeChips.push({ label: `Level: ${seniority}`, onClear: () => { setParam({ level: "any", page: 1 }); } });

  const clearAll = () =>
    setParam({ q: "", location: "", work: "any", type: "any", level: "any", page: 1 });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Open roles</h1>
          <p className="mt-2 text-muted-foreground">
            {positions.length === 0
              ? "No roles are open through TaaSFlow right now."
              : `${positions.length} live ${positions.length === 1 ? "role" : "roles"} open through TaaSFlow. Apply in minutes — no account needed.`}
          </p>
          <p className="mt-2 text-sm">
            Already applied?{" "}
            <Link to="/apply/status" className="underline underline-offset-4">
              Check your application status
            </Link>
          </p>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div className="md:col-span-2">
            <Input
              aria-label="Search roles"
              placeholder="Search roles, skills, companies…"
              value={qText}
              onChange={(e) => { setQText(e.target.value); }}
            />
          </div>
          <Input
            aria-label="Location"
            placeholder="Location (city, country, remote)"
            value={locationText}
            onChange={(e) => { setLocationText(e.target.value); }}
          />

          <Select
            value={workModel}
            onValueChange={(v) => { setParam({ work: v, page: 1 }); }}
          >
            <SelectTrigger aria-label="Work model">
              <SelectValue placeholder="Work model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any work model</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Onsite</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={employment}
            onValueChange={(v) => { setParam({ type: v, page: 1 }); }}
          >
            <SelectTrigger aria-label="Employment type">
              <SelectValue placeholder="Employment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any employment</SelectItem>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {seniorityOptions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setParam({ level: "any", page: 1 }); }}
              className={`inline-flex min-h-11 items-center text-xs px-3 py-1 rounded-full border sm:min-h-8 ${
                seniority === "any" ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              All levels
            </button>
            {seniorityOptions.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setParam({ level: s, page: 1 })}
                className={`inline-flex min-h-11 items-center text-xs px-3 py-1 rounded-full border sm:min-h-8 ${
                  seniority === s ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
            {filtered.length !== positions.length ? ` of ${positions.length}` : ""}
          </span>
          {activeChips.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              {activeChips.map((c, i) => (
                <FilterChip key={i} {...c} />
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear all
              </button>
            </>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 py-16 text-center">
            <div className="mx-auto max-w-md px-4">
              {positions.length === 0 ? (
                <>
                  <h2 className="text-lg font-semibold">No open roles right now</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    No open roles right now — join the talent network to be first
                    in line when the next role goes live.
                  </p>
                  <Link
                    to="/candidate-join"
                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Join the talent network
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">No roles match your filters</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try widening the location or removing a filter.
                  </p>
                  {activeChips.length > 0 && (
                    <Button variant="outline" className="mt-6 min-h-11" onClick={clearAll}>
                      Clear filters
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {pageItems.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/jobs/$id"
                    params={{ id: buildJobSlug(p) }}
                    className="block rounded-lg border bg-card p-4 md:p-5 hover:border-foreground/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-muted-foreground truncate">
                          {p.organization_name}
                        </div>
                        <h2 className="mt-0.5 text-lg font-semibold truncate">{p.title}</h2>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {labelWorkModel(p.work_model) && (
                          <Badge variant="secondary">{labelWorkModel(p.work_model)}</Badge>
                        )}
                        {labelEmployment(p.employment_type) && (
                          <Badge variant="outline">{labelEmployment(p.employment_type)}</Badge>
                        )}
                        {p.seniority && <Badge variant="outline">{p.seniority}</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {[p.location, p.compensation_display].filter(Boolean).join(" · ")}
                    </div>
                    {/* Summary is clamped to 2 lines with a CSS ellipsis — the
                        full description lives on the job detail page. */}
                    <p className="mt-3 overflow-hidden text-ellipsis text-sm text-foreground/80 line-clamp-2">
                      {p.description_preview}
                    </p>
                    {formatPosted(p.published_at) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Posted {formatPosted(p.published_at)}
                      </p>
                    )}
                    <div className="mt-4">
                      <span className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                        View role
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {clampedPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </SiteShell>
  );
}
