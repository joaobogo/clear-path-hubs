import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ViewerReadOnlyNotice } from "@/components/client/states";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { clientAction, undoClientDecision } from "@/lib/client-decisions.functions";
import { ACTION_TO_STAGE as RESULT_STAGE } from "@/lib/client-shared.server";
import { getClientCandidate } from "@/lib/client-candidates.functions";
import { getClientContext } from "@/lib/client-context.functions";
import type { MatchStage } from "@/lib/client-kpi.server";
import { OpenThreadButton } from "@/components/comms/open-thread-button";
import { NextStepNote } from "@/components/client/next-step-note";
import { CompensationPanel } from "@/components/client/compensation-panel";
import { getCompensationSignal } from "@/lib/compensation.functions";
import { confirmationLine } from "@/lib/client-next-step";
import { useSupportView } from "@/lib/support-view";
import {
  DecisionDialog,
  type DecisionPayload,
} from "@/components/client/decision-dialog";
import { QueryErrorCard } from "@/components/client/query-error";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { readStaleStateError } from "@/lib/decision-concurrency";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import {
  ACTION_TIMEOUT_MESSAGE,
  isActionTimeout,
  withActionTimeout,
} from "@/lib/client/action-timeout";

import { BackLink, CandidateHeader, CollapsibleSection } from "@/components/client/candidate-detail/shared";
import { ScoreFreshnessNote } from "@/components/client/score-freshness-note";
import { ScoreBreakdown } from "@/components/client/candidate-detail/score-breakdown";
import {
  EvaluationProvenance,
  FitHero,
  RequirementCoverage,
  WhyThisCandidate,
  WhyWeShortlisted,
} from "@/components/client/candidate-detail/evidence";
import {
  AvailabilityAndComp,
  ExperienceTimeline,
  InterviewGuide,
  LinksPanel,
  ProfilePanel,
  SkillsAndEducation,
} from "@/components/client/candidate-detail/profile";
import {
  ActivitySection,
  AuditTrailSection,
  InterviewFeedbackSection,
  JourneySection,
  TalentMemoryAction,
} from "@/components/client/candidate-detail/activity";
import {
  ACTIONS_BY_STAGE,
  ActionArea,
  MobileActionBar,
  type ActionKey,
} from "@/components/client/candidate-detail/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const RoutePending = makeWorkspacePending({ shape: "detail", kpis: false, width: "6xl" });
export const Route = createFileRoute("/_authenticated/client/candidates/$id")({
	pendingMs: 150,
	pendingComponent: RoutePending,
 head: () => ({
 meta: [
 { title: "Candidate · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 notFoundComponent: () => (
 <div className="p-8 text-sm text-muted-foreground">Candidate not found.</div>
 ),
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.candidates.$id.tsx"),
 component: CandidateDetailPage,
});

import {
  listSchedulableCandidates,
  requestInterview,
  type SchedulableCandidate,
} from "@/lib/interviews.functions";
import { RequestInterviewDialog } from "@/components/client/interviews/request-interview-dialog";
import { detectTimezone } from "@/components/client/interviews/helpers";
import { useAvailability } from "@/components/client/scheduling/availability-manager";
import { proposalErrorMessage } from "@/lib/interview-proposal";

function CandidateDetailPage() {
 const { id } = Route.useParams();
 const qc = useQueryClient();
 const ctxFn = useServerFn(getClientContext);
 const detailFn = useServerFn(getClientCandidate);
 const actionFn = useServerFn(clientAction);
 const orgSearch = useClientOrgSearch();
 const support = useSupportView();

 const ctxQuery = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const ctx = ctxQuery.data;
 const orgId = ctx?.active?.organization_id;

  const detailQuery = useQuery({
    // Staff preview reads the same sanitized payload, but may open a candidate
    // that is not published to this client yet.
    queryKey: ["client-candidate", orgId, id, support.active ? "preview" : "live"],
    queryFn: () =>
      detailFn({ data: { orgId: orgId!, matchId: id, ...(support.active ? { preview: true } : {}) } }),
    enabled: !!orgId,
  });

  const data = detailQuery.data;
  const detailPending = detailQuery.isPending;
  const detailFetching = detailQuery.isFetching;
  const detailError = detailQuery.error;

  // Compensation decision support — figures on record only, never estimates.
  const compFn = useServerFn(getCompensationSignal);
  const compQuery = useQuery({
    queryKey: ["client-candidate-comp", orgId, id],
    queryFn: () => compFn({ data: { orgId: orgId!, matchId: id } }),
    enabled: !!orgId,
  });
  const compSignal = compQuery.data;

  // Deep decision surface: a teammate or our team may move this candidate
  // while the page is open. Refresh in place and say so, rather than swapping
  // the panel silently.
  const live = useRouteRealtime({
    scope: "client-candidate",
    orgId: orgId ?? null,
    invalidateKeys: [
      ["client-candidate", orgId, id],
      ["client-candidate-comp", orgId, id],
    ],
  });
  const compPending = compQuery.isPending;



  const requestInterviewFn = useServerFn(requestInterview);
  const availability = useAvailability(orgId);
  const orgTimezone = (availability.data?.timezone as string | null | undefined) || detectTimezone();
  const [requestFailed, setRequestFailed] = useState<string | null>(null);

  const requestMut = useMutation({
    mutationFn: (payload: Parameters<typeof requestInterviewFn>[0]["data"]) =>
      requestInterviewFn({ data: payload }),
    onSuccess: () => {
      toast.success("Times proposed — we'll confirm with the candidate");
      setRequestFailed(null);
      setDialogAction(null);
      setPendingKey(null);
      qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-interviews", orgId] });
    },
    onError: (e: Error) => setRequestFailed(proposalErrorMessage(e.message)),
  });

  const [dialogAction, setDialogAction] = useState<ActionKey | null>(null);
 // Which action is in flight, so only the pressed button shows a spinner.
 const [pendingKey, setPendingKey] = useState<ActionKey | null>(null);
 // Stage captured at mutate time so the toast's Undo knows where to return to.
 const stageBeforeRef = useRef<MatchStage | null>(null);
 // Consequence line for the stage the decision moves the candidate into.
 const nextStepAfterRef = useRef<string | null>(null);
 const undoFn = useServerFn(undoClientDecision);

 // Exact cache key of the detail query. Optimistic writes and rollbacks must
 // use it verbatim — a shorter key writes a phantom entry nothing reads.
 const detailKey = ["client-candidate", orgId, id, support.active ? "preview" : "live"] as const;
  const act = useMutation({
    mutationFn: (p: DecisionPayload) =>
      withActionTimeout(() =>
        actionFn({
          data: {
            orgId: orgId!,
            matchId: id,
            action: p.action,
            expectedStage: stageBeforeRef.current ?? undefined,
            feedback: p.feedback,
            reasonCode: p.reasonCode,
            signals: p.signals,
          },
        }),
      ),
    onMutate: async (p: DecisionPayload) => {
      await qc.cancelQueries({ queryKey: detailKey });
      const previous = qc.getQueryData<AnyRow>(detailKey);
      const to = RESULT_STAGE[p.action as ActionKey];
      if (previous?.candidate && to) {
        qc.setQueryData(detailKey, {
          ...previous,
          candidate: { ...previous.candidate, stage: to },
        });
      }
      return { previous };
    },
    onSuccess: (res, p) => {
      const back = stageBeforeRef.current;
      toast.success(
        p.action === "request_interview"
          ? "Times proposed — we'll confirm with the candidate"
          : "Recorded — the TaaSFlow team has been notified.",
        {
          description: nextStepAfterRef.current ?? undefined,
          duration: 12_000,
          action: back
            ? {
                label: "Undo",
                onClick: (e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  const originalText = btn.textContent;
                  btn.disabled = true;
                  btn.textContent = "Undoing…";
                  void (async () => {
                    try {
                      await undoFn({ data: { orgId: orgId!, matchId: id, toStage: back } });
                      toast.success("Decision undone.");
                      await qc.invalidateQueries();
                    } catch {
                      toast.error(
                        "That decision can no longer be undone. Your recruiter can reverse it for you.",
                      );
                      btn.disabled = false;
                      btn.textContent = originalText;
                    }
                  })();
                },
              }
            : undefined,
        },
      );
      setDialogAction(null);
      qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
    },
 onSettled: () => setPendingKey(null),
 onError: (e: Error, p, context) => {
 // Visible revert: the panel returns to the stage it was in.
 if (context?.previous) qc.setQueryData(detailKey, context.previous);
 const stale = readStaleStateError(e);
 if (stale) {
 setDialogAction(null);
 qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
 toast.error("This candidate already moved", { description: stale.message, duration: 12_000 });
 return;
 }
 const msg = e.message.replace(/^Error: /, "");
 if (/reason/i.test(msg)) {
 toast.error("Pick a reason so we can act on it.");
 return;
 }
 toast.error(isActionTimeout(e) ? ACTION_TIMEOUT_MESSAGE : "That did not save", {
 description: isActionTimeout(e) ? undefined : msg || undefined,
 duration: 12_000,
 action: {
 label: "Retry",
 onClick: () => {
 setPendingKey(p.action as ActionKey);
 act.mutate(p);
 },
 },
 });
 },
 });



 // Advance-type moves go through in one click; anything needing a "why"
 // opens the structured reason picker.
  const NO_REASON_NEEDED = new Set<ActionKey>(["shortlist", "offer", "hire"]);
 const RESULT_STAGE: Partial<Record<ActionKey, MatchStage>> = {
 shortlist: "shortlisted",
 request_interview: "interview_process",
 offer: "offer",
 hire: "hired",
 not_moving_forward: "not_moving_forward",
 };
 const handleAct = (k: ActionKey, fromStage: MatchStage) => {
 if (act.isPending) return;
 stageBeforeRef.current = fromStage;
 const to = RESULT_STAGE[k];
 nextStepAfterRef.current = to ? confirmationLine(to) : null;
 if (NO_REASON_NEEDED.has(k)) {
 setPendingKey(k);
 act.mutate({ action: k });
 } else setDialogAction(k);
 };

  // Breadcrumb label must be published before any early return so the hook
  // order stays stable across loading, error and loaded renders.
  useDetailCrumb(
    (data as { candidate?: { candidate?: { display_name?: string } } } | null | undefined)
      ?.candidate?.candidate?.display_name,
  );

  // Error first, always: a failed load must never read as a missing candidate.
  if (ctxQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />
        <QueryErrorCard
          className="mt-4"
          title="We couldn't load your workspace"
          error={ctxQuery.error}
          onRetry={() => void ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }
  if (detailError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />
        <QueryErrorCard
          className="mt-4"
          title="We couldn't load this candidate"
          error={detailError}
          onRetry={() => void detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      </div>
    );
  }
  if (!orgId || detailPending || (data === undefined && detailFetching)) {
    return <div className="p-8 text-sm text-muted-foreground">Loading candidate…</div>;
  }
 if (data === null || !data?.candidate) {
 return (
 <div className="mx-auto max-w-3xl px-6 py-12">
 <BackLink />
 <div className="mt-4 rounded-lg border bg-card p-8 text-center">
 <h1 className="text-lg font-semibold">Candidate not shared with you yet</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 This profile isn't in your workspace. Either TaaSFlow hasn't approved them
 for one of your roles yet, they were withdrawn, or you're signed in to a
 different client account.
 </p>
 <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
 <Button asChild size="sm">
 <Link to="/client/candidates">See your candidates</Link>
 </Button>
 <Button asChild size="sm" variant="outline">
 <Link to="/client/conversations">Ask your recruiter</Link>
 </Button>
 </div>
 </div>
 </div>
 );
 }


 const { candidate, interviews, decisions } = data as {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
 interviews: AnyRow[];
 decisions: AnyRow[];
 };
 const isViewer = ctx?.active?.role === "client_viewer";
 const readOnly = support.readOnly || isViewer;
 const actions = ACTIONS_BY_STAGE[candidate.stage] ?? { primary: null, more: [] };
 // Icon-only controls name their subject so assistive tech (and the Playwright
 // suite) knows which candidate and role a decision applies to.
 const actionSubject = [candidate.candidate.display_name, candidate.position?.title]
  .filter(Boolean)
  .join(" for ");

 return (
 <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-8 lg:pt-8">
 <div className="flex items-center justify-between gap-3">
 <BackLink />
 <LiveUpdatedChip updatedAt={live.updatedAt} />
 </div>

 {/* HEADER */}
 <CandidateHeader
 candidate={candidate}
 readOnly={readOnly}
 />

 {orgId && (
 <div className="mt-3">
 <OpenThreadButton
 orgId={orgId}
 scope="candidate"
 candidateMatchId={id}
 subject={candidate.candidate.display_name}
 label="Conversation about this candidate"
 />
 </div>
 )}

 {/* Closes the loop: what we do next after your decision, and by when. */}
 <NextStepNote
 stage={candidate.stage}
 stageEnteredAt={candidate.stage_entered_at}
 className="mt-4"
 />

 {readOnly && support.readOnly && (
 <div
 role="status"
 className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
 >
 <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
 You are viewing this candidate as the Client. Actions are disabled in
 read-only preview.
 </div>
 )}

 {isViewer && !support.readOnly && (
 <ViewerReadOnlyNotice
 className="mt-4"
 area="deciding on this candidate"
 />
 )}


 <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
 {/* MAIN COLUMN */}
        <div className="space-y-6 lg:col-span-8">
          {/* TOP: is this a good fit, and why — nothing else competes here. */}
          <div id="sec-fit" className="scroll-mt-24 space-y-3">
            <FitHero candidate={candidate} />
            {/* Freshness is stated next to the assessment it qualifies, never hidden. */}
            <ScoreFreshnessNote
              freshness={candidate.freshness}
              orgId={orgId ?? null}
              matchId={id}
            />
          </div>

          {/* Decision facts that change the answer: money and timing, up top. */}
          <div id="sec-comp" className="scroll-mt-24">
            {compQuery.isError ? (
              <QueryErrorCard
                compact
                title="We couldn't load compensation figures"
                error={compQuery.error}
                onRetry={() => void compQuery.refetch()}
                retrying={compQuery.isFetching}
              />
            ) : (
              <CompensationPanel signal={compSignal} loading={compPending} />
            )}
          </div>
          <AvailabilityAndComp candidate={candidate} />

          {/* What to do next with them. */}
          <div id="sec-interview" className="scroll-mt-24"><InterviewGuide candidate={candidate} /></div>

          {/* DETAIL — collapsed by default, in order of interest. */}
          <div className="space-y-3">
            <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              The detail, if you want it
            </h2>
            <CollapsibleSection id="sec-coverage" title="Scoring criteria and coverage">
              <RequirementCoverage candidate={candidate} />
            </CollapsibleSection>
            <CollapsibleSection id="sec-breakdown" title="How the score was built">
              <div className="space-y-4">
                <ScoreBreakdown candidate={candidate} />
                <EvaluationProvenance candidate={candidate} />
              </div>
            </CollapsibleSection>
            <CollapsibleSection id="sec-why" title="Why we shortlisted them">
              <WhyWeShortlisted candidate={candidate} />
            </CollapsibleSection>
            <CollapsibleSection id="sec-strengths" title="Strengths in their own evidence">
              <WhyThisCandidate candidate={candidate} />
            </CollapsibleSection>
            <CollapsibleSection id="sec-experience" title="Career experience">
              <ExperienceTimeline candidate={candidate} />
            </CollapsibleSection>
            <CollapsibleSection id="sec-skills" title="Skills, education, and languages">
              <SkillsAndEducation candidate={candidate} />
            </CollapsibleSection>
            {candidate.screening_answers.length > 0 && (
              <CollapsibleSection title="Screening answers">
                <dl className="space-y-3 text-sm">
                  {candidate.screening_answers.map((a, i) => (
                    <div key={i}>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {a.question}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap">{a.answer || "Not provided"}</dd>
                    </div>
                  ))}
                </dl>
              </CollapsibleSection>
            )}
            {orgId ? (
              <CollapsibleSection id="sec-feedback" title="Interview feedback">
                <InterviewFeedbackSection orgId={orgId} matchId={id} readOnly={readOnly} />
              </CollapsibleSection>
            ) : null}
            <CollapsibleSection id="sec-activity" title="History and activity">
              <div className="space-y-6">
                {(interviews.length > 0 || decisions.length > 0) && (
                  <ActivitySection interviews={interviews} decisions={decisions} />
                )}
                <JourneySection matchId={candidate.match_id} />
                <AuditTrailSection candidate={candidate} />
              </div>
            </CollapsibleSection>
          </div>
        </div>


        {/* SIDE PANEL — Decision cockpit (sticky on desktop) */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-6">
            <ActionArea
              actions={actions}
              readOnly={readOnly}
              pending={act.isPending}
              pendingKey={pendingKey}
              onAct={(k) => handleAct(k, candidate.stage)}
              stage={candidate.stage}
              matchId={candidate.match_id}
              subject={actionSubject}
            />
            <TalentMemoryAction
              orgId={orgId}
              matchId={candidate.match_id}
              candidateName={candidate.candidate.display_name}
              roleTitle={candidate.position?.title ?? null}
              readOnly={readOnly}
            />
            <ProfilePanel candidate={candidate} />
            <LinksPanel candidate={candidate} />
          </div>
        </aside>
      </div>

      {/* MOBILE ACTION BAR — visible only on small screens */}
      {!readOnly && actions.primary && candidate.stage !== "hired" && (
        <MobileActionBar
          actions={actions}
          pending={act.isPending}
          pendingKey={pendingKey}
          onAct={(k) => handleAct(k, candidate.stage)}
          subject={actionSubject}
        />
      )}

      {/* Every consequential decision is confirmed, reasoned, and logged. */}
      {dialogAction === "request_interview" && orgId ? (
        <RequestInterviewDialog
          orgId={orgId}
          onClose={() => {
            setDialogAction(null);
            setPendingKey(null);
          }}
          submitting={requestMut.isPending}
          failed={requestFailed}
          timezone={orgTimezone}
          onSubmit={(payload) => requestMut.mutate(payload)}
          fetchCandidates={async () => ({
            candidates: [
              {
                match_id: id,
                candidate_id: (candidate.candidate as AnyRow).id,
                candidate_name: candidate.candidate.display_name,
                candidate_email: (candidate.candidate as AnyRow).email ?? null,
                position_id: (candidate.position as AnyRow)?.id ?? "",
                position_title: candidate.position?.title ?? "Position",
                stage: candidate.stage,
                has_active_interview: false,
                availability_preference: (candidate.candidate as AnyRow).availability 
                  ? JSON.parse(JSON.stringify((candidate.candidate as AnyRow).availability)) 
                  : null,
              },
            ],
          })}
          initialMatchId={id}
        />
      ) : (
        <DecisionDialog
          action={dialogAction as never}
          open={!!dialogAction && dialogAction !== "request_interview"}
          pending={act.isPending}
          onOpenChange={(v) => !v && setDialogAction(null)}
          onConfirm={(payload) => {
            if (act.isPending) return;
            setPendingKey(payload.action as ActionKey);
            stageBeforeRef.current = candidate.stage;
            nextStepAfterRef.current =
              payload.action === "hold"
                ? "We'll pause outreach and keep them warm until you tell us to move."
                : RESULT_STAGE[payload.action as ActionKey]
                  ? confirmationLine(RESULT_STAGE[payload.action as ActionKey]!)
                  : null;
            act.mutate(payload as DecisionPayload);
          }}
        />
      )}

    </div>
  );
}
