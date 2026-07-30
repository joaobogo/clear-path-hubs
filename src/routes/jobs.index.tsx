import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

const positionsQuery = queryOptions({
  queryKey: ["public-positions"],
  queryFn: () => listPublicPositions(),
});

const PAGE_SIZE = 20;

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Open roles — TaaSFlow job board" },
      {
        name: "description",
        content:
          "Browse open roles curated by TaaSFlow. Remote, hybrid, and onsite positions across engineering, design, product, and data.",
      },
      { property: "og:title", content: "Open roles — TaaSFlow" },
      {
        property: "og:description",
        content: "Curated roles from TaaSFlow clients. Apply in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => context.queryClient.ensureQueryData(positionsQuery),
  component: JobsPage,
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

  const [q, setQ] = useState("");
  const [workModel, setWorkModel] = useState<string>("any");
  const [employment, setEmployment] = useState<string>("any");
  const [seniority, setSeniority] = useState<string>("any");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);

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
  if (q.trim()) activeChips.push({ label: `“${q.trim()}”`, onClear: () => { setQ(""); setPage(1); } });
  if (location.trim())
    activeChips.push({ label: `Location: ${location.trim()}`, onClear: () => { setLocation(""); setPage(1); } });
  if (workModel !== "any")
    activeChips.push({
      label: `Work: ${labelWorkModel(workModel) ?? workModel}`,
      onClear: () => { setWorkModel("any"); setPage(1); },
    });
  if (employment !== "any")
    activeChips.push({
      label: `Type: ${labelEmployment(employment) ?? employment}`,
      onClear: () => { setEmployment("any"); setPage(1); },
    });
  if (seniority !== "any")
    activeChips.push({ label: `Level: ${seniority}`, onClear: () => { setSeniority("any"); setPage(1); } });

  const clearAll = () => {
    setQ("");
    setLocation("");
    setWorkModel("any");
    setEmployment("any");
    setSeniority("any");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Open roles</h1>
          <p className="mt-2 text-muted-foreground">
            {positions.length} live {positions.length === 1 ? "role" : "roles"} curated by TaaSFlow.
            Apply in minutes and track your application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div className="md:col-span-2">
            <Input
              aria-label="Search roles"
              placeholder="Search roles, skills, companies…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
          <Input
            aria-label="Location"
            placeholder="Location (city, country, remote)"
            value={location}
            onChange={(e) => { setLocation(e.target.value); setPage(1); }}
          />
          <Select
            value={workModel}
            onValueChange={(v) => { setWorkModel(v); setPage(1); }}
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
            onValueChange={(v) => { setEmployment(v); setPage(1); }}
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
              onClick={() => { setSeniority("any"); setPage(1); }}
              className={`text-xs px-3 py-1 rounded-full border ${
                seniority === "any" ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              All levels
            </button>
            {seniorityOptions.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => { setSeniority(s); setPage(1); }}
                className={`text-xs px-3 py-1 rounded-full border ${
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
            <div className="mx-auto max-w-md">
              <h2 className="text-lg font-semibold">No roles match your filters</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try widening the location or removing a filter. New roles are added weekly.
              </p>
              {activeChips.length > 0 && (
                <Button variant="outline" className="mt-6" onClick={clearAll}>
                  Clear filters
                </Button>
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
                    <p className="mt-3 text-sm text-foreground/80 line-clamp-2">
                      {p.description_preview}
                    </p>
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
