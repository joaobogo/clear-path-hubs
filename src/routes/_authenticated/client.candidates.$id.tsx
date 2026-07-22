import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  clientAction,
  getClientCandidate,
  getClientContext,
} from "@/lib/client.functions";
import { DownloadCvButton } from "@/components/download-cv-button";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { ActionGuard } from "@/components/action-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/client/candidates/$id")({
  head: () => ({
    meta: [
      { title: "Candidate · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="p-8">Candidate not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load: {error.message}</div>
  ),
  component: CandidateDetailPage,
});

const ACTIONS = [
  { key: "shortlist", label: "Shortlist" },
  { key: "request_interview", label: "Request interview" },
  { key: "request_more_information", label: "Request more info" },
  { key: "submit_feedback", label: "Submit feedback" },
  { key: "not_moving_forward", label: "Not moving forward" },
  { key: "offer", label: "Extend offer" },
  { key: "hire", label: "Hire" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function CandidateDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const ctxFn = useServerFn(getClientContext);
  const detailFn = useServerFn(getClientCandidate);
  const actionFn = useServerFn(clientAction);

  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const { data } = useQuery({
    queryKey: ["client-candidate", orgId, id],
    queryFn: () => detailFn({ data: { orgId: orgId!, matchId: id } }),
    enabled: !!orgId,
  });

  const act = useMutation({
    mutationFn: (a: (typeof ACTIONS)[number]["key"]) =>
      actionFn({
        data: {
          orgId: orgId!,
          matchId: id,
          action: a,
          feedback: feedback.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Recorded");
      setFeedback("");
      qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data.candidate) throw notFound();

  const { candidate, interviews, decisions } = data as {
    candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
    interviews: AnyRow[];
    decisions: AnyRow[];
  };
  const evidence = candidate.evidence;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-4">
        <Link to="/client/candidates" className="text-sm text-muted-foreground hover:underline">
          ← All candidates
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {candidate.candidate.display_name}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">
            {candidate.candidate.headline}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge variant="outline" className="capitalize">
              {String(candidate.stage).replace(/_/g, " ")}
            </Badge>
            {candidate.position && (
              <Link
                to="/client/positions/$id"
                params={{ id: candidate.position.id }}
                className="text-primary hover:underline"
              >
                {candidate.position.title}
              </Link>
            )}
          </div>
        </div>
        {candidate.score != null && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Approved score
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {candidate.score.toFixed(0)}
            </div>
            {candidate.fit_label && (
              <div className="text-xs capitalize text-muted-foreground">{candidate.fit_label} fit</div>
            )}
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {candidate.summary && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-1">Summary</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {candidate.summary}
              </p>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Evidence</h2>
              <ul className="space-y-2 text-sm">
                {evidence.map((e, i) => (
                  <li key={i} className="border-l-2 border-muted pl-3">
                    <div className="text-xs text-muted-foreground">{e.label}</div>
                    <div>{e.snippet}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(candidate.strengths.length > 0 || candidate.main_consideration) && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Requirement coverage</h2>
              {candidate.strengths.length > 0 && (
                <div className="text-sm mb-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Strengths
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {candidate.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {candidate.main_consideration && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Main consideration: </span>
                  {candidate.main_consideration}
                </div>
              )}
            </div>
          )}


          {interviews.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Interviews</h2>
              <ul className="text-sm space-y-1">
                {interviews.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between">
                    <span className="capitalize">{iv.status}</span>
                    <span className="text-xs text-muted-foreground">
                      {iv.scheduled_at ?? iv.requested_at ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {decisions.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Decision history</h2>
              <ul className="text-sm space-y-2">
                {decisions.map((d) => (
                  <li key={d.id} className="border-b pb-2 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="capitalize font-medium">
                        {String(d.decision).replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                      </span>
                    </div>
                    {d.feedback && (
                      <div className="mt-1 text-muted-foreground">{d.feedback}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium mb-2">Actions</h2>
            {support.readOnly && (
              <p className="mb-3 rounded border border-dashed border-primary/40 bg-primary/5 p-2 text-xs text-muted-foreground">
                Client actions are disabled while viewing this workspace as a TaaSFlow administrator.
              </p>
            )}
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional feedback for TaaSFlow"
              className="mb-3 text-sm"
              rows={3}
              disabled={support.readOnly}
            />
            <div className="grid grid-cols-1 gap-2">
              {ACTIONS.map((a) => (
                <ActionGuard
                  key={a.key}
                  reason={`${a.label} is disabled while viewing as an administrator.`}
                >
                  <Button
                    variant={a.key === "hire" ? "default" : "outline"}
                    disabled={act.isPending}
                    onClick={() => act.mutate(a.key)}
                  >
                    {a.label}
                  </Button>
                </ActionGuard>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm">
            <h2 className="font-medium mb-2">Profile</h2>
            <dl className="space-y-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{candidate.candidate.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Availability</dt>
                <dd>{candidate.candidate.availability ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
}
