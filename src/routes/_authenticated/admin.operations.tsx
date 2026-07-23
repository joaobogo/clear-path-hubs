import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getPipelineHealth,
  getOperationsIncidents,
  resolveIncident,
} from "@/lib/admin.functions";
import { listDeliveryFailures } from "@/lib/notifications.functions";
import {
  retryParse,
  retryHydration,
  retryEnrichment,
  rescore,
  markManualReview,
  backfillCandidateInsights,
} from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Wifi, Server, User, MoreHorizontal, FileText, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/operations")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["pipeline-health"],
      queryFn: () => getPipelineHealth(),
    }),
  head: () => ({
    meta: [
      { title: "Operations · TaaSFlow admin" },
      { name: "description", content: "Pipeline incidents grouped by root cause with targeted repair actions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Operations unavailable: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: OperationsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const CATEGORIES = [
  { key: "application", label: "Application", jobs: ["application_intake"] },
  { key: "cv_storage", label: "CV Storage", jobs: ["cv_upload", "cv_storage"] },
  { key: "parsing", label: "Parsing", jobs: ["cv_parse", "parse"] },
  { key: "ocr", label: "OCR", jobs: ["ocr"] },
  { key: "hydration", label: "Hydration", jobs: ["hydration", "cv_hydrate"] },
  { key: "enrichment", label: "Enrichment", jobs: ["enrichment", "cv_enrich"] },
  { key: "scoring", label: "Scoring", jobs: ["score", "scoring", "rescore"] },
  { key: "publication", label: "Publication", jobs: ["publish", "publication"] },
  { key: "messaging", label: "Messaging", jobs: ["message_send", "notification"] },
  { key: "identity", label: "Identity", jobs: ["identity", "auth", "profile_link"] },
] as const;

function categorize(job: AnyRow): string {
  const jt = String(job.job_type ?? "").toLowerCase();
  for (const c of CATEGORIES) if (c.jobs.some((k) => jt.includes(k))) return c.key;
  const code = String(job.error_code ?? "").toLowerCase();
  if (code.includes("ocr")) return "ocr";
  if (code.includes("parse") || code.includes("cv")) return "parsing";
  if (code.includes("score")) return "scoring";
  if (code.includes("provider") || code.includes("rate_limit")) return "enrichment";
  return "application";
}

function rootCause(job: AnyRow): { icon: typeof AlertTriangle; label: string; key: string } {
  const code = String(job.error_code ?? "").toLowerCase();
  if (code.includes("provider") || code.includes("rate_limit") || code.includes("timeout"))
    return { key: "provider", icon: Wifi, label: "Provider" };
  if (code.includes("cv") || code.includes("parse") || code.includes("ocr"))
    return { key: "candidate_cv", icon: User, label: "Candidate CV" };
  if (code.includes("position") || code.includes("requirements"))
    return { key: "position", icon: Server, label: "Position setup" };
  return { key: "pipeline", icon: AlertTriangle, label: "Pipeline" };
}

/** Determine if a job type is retryable via an in-app repair. */
function isRetryable(cat: string): boolean {
  return ["parsing", "ocr", "hydration", "enrichment", "scoring"].includes(cat);
}

function OperationsPage() {
  const qc = useQueryClient();
  const { data: health } = useSuspenseQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => getPipelineHealth(),
  });
  const listOps = useServerFn(getOperationsIncidents);
  const { data: ops } = useQuery({
    queryKey: ["admin", "operations-incidents"],
    queryFn: () => listOps(),
    refetchOnWindowFocus: true,
  });
  const listDelivery = useServerFn(listDeliveryFailures);
  const { data: delivery } = useQuery({
    queryKey: ["admin", "delivery-failures"],
    queryFn: () => listDelivery(),
    refetchOnWindowFocus: true,
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const retryParseFn = useServerFn(retryParse);
  const retryHydrationFn = useServerFn(retryHydration);
  const retryEnrichmentFn = useServerFn(retryEnrichment);
  const rescoreFn = useServerFn(rescore);
  const markReviewFn = useServerFn(markManualReview);
  const resolveFn = useServerFn(resolveIncident);

  type RepairKind = "retry" | "ocr" | "hydration" | "enrichment" | "rescore" | "manual" | "resolve";

  const repair = useMutation({
    mutationFn: async (v: { kind: RepairKind; match_id?: string; job_id?: string }) => {
      switch (v.kind) {
        case "retry":
          return await retryParseFn({ data: { match_id: v.match_id! } });
        case "hydration":
          return await retryHydrationFn({ data: { match_id: v.match_id! } });
        case "enrichment":
          return await retryEnrichmentFn({ data: { match_id: v.match_id! } });
        case "rescore":
          return await rescoreFn({ data: { match_id: v.match_id! } });
        case "ocr":
          window.location.href = `/admin/candidates/${v.match_id}?tab=cv`;
          return { ok: true, state: "ocr_required" as const, trace_id: "" };
        case "manual":
          return await markReviewFn({
            data: { match_id: v.match_id!, reason: "Flagged from Operations workspace" },
          });
        case "resolve":
          return await resolveFn({ data: { job_id: v.job_id! } });
      }
    },
    onSuccess: async (r: AnyRow, v) => {
      setFeedback(
        v.kind === "resolve"
          ? "Incident marked resolved."
          : `Repair → ${r.state ?? "queued"}${r.trace_id ? ` · trace ${r.trace_id}` : ""}`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pipeline-health"] }),
        qc.invalidateQueries({ queryKey: ["admin", "operations-incidents"] }),
      ]);
    },
    onError: (e: Error) => setFeedback(`Repair failed: ${e.message}`),
  });

  const jobs = ((ops?.jobs ?? health.failed_jobs ?? []) as AnyRow[]).slice();
  const matchMap = (ops?.matches ?? {}) as Record<string, AnyRow>;
  const activeSet = new Set((ops?.active ?? []) as string[]);

  // Group by (entity, category, error_code)
  type Group = {
    key: string;
    cat: string;
    catLabel: string;
    entityId: string;
    errorCode: string;
    rootCauseLabel: string;
    icon: typeof AlertTriangle;
    jobs: AnyRow[];
    latest: AnyRow;
    attempts: number;
  };
  const grouped: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const j of jobs) {
      const cat = categorize(j);
      const rc = rootCause(j);
      const key = `${j.entity_id}::${cat}::${j.error_code ?? "error"}`;
      const catLabel = CATEGORIES.find((c) => c.key === cat)?.label ?? cat;
      const g = map.get(key);
      if (g) {
        g.jobs.push(j);
        g.attempts += Number(j.attempts ?? 1);
      } else {
        map.set(key, {
          key,
          cat,
          catLabel,
          entityId: j.entity_id,
          errorCode: j.error_code ?? "error",
          rootCauseLabel: rc.label,
          icon: rc.icon,
          jobs: [j],
          latest: j,
          attempts: Number(j.attempts ?? 1),
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime(),
    );
  }, [jobs]);

  const filtered = grouped.filter((g) => {
    if (category !== "all" && g.cat !== category) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const m = matchMap[g.entityId];
    const hay =
      `${g.latest.job_type} ${g.errorCode} ${g.latest.error_message ?? ""} ${g.latest.trace_id ?? ""} ${
        m?.candidate_profiles?.full_name ?? ""
      } ${m?.positions?.title ?? ""} ${m?.positions?.organizations?.name ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  const deliveryItems = ((delivery?.items ?? []) as unknown) as AnyRow[];

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Actionable incidents grouped by entity, process, and root cause.
        </p>
      </header>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Aging in pipeline" value={health.stale} tone={health.stale > 0 ? "warn" : "ok"} />
        <Stat label="Failed jobs" value={jobs.length} tone={jobs.length > 0 ? "warn" : "ok"} />
        <Stat label="Provider incidents (7d)" value={health.provider_incidents} />
        <Stat
          label="Delivery failures"
          value={deliveryItems.length}
          tone={deliveryItems.length > 0 ? "warn" : "ok"}
        />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline incidents ({grouped.length})</TabsTrigger>
          <TabsTrigger value="delivery">Delivery failures ({deliveryItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search candidate, position, client, trace…"
                className="h-8 w-72 pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <CategoryPill active={category === "all"} onClick={() => setCategory("all")}>
                All ({grouped.length})
              </CategoryPill>
              {CATEGORIES.map((c) => {
                const n = grouped.filter((g) => g.cat === c.key).length;
                if (n === 0) return null;
                return (
                  <CategoryPill
                    key={c.key}
                    active={category === c.key}
                    onClick={() => setCategory(c.key)}
                  >
                    {c.label} ({n})
                  </CategoryPill>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border bg-card px-5 py-10 text-sm text-muted-foreground text-center">
              No incidents match this filter.
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Process · Root cause</th>
                    <th className="px-3 py-2 font-medium">Candidate · Position · Client</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium tabular-nums">Attempts</th>
                    <th className="px-3 py-2 font-medium">Trace</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((g) => {
                    const Icon = g.icon;
                    const m = matchMap[g.entityId];
                    const activeParse = activeSet.has(`${g.entityId}::cv_parse`);
                    const retryDisabled = repair.isPending || activeParse;
                    const recommended: RepairKind =
                      g.cat === "ocr"
                        ? "ocr"
                        : g.cat === "hydration"
                          ? "hydration"
                          : g.cat === "enrichment"
                            ? "enrichment"
                            : g.cat === "scoring"
                              ? "rescore"
                              : "retry";
                    const recLabel =
                      recommended === "ocr"
                        ? "Run OCR"
                        : recommended === "hydration"
                          ? "Retry hydration"
                          : recommended === "enrichment"
                            ? "Retry enrichment"
                            : recommended === "rescore"
                              ? "Rescore"
                              : "Retry";
                    const isMatch = g.latest.entity_type === "candidate_match";
                    return (
                      <tr key={g.key} className="align-top hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {g.catLabel}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {g.rootCauseLabel} · {g.errorCode}
                          </div>
                          {g.latest.error_message && (
                            <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                              {g.latest.error_message}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {m ? (
                            <>
                              <div className="font-medium">
                                {m.candidate_profiles?.full_name ?? "Unknown candidate"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {m.positions?.title ?? "—"} ·{" "}
                                {m.positions?.organizations?.name ?? "—"}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {g.latest.entity_type} · {g.entityId.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {m?.processing_state ? (
                            <Badge variant="secondary">
                              {String(m.processing_state).replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-sm">{g.attempts}</td>
                        <td className="px-3 py-2 text-[10px] text-muted-foreground">
                          <div>{g.latest.trace_id ?? "—"}</div>
                          <div>{new Date(g.latest.created_at).toLocaleString()}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isMatch && isRetryable(g.cat) && (
                              <Button
                                size="sm"
                                className="h-7"
                                disabled={retryDisabled}
                                onClick={() =>
                                  repair.mutate({ kind: recommended, match_id: g.entityId })
                                }
                                title={activeParse ? "Active job already running" : recLabel}
                              >
                                {recLabel}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {isMatch && (
                                  <>
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "retry", match_id: g.entityId })
                                      }
                                    >
                                      Retry parse
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "ocr", match_id: g.entityId })
                                      }
                                    >
                                      Run OCR…
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "hydration", match_id: g.entityId })
                                      }
                                    >
                                      Retry hydration
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "enrichment", match_id: g.entityId })
                                      }
                                    >
                                      Retry enrichment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "rescore", match_id: g.entityId })
                                      }
                                    >
                                      Rescore
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={repair.isPending}
                                      onClick={() =>
                                        repair.mutate({ kind: "manual", match_id: g.entityId })
                                      }
                                    >
                                      Mark manual review
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuItem
                                  disabled={repair.isPending}
                                  onClick={() =>
                                    repair.mutate({ kind: "resolve", job_id: g.latest.id })
                                  }
                                >
                                  Resolve incident
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link
                                    to="/admin/candidates/$id"
                                    params={{ id: g.entityId }}
                                    className="flex items-center gap-2"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> Open record
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {g.jobs.length > 1 && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {g.jobs.length} related failures
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="delivery" className="mt-4">
          {deliveryItems.length === 0 ? (
            <div className="rounded-lg border bg-card px-5 py-10 text-sm text-muted-foreground text-center">
              No delivery issues.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Audience</th>
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2">Channel</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryItems.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(d.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 capitalize">{d.notifications?.audience}</td>
                      <td className="px-4 py-2">{d.notifications?.event_type}</td>
                      <td className="px-4 py-2">{d.channel}</td>
                      <td className="px-4 py-2">
                        <Badge variant="destructive">{d.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-xs">
                        {d.error_message ?? d.error_code ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "warn" && value > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CategoryPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-1 text-xs transition " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-muted-foreground/40")
      }
    >
      {children}
    </button>
  );
}
