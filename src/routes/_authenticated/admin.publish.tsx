import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPublishQueue, getClientPreview } from "@/lib/admin.functions";
import { applyReviewDecision } from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/publish")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["publish-queue"],
      queryFn: () => getPublishQueue(),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Publish desk unavailable: {error.message}</div>
  ),
  head: () => ({ meta: [{ title: "Publish Desk · TaaSFlow admin" }] }),
  component: PublishDesk,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PublishDesk() {
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery({
    queryKey: ["publish-queue"],
    queryFn: () => getPublishQueue(),
  });
  const [activeId, setActiveId] = useState<string | null>(
    (rows as AnyRow[])[0]?.id ?? null,
  );

  return (
    <main className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0 min-h-[calc(100vh)]">
      <aside className="border-r bg-card p-3 overflow-y-auto">
        <div className="mb-3">
          <h1 className="text-lg font-semibold">Publish Desk</h1>
          <p className="text-xs text-muted-foreground">
            Scored candidates awaiting client publication.
          </p>
        </div>
        <ul className="space-y-1">
          {(rows as AnyRow[]).map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setActiveId(r.id)}
                className={`w-full rounded p-2 text-left text-sm transition ${
                  activeId === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">
                  {r.candidate_profiles?.full_name ?? "—"}
                </div>
                <div className="text-xs opacity-80 truncate">
                  {r.positions?.title} · {r.positions?.organizations?.name}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs opacity-80">
                  <span>{r.score_runs?.score?.toFixed(0) ?? "—"}</span>
                  <span>·</span>
                  <span>{r.admin_status}</span>
                  {r.score_runs?.contradiction_status &&
                    r.score_runs.contradiction_status !== "none" && (
                      <span className="text-amber-500">⚠</span>
                    )}
                </div>
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              Queue empty.
            </li>
          )}
        </ul>
      </aside>
      <section className="min-w-0 overflow-y-auto">
        {activeId ? (
          <SideBySide matchId={activeId} onDone={() => qc.invalidateQueries({ queryKey: ["publish-queue"] })} />
        ) : (
          <div className="p-8 text-muted-foreground">Select a candidate.</div>
        )}
      </section>
    </main>
  );
}

function SideBySide({ matchId, onDone }: { matchId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: preview, isLoading } = useQuery({
    queryKey: ["client-preview", matchId],
    queryFn: () => getClientPreview({ data: { match_id: matchId } }),
  });
  const decisionFn = useServerFn(applyReviewDecision);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doAction = useMutation({
    mutationFn: (action: "approve_for_client" | "hold" | "archive") =>
      decisionFn({ data: { match_id: matchId, action, reason: reason || undefined } }),
    onSuccess: async (r) => {
      setFeedback(`${r.action} applied.`);
      setError(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["publish-queue"] });
      await qc.invalidateQueries({ queryKey: ["client-preview", matchId] });
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !preview)
    return <div className="p-8 text-muted-foreground">Loading preview…</div>;
  const p = preview as AnyRow;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x">
      <div className="p-6 space-y-4">
        <header>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin review
          </div>
          <h2 className="text-xl font-semibold mt-1">
            {p.candidate.display_name} — {p.position.title}
          </h2>
          <div className="text-sm text-muted-foreground">
            {p.position.client_name}
          </div>
          <div className="mt-2 flex gap-2">
            <Badge>score {p.score?.toFixed(1) ?? "—"}</Badge>
            {p.fit_label && <Badge variant="secondary">{p.fit_label}</Badge>}
          </div>
        </header>
        <div>
          <h3 className="font-medium">Evidence ({p.evidence?.length ?? 0})</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(p.evidence as AnyRow[])?.slice(0, 8).map((e, i) => (
              <li key={i} className="rounded border bg-muted/30 p-2">
                <div className="font-medium">{e.requirement_text}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  “…{e.snippet}…” <code>{e.source}</code>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-medium">Concerns</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {(p.concerns as string[])?.map((c, i) => <li key={i}>{c}</li>)}
            {(p.concerns?.length ?? 0) === 0 && (
              <li className="list-none text-muted-foreground">None flagged.</li>
            )}
          </ul>
        </div>
        <Link
          to="/admin/candidates/$id"
          params={{ id: matchId }}
          className="inline-block text-sm text-primary hover:underline"
        >
          Full candidate workspace →
        </Link>
      </div>

      <div className="p-6 bg-muted/20 space-y-4">
        <header>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client preview (sanitized)
          </div>
          <h2 className="text-xl font-semibold mt-1">{p.candidate.display_name}</h2>
          <div className="text-sm text-muted-foreground">
            {p.candidate.location ?? "Location undisclosed"} ·{" "}
            {p.candidate.experience_years
              ? `${p.candidate.experience_years} yrs`
              : "experience undisclosed"}
          </div>
        </header>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">
              {p.score?.toFixed(1) ?? "—"}
            </div>
            <div>
              <div className="font-medium capitalize">
                {p.fit_label?.replace(/_/g, " ")}
              </div>
              <div className="text-xs text-muted-foreground">Fit for {p.position.title}</div>
            </div>
          </div>
          <p className="mt-3 text-sm">{p.explanation}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium">Strengths</h3>
          <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
            {(p.strengths as string[])?.map((s, i) => <li key={i}>{s}</li>)}
            {(p.strengths?.length ?? 0) === 0 && (
              <li className="list-none text-muted-foreground">None yet.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium">Skills</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {(p.candidate.skills as string[])?.slice(0, 20).map((sk, i) => (
              <Badge key={i} variant="outline">
                {sk}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Withheld from clients: contact details, CV, contradiction flags, admin notes,
          trace ids.
        </p>
      </div>

      <div className="xl:col-span-2 border-t p-6 bg-card space-y-3">
        {feedback && <Alert><AlertDescription>{feedback}</AlertDescription></Alert>}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Textarea
          placeholder="Reason (optional, recorded on the decision)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={doAction.isPending}
            onClick={() => doAction.mutate("approve_for_client")}
            data-qa-action="publish-approve"
          >
            {doAction.isPending ? "Publishing…" : "Approve & Publish"}
          </Button>
          <Button
            variant="secondary"
            disabled={doAction.isPending}
            onClick={() => doAction.mutate("hold")}
            data-qa-action="publish-hold"
          >
            Hold
          </Button>
          <Link
            to="/admin/candidates/$id"
            params={{ id: matchId }}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Request repair
          </Link>
          <Button
            variant="destructive"
            disabled={doAction.isPending}
            onClick={() => doAction.mutate("archive")}
          >
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
