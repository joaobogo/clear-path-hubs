import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listScoringOrphans, resolveScoringOrphan } from "@/lib/scoring.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/_authenticated/admin/scoring/orphans")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["scoring-orphans"],
      queryFn: () => listScoringOrphans(),
    }),
  head: () => ({
    meta: [
      { title: "Scoring Orphans · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Historical scoring rows whose identity does not resolve to a canonical rubric version. Platform staff review and resolve.",
      },
    ],
  }),
  component: OrphansPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.scoring.orphans"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function OrphansPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["scoring-orphans"],
    queryFn: () => listScoringOrphans(),
  });
  const resolveFn = useServerFn(resolveScoringOrphan);
  const [note, setNote] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (input: {
      orphan_id: string;
      action: "mark_failed" | "acknowledge";
      note?: string;
    }) => resolveFn({ data: input }),
    onSuccess: async () => {
      setFeedback("Resolved.");
      await qc.invalidateQueries({ queryKey: ["scoring-orphans"] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const open = data.filter((o) => !o.resolved_at);
  const resolved = data.filter((o) => o.resolved_at);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Scoring orphans</h1>
        <p className="text-sm text-muted-foreground">
          Historical rows whose scoring identity does not resolve to a canonical
          rubric version. Review each row and either acknowledge (leave as-is
          for supersession) or mark the match as failed. Nothing is deleted.
        </p>
      </header>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Open ({open.length})
        </h2>
        {open.length === 0 && (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            No unresolved scoring orphans. Historical scores are fully linked.
          </div>
        )}
        {open.map((o) => (
          <article
            key={o.id}
            className="rounded-md border p-4 space-y-3 bg-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{o.reason}</Badge>
                  <span className="text-muted-foreground">
                    detected {new Date(o.detected_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                  </span>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  match {o.candidate_match_id ?? "—"} · run {o.score_run_id ?? "—"}
                </div>
                {Object.keys(o.detail ?? {}).length > 0 && (
                  <pre className="text-xs bg-muted rounded px-2 py-1 overflow-auto">
                    {JSON.stringify(o.detail, null, 2)}
                  </pre>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Optional resolution note"
                className="flex-1 min-w-64 rounded-md border px-2 py-1 text-sm"
                value={note[o.id] ?? ""}
                onChange={(e) =>
                  setNote((s) => ({ ...s, [o.id]: e.target.value }))
                }
              />
              <Button
                variant="outline"
                size="sm"
                disabled={mut.isPending}
                onClick={() =>
                  mut.mutate({
                    orphan_id: o.id,
                    action: "acknowledge",
                    note: note[o.id],
                  })
                }
              >
                Acknowledge
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={mut.isPending || !o.candidate_match_id}
                onClick={() =>
                  mut.mutate({
                    orphan_id: o.id,
                    action: "mark_failed",
                    note: note[o.id],
                  })
                }
              >
                Mark match failed
              </Button>
            </div>
          </article>
        ))}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Resolved ({resolved.length})
          </h2>
          <div className="rounded-md border divide-y">
            {resolved.slice(0, 50).map((o) => (
              <div key={o.id} className="p-3 text-sm flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium">{o.reason}</span>{" "}
                  <span className="text-muted-foreground">
                    · resolved {o.resolved_at && new Date(o.resolved_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                  </span>
                  {o.resolution_note && (
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {o.resolution_note}
                    </div>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {o.candidate_match_id?.slice(0, 8) ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
