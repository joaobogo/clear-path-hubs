import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { classifyBand } from "@/lib/scoring/bands";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { getPublishDeskGroups, setMatchClientVisibility } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Ban, CheckCircle2, Eye, Pause, ExternalLink } from "lucide-react";
import { PublishGatePanel } from "@/components/admin/publish-gate-panel";
import { QueueShortcuts } from "@/components/admin/queue-shortcuts";
import { BlockedReason } from "@/components/admin/blocked-reason";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveQueueState, resolveQueueVariant } from "@/lib/empty-states/queue-states";
import { QUEUE_ROW_ACTIVE_CLASS, useQueueKeyboard } from "@/lib/admin/queue-keyboard";


export const Route = createFileRoute("/_authenticated/admin/publish")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["publish-desk-groups"],
      queryFn: () => getPublishDeskGroups(),
    }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.publish.tsx"),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Publish Desk · TaaSFlow admin" },
      { name: "description", content: "Preview and publish approved candidates." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublishDesk,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const GROUPS = [
  { id: "needs_review", label: "Needs review", tone: "text-warning-foreground dark:text-warning-foreground bg-warning/10", icon: AlertTriangle, hint: "Scored candidates awaiting an admin decision." },
  { id: "blocked", label: "Blocked", tone: "text-destructive bg-destructive/10", icon: Ban, hint: "Processing failures, provider blocks, and OCR requests." },
  { id: "ready", label: "Ready to publish", tone: "text-success dark:text-success bg-success/10", icon: CheckCircle2, hint: "Approved by admin — one click to send to the client." },
  { id: "published", label: "Published", tone: "text-primary bg-primary/10", icon: Eye, hint: "Currently live in the client workspace." },
  { id: "held", label: "Held", tone: "text-muted-foreground bg-muted", icon: Pause, hint: "Paused pending clarification." },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

type Readiness = {
  hasScore: boolean;
  evidenceOk: boolean;
  contradictionOk: boolean;
  clientSafeOk: boolean;
  adminApproved: boolean;
  orgOk: boolean;
  canPublish: boolean;
  blockedReasons: string[];
};

function readinessOf(r: Any): Readiness {
  return (r._readiness ?? {
    hasScore: false, evidenceOk: false, contradictionOk: true, clientSafeOk: false,
    adminApproved: false, orgOk: true, canPublish: false, blockedReasons: [],
  }) as Readiness;
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium " +
        (ok
          ? "bg-success/10 text-success dark:text-success"
          : "bg-destructive/10 text-destructive")
      }
      title={label}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

const POPULATES: Record<GroupId, string> = {
  needs_review: "A row appears once a candidate has been scored and is waiting for an admin decision.",
  blocked: "A row appears when processing fails, a provider blocks us, or a CV needs OCR.",
  ready: "A row appears once every readiness check passes and an admin has approved the candidate.",
  published: "A row appears the moment you publish a candidate to a client workspace.",
  held: "A row appears when a candidate is paused pending clarification.",
};

function PublishDesk() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["publish-desk-groups"],
    queryFn: () => getPublishDeskGroups(),
  });
  const buckets = data as Record<GroupId, Any[]>;

  const [group, setGroup] = useState<GroupId>(
    (GROUPS.find((g) => (buckets[g.id] ?? []).length > 0)?.id ?? "needs_review") as GroupId,
  );
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const setVis = useServerFn(setMatchClientVisibility);
  const publishMut = useMutation({
    mutationFn: async (vars: { match_id: string; visibility: "visible" | "hidden" }) =>
      await setVis({ data: vars }),
    onSuccess: async (_r, vars) => {
      setFeedback(vars.visibility === "visible" ? "Published to client." : "Hidden from client.");
      await qc.invalidateQueries({ queryKey: ["publish-desk-groups"] });
    },
    onError: (e: Error) => setFeedback(`Action failed: ${e.message}`),
  });

  const rows = useMemo(() => {
    const bucket = buckets[group] ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return bucket;
    return bucket.filter((r) => {
      const name = r.candidate_profiles?.full_name?.toLowerCase() ?? "";
      const title = r.positions?.title?.toLowerCase() ?? "";
      const org = r.positions?.organizations?.name?.toLowerCase() ?? "";
      return name.includes(q) || title.includes(q) || org.includes(q);
    });
  }, [buckets, group, query]);

  // Enter runs the row's single primary action: publish, unpublish, or nothing
  // when the row is blocked (the reason is already visible in the row).
  const runPrimary = useCallback(
    (index: number) => {
      const r = rows[index];
      if (!r || publishMut.isPending) return;
      const rd = readinessOf(r);
      if (r.client_visibility === "visible") {
        publishMut.mutate({ match_id: r.id, visibility: "hidden" });
      } else if (rd.canPublish) {
        publishMut.mutate({ match_id: r.id, visibility: "visible" });
      }
    },
    [rows, publishMut],
  );
  const openRecord = useCallback(
    (index: number) => {
      const r = rows[index];
      if (r) window.location.assign(`/admin/candidates/${r.id}`);
    },
    [rows],
  );
  const kb = useQueueKeyboard({ count: rows.length, onPrimary: runPrimary, onOpen: openRecord });

  const activeGroup = GROUPS.find((g) => g.id === group)!;
  const activeFilters = query.trim() ? [`Search: ${query.trim()}`] : [];
  const variant = resolveQueueVariant({
    isError: false,
    rowCount: rows.length,
    activeFilters,
  });

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Publish desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview approved candidates before sending them to clients. Every action is audited.
        </p>
      </header>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <PublishGatePanel />

      <div className="grid gap-3 md:grid-cols-5">
        {GROUPS.map((g) => {
          const count = (buckets[g.id] ?? []).length;
          const active = group === g.id;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              data-qa-action={`desk-group-${g.id}`}
              className={
                "group rounded-lg border p-3 text-left transition " +
                (active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "hover:border-muted-foreground/40")
              }
              aria-pressed={active}
            >
              <div className="flex items-center justify-between">
                <span className={"inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium " + g.tone}>
                  <Icon className="h-3 w-3" />
                  {g.label}
                </span>
                <span className="text-lg font-semibold tabular-nums">{count}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{g.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            {activeGroup.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({rows.length} of {(buckets[group] ?? []).length})
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <QueueShortcuts className="hidden xl:flex" />
            <Input
              ref={kb.filterRef}
              placeholder="Filter by candidate, role, or client…"
              aria-label="Filter this queue"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 max-w-xs"
            />
          </div>
        </div>

        {variant ? (
          <div className="p-6">
            <SurfaceState
              content={resolveQueueState({
                variant,
                queueLabel: activeGroup.label,
                populates: POPULATES[group],
                activeFilters,
              })}
              onAction={variant === "filtered" ? () => setQuery("") : undefined}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Client · Role</th>
                <th className="px-3 py-2 font-medium tabular-nums">Score</th>
                <th className="px-3 py-2 font-medium">Readiness</th>
                <th className="px-3 py-2 font-medium">Review · Publication</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y" {...kb.listProps}>
              {rows.map((r, index) => {
                const run = r.score_runs;
                const rd = readinessOf(r);
                const orgId = r.positions?.organizations?.id as string | undefined;
                const previewHref = orgId
                  ? `/client/candidates/${r.id}?org=${encodeURIComponent(orgId)}&preview=client_admin`
                  : `/admin/candidates/${r.id}`;
                const isPublished = r.client_visibility === "visible";
                const rowKb = kb.rowProps(index);
                return (
                  <tr
                    key={r.id}
                    {...rowKb}
                    ref={rowKb.ref as (node: HTMLTableRowElement | null) => void}
                    className={"align-top hover:bg-muted/30 " + QUEUE_ROW_ACTIVE_CLASS}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.candidate_profiles?.full_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.candidate_profiles?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.positions?.organizations?.name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.positions?.title ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {/* Band + confidence in the list; the number and its rubric
                          version live on the candidate detail view. */}
                      {run?.score == null ? (
                        <span className="text-muted-foreground">Not scored</span>
                      ) : (
                        <>
                          <div className="capitalize">
                            {classifyBand(Number(run.score)).replace(/_/g, " ")}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {run.confidence == null
                              ? "confidence n/a"
                              : `confidence ${Math.round(Number(run.confidence) * 100)}%`}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Check ok={rd.hasScore} label="Score" />
                        <Check ok={rd.evidenceOk} label="Evidence" />
                        <Check ok={rd.contradictionOk} label="No contradictions" />
                        <Check ok={rd.clientSafeOk} label="Client-safe" />
                        <Check ok={rd.adminApproved} label="Approved" />
                        <Check ok={rd.orgOk} label="Binding" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Badge variant="outline" className="mr-1">{r.admin_status}</Badge>
                      <Badge variant={isPublished ? "default" : "secondary"}>
                        {r.client_visibility}
                      </Badge>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-stretch gap-1.5 text-right">
                        {/* Exactly one primary action per row. */}
                        {isPublished ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7"
                            disabled={publishMut.isPending}
                            onClick={() => publishMut.mutate({ match_id: r.id, visibility: "hidden" })}
                            data-qa-action="unpublish"
                          >
                            Unpublish
                          </Button>
                        ) : rd.canPublish ? (
                          <Button
                            size="sm"
                            className="h-7"
                            disabled={publishMut.isPending}
                            onClick={() => publishMut.mutate({ match_id: r.id, visibility: "visible" })}
                            data-qa-action="publish"
                          >
                            Publish to client
                          </Button>
                        ) : (
                          <BlockedReason
                            reasons={
                              rd.blockedReasons.length > 0
                                ? rd.blockedReasons
                                : ["Readiness checks have not all passed yet."]
                            }
                            resolve={{
                              to: "/admin/candidates/$id",
                              params: { id: r.id },
                              label: "Open the record to clear this",
                            }}
                          />
                        )}

                        <div className="flex items-center justify-end gap-3 text-[11px]">
                          <a
                            href={previewHref}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            data-qa-action={isPublished ? "view-live" : "preview-as-client"}
                          >
                            {isPublished ? (
                              <ExternalLink className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            {isPublished ? "View live" : "Preview as client"}
                          </a>
                          <Link
                            to="/admin/candidates/$id"
                            params={{ id: r.id }}
                            className="text-muted-foreground hover:text-primary hover:underline"
                            data-qa-action="open-workspace"
                          >
                            Open record →
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <QueueShortcuts className="xl:hidden" />
        <p className="text-xs text-muted-foreground">
          Prefer full search? Use{" "}
          <Link to="/admin/candidates" className="text-primary hover:underline">
            /admin/candidates
          </Link>{" "}
          — every workspace opens the same route as here.
        </p>
      </div>
    </main>
  );
}

