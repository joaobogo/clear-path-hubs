import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { classifyBand } from "@/lib/scoring/bands";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getPublishDeskGroups, setMatchClientVisibility } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Ban, CheckCircle2, Eye, Pause, ExternalLink } from "lucide-react";
import { PublishGatePanel } from "@/components/admin/publish-gate-panel";

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
        <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            {GROUPS.find((g) => g.id === group)?.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({rows.length} of {(buckets[group] ?? []).length})
            </span>
          </h2>
          <Input
            placeholder="Filter by candidate, position, or client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 max-w-xs"
          />
        </div>

        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nothing here right now.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Client · Position</th>
                <th className="px-3 py-2 font-medium tabular-nums">Score</th>
                <th className="px-3 py-2 font-medium">Readiness</th>
                <th className="px-3 py-2 font-medium">Review · Publication</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const run = r.score_runs;
                const rd = readinessOf(r);
                const orgId = r.positions?.organizations?.id as string | undefined;
                const previewHref = orgId
                  ? `/client/candidates/${r.id}?org=${encodeURIComponent(orgId)}&preview=client_admin`
                  : `/admin/candidates/${r.id}`;
                const isPublished = r.client_visibility === "visible";
                return (
                  <tr key={r.id} className="hover:bg-muted/30 align-top">
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
                      {rd.blockedReasons.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-[10px] text-destructive">
                          {rd.blockedReasons.map((reason: string) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      )}
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
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {rd.canPublish && !isPublished && (
                          <>
                            <a
                              href={previewHref}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                              data-qa-action="preview-as-client"
                            >
                              <Eye className="h-3 w-3" /> Preview as client
                            </a>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7"
                              disabled={publishMut.isPending}
                              onClick={() =>
                                publishMut.mutate({ match_id: r.id, visibility: "visible" })
                              }
                              data-qa-action="publish"
                            >
                              Publish
                            </Button>
                          </>
                        )}
                        {isPublished && (
                          <>
                            <a
                              href={previewHref}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" /> View live
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              disabled={publishMut.isPending}
                              onClick={() =>
                                publishMut.mutate({ match_id: r.id, visibility: "hidden" })
                              }
                            >
                              Unpublish
                            </Button>
                          </>
                        )}
                        {!rd.canPublish && !isPublished && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            disabled
                            title={rd.blockedReasons.join(" · ") || "Not ready"}
                          >
                            Publish
                          </Button>
                        )}
                        <Link
                          to="/admin/candidates/$id"
                          params={{ id: r.id }}
                          className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                          data-qa-action="open-workspace"
                        >
                          Open workspace →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Prefer full search? Use{" "}
        <Link to="/admin/candidates" className="text-primary hover:underline">
          /admin/candidates
        </Link>{" "}
        — every workspace opens the same route as here.
      </p>
    </main>
  );
}
