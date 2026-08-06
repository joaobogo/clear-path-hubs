import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare, ShieldAlert } from "lucide-react";
import { clientAction, undoClientDecision } from "@/lib/client-decisions.functions";
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
import { InterviewerAssignments } from "@/components/client/interviewer-assignments";
import { CandidateTeamActivity } from "@/components/client/candidate-team-activity";
import { QueryErrorCard } from "@/components/client/query-error";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { readStaleStateError } from "@/lib/decision-concurrency";
import { useClientOrgSearch } from "@/lib/use-client-org";

import { BackLink, CandidateHeader, JumpNav, SectionCard } from "@/components/client/candidate-detail/shared";
import {
  EvaluationProvenance,
  FitHero,
  RequirementCoverage,
  WhatNeedsValidation,
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
 queryKey: ["client-candidate", orgId, id],
 queryFn: () => detailFn({ data: { orgId: orgId!, matchId: id } }),
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



 const [dialogAction, setDialogAction] = useState<ActionKey | null>(null);
 // Which action is in flight, so only the pressed button shows a spinner.
 const [pendingKey, setPendingKey] = useState<ActionKey | null>(null);
 // Stage captured at mutate time so the toast's Undo knows where to return to.
 const stageBeforeRef = useRef<MatchStage | null>(null);
 // Consequence line for the stage the decision moves the candidate into.
 const nextStepAfterRef = useRef<string | null>(null);
 const undoFn = useServerFn(undoClientDecision);

 const act = useMutation({
 mutationFn: (p: DecisionPayload) =>
 actionFn({
 data: {
 orgId: orgId!,
 matchId: id,
 action: p.action,
 // Stage the operator was looking at. If the candidate has already
 // moved, the server refuses instead of applying a stale decision.
 expectedStage: data?.candidate?.stage,
 feedback: p.feedback,
 reasonCode: p.reasonCode,
 signals: p.signals,
 },
 }),
 onSuccess: () => {
 const back = stageBeforeRef.current;
 toast.success("Recorded — the TaaSFlow team has been notified.", {
 description: nextStepAfterRef.current ?? undefined,
 duration: 12_000,
 action: back
 ? {
 label: "Undo",
 onClick: () => {
 void (async () => {
 try {
 await undoFn({ data: { orgId: orgId!, matchId: id, toStage: back } });
 toast.success("Decision undone.");
 await qc.invalidateQueries();
 } catch {
 toast.error(
 "That decision can no longer be undone. Your recruiter can reverse it for you.",
 );
 }
 })();
 },
 }
 : undefined,
 });
 setDialogAction(null);
 qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
 qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
 qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
 qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
 },
 onSettled: () => setPendingKey(null),
 onError: (e: Error) => {
 const stale = readStaleStateError(e);
 if (stale) {
 setDialogAction(null);
 qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
 toast.error("This candidate already moved", { description: stale.message, duration: 12_000 });
 return;
 }
 const msg = e.message.replace(/^Error: /, "");
 toast.error(
 /reason/i.test(msg) ? "Pick a reason so we can act on it." : "That did not save — try again",
 );
 },
 });


 // Advance-type moves go through in one click; anything needing a "why"
 // opens the structured reason picker.
 const NO_REASON_NEEDED = new Set<ActionKey>([
 "shortlist",
 "request_interview",
 "offer",
 "hire",
 ]);
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

  // Error first, always: a failed load must never read as a missing candidate.
  if (ctxQuery.isError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />
        <QueryErrorCard
          className="mt-4"
          title="We couldn't load your workspace"
          error={ctxQuery.error}
          onRetry={() => void ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </main>
    );
  }
  if (detailError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />
        <QueryErrorCard
          className="mt-4"
          title="We couldn't load this candidate"
          error={detailError}
          onRetry={() => void detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      </main>
    );
  }
  if (!orgId || detailPending || (data === undefined && detailFetching)) {
    return <div className="p-8 text-sm text-muted-foreground">Loading candidate…</div>;
  }
 if (data === null || !data?.candidate) {
 return (
 <main className="mx-auto max-w-3xl px-6 py-12">
 <BackLink />
 <div className="mt-4 rounded-lg border bg-card p-8 text-center">
 <h1 className="text-lg font-semibold">Candidate unavailable</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 This candidate is no longer visible in your workspace. They may have been
 withdrawn, or you may be viewing a different client account.
 </p>
 </div>
 </main>
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
 <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-8 lg:pt-8">
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

 <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
 {/* MAIN COLUMN */}
        <div className="space-y-6 lg:col-span-8">
          <JumpNav
            items={[
              { id: "sec-fit", label: "Summary" },
              { id: "sec-why", label: "Why shortlisted" },
              { id: "sec-coverage", label: "Requirements" },
              { id: "sec-strengths", label: "Strengths" },
              { id: "sec-risks", label: "Risks" },
              { id: "sec-interview", label: "Interview" },
              { id: "sec-experience", label: "Experience" },
              { id: "sec-skills", label: "Skills" },
              { id: "sec-activity", label: "Activity" },
            ]}
          />
          <div id="sec-fit" className="scroll-mt-24 space-y-3">
            <FitHero candidate={candidate} />
            {/* Freshness is stated next to the assessment it qualifies, never hidden. */}
            <ScoreFreshnessNote
              freshness={candidate.freshness}
              orgId={orgId ?? null}
              matchId={id}
            />
          </div>
          <EvaluationProvenance candidate={candidate} />
          <div id="sec-why" className="scroll-mt-24"><WhyWeShortlisted candidate={candidate} /></div>
          <div id="sec-coverage" className="scroll-mt-24"><RequirementCoverage candidate={candidate} /></div>
          <div id="sec-strengths" className="scroll-mt-24"><WhyThisCandidate candidate={candidate} /></div>
          <div id="sec-risks" className="scroll-mt-24"><WhatNeedsValidation candidate={candidate} /></div>
          <AvailabilityAndComp candidate={candidate} />
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
          <div id="sec-interview" className="scroll-mt-24"><InterviewGuide candidate={candidate} /></div>
          {orgId ? (
            <div id="sec-feedback" className="scroll-mt-24">
              <InterviewFeedbackSection orgId={orgId} matchId={id} readOnly={readOnly} />
            </div>
          ) : null}
          <div id="sec-experience" className="scroll-mt-24"><ExperienceTimeline candidate={candidate} /></div>
          <div id="sec-skills" className="scroll-mt-24"><SkillsAndEducation candidate={candidate} /></div>
          {candidate.screening_answers.length > 0 && (
            <SectionCard title="Screening answers" icon={<MessageSquare className="h-4 w-4" />}>
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
            </SectionCard>
          )}
          <div id="sec-activity" className="scroll-mt-24 space-y-6">
            {(interviews.length > 0 || decisions.length > 0) && (
              <ActivitySection interviews={interviews} decisions={decisions} />
            )}
            <JourneySection matchId={candidate.match_id} />
            <AuditTrailSection candidate={candidate} />
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
            {/* Interviewers never see who else was given access to a candidate. */}
            {!isViewer && orgId && (
              <InterviewerAssignments
                orgId={orgId}
                matchId={candidate.match_id}
                readOnly={support.readOnly}
              />
            )}
            {orgId && (
              <CandidateTeamActivity
                orgId={orgId}
                matchId={candidate.match_id}
                recordView={!support.readOnly}
              />
            )}
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
          onAct={(k) => handleAct(k, candidate.stage)}
          subject={actionSubject}
        />
      )}

      {/* Every consequential decision is confirmed, reasoned, and logged. */}
      <DecisionDialog
        action={dialogAction}
        open={dialogAction !== null}
        pending={act.isPending}
        onOpenChange={(v) => !v && setDialogAction(null)}
        onConfirm={(payload) => {
          if (act.isPending) return; // guard against double submission
          setPendingKey(payload.action);
          stageBeforeRef.current = candidate.stage;
          nextStepAfterRef.current =
            payload.action === "hold"
              ? "We'll pause outreach and keep them warm until you tell us to move."
              : RESULT_STAGE[payload.action]
                ? confirmationLine(RESULT_STAGE[payload.action]!)
                : null;
          act.mutate(payload);
        }}
      />

    </main>
  );
}
