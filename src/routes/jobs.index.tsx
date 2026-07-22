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

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Open roles — TaaSFlow job board" },
      {
        name: "description",
        content:
          "Browse open roles hand-picked by TaaSFlow. Remote, hybrid, and onsite positions across engineering, design, and data.",
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
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["public-positions"],
      queryFn: () => listPublicPositions(),
    }),
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

function JobsPage() {
  const { data: positions = [] } = useQuery({
    queryKey: ["public-positions"],
    queryFn: () => listPublicPositions(),
  });

  const [q, setQ] = useState("");
  const [workModel, setWorkModel] = useState<string>("any");
  const [employment, setEmployment] = useState<string>("any");
  const [seniority, setSeniority] = useState<string>("any");
  const [location, setLocation] = useState("");

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">TaaSFlow</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/jobs" className="text-foreground">Jobs</Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Open roles</h1>
          <p className="mt-2 text-muted-foreground">
            {positions.length} live {positions.length === 1 ? "role" : "roles"} curated by TaaSFlow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          <div className="md:col-span-2">
            <Input
              aria-label="Search roles"
              placeholder="Search roles, skills, companies…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Input
            aria-label="Location"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Select value={workModel} onValueChange={setWorkModel}>
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
          <Select value={employment} onValueChange={setEmployment}>
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
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSeniority("any")}
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
                onClick={() => setSeniority(s)}
                className={`text-xs px-3 py-1 rounded-full border ${
                  seniority === s ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No roles match your filters right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  to="/jobs/$id"
                  params={{ id: p.id }}
                  className="block rounded-lg border bg-card p-4 md:p-5 hover:border-foreground/40 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">{p.organization_name}</div>
                      <h2 className="mt-0.5 text-lg font-semibold">{p.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
        )}
      </main>
    </div>
  );
}
