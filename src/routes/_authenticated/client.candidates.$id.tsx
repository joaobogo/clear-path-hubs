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
  const {
    data,
    isPending: detailPending,
    isFetching: detailFetching,
    error: detailError,
  } = useQuery({
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

  // Loading: waiting on org context, or the query is enabled and still fetching.
  if (!orgId || detailPending || (data === undefined && detailFetching)) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (detailError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load candidate: {detailError.message}
        </div>
        <div className="mt-4">
          <Link to="/client/candidates" className="text-sm text-primary hover:underline">
            ← Back to candidates
          </Link>
        </div>
      </div>
    );
  }

  // Server returned null — the match is not visible to this org (either it
  // was withdrawn, the org context is wrong, or client_visibility is hidden).
  if (data === null || !data?.candidate) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold">Candidate unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This candidate is no longer visible in your workspace. They may have
            been withdrawn, or you may be viewing a different client account.
          </p>
          <div className="mt-4">
            <Link
              to="/client/candidates"
              search={(prev) => prev}
              className="text-sm text-primary hover:underline"
            >
              ← Back to candidates
            </Link>
          </div>
        </div>
      </main>
    );
  }



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
        <div className="flex items-center gap-4">
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
          <DownloadCvButton matchId={candidate.match_id} />
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {candidate.summary && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-1">Recommendation</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {candidate.summary}
              </p>
            </div>
          )}

          {candidate.candidate.summary && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-1">Candidate summary</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {candidate.candidate.summary}
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

          {candidate.experience.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Relevant experience</h2>
              <ul className="space-y-3 text-sm">
                {candidate.experience.map((e, i) => (
                  <li key={i}>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {[e.company, e.period].filter(Boolean).join(" · ")}
                    </div>
                    {e.description && (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                        {e.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.skills.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {candidate.education.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Education</h2>
              <ul className="space-y-2 text-sm">
                {candidate.education.map((e, i) => (
                  <li key={i}>
                    <div className="font-medium">{e.degree ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[e.institution, e.period].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.screening_answers.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-medium mb-2">Screening answers</h2>
              <dl className="space-y-3 text-sm">
                {candidate.screening_answers.map((a, i) => (
                  <div key={i}>
                    <dt className="text-xs text-muted-foreground">{a.question}</dt>
                    <dd className="whitespace-pre-wrap">{a.answer || "—"}</dd>
                  </div>
                ))}
              </dl>
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
          {ctx?.active?.role !== "client_viewer" && (
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
              <Link
                to="/client/messages"
                className="mt-3 block text-center text-sm text-primary hover:underline"
              >
                Message TaaSFlow →
              </Link>
            </div>
          )}

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
              {candidate.candidate.years_experience != null && (
                <div>
                  <dt className="text-muted-foreground">Years of experience</dt>
                  <dd>{candidate.candidate.years_experience}</dd>
                </div>
              )}
              {candidate.work_authorization && (
                <div>
                  <dt className="text-muted-foreground">Work authorization</dt>
                  <dd>{candidate.work_authorization}</dd>
                </div>
              )}
              {candidate.languages.length > 0 && (
                <div>
                  <dt className="text-muted-foreground">Languages</dt>
                  <dd>
                    {candidate.languages
                      .map((l) => (l.level ? `${l.name} (${l.level})` : l.name))
                      .join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
}

