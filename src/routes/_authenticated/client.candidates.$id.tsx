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

import { BackLink, CandidateHeader, CollapsibleSection, ContactBlock } from "@/components/client/candidate-detail/shared";
import { TopSignals } from "@/components/client/candidate-detail/top-signals";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CvDownloadAudit } from "@/components/cv-download-audit";
import { ScoreFreshnessNote } from "@/components/client/score-freshness-note";
import { ScoreBreakdown } from "@/components/client/candidate-detail/score-breakdown";
import {
  FitHero,
  RequirementCoverage,
  WhyThisCandidate,
} from "@/components/client/candidate-detail/evidence";
import {
  AvailabilityPanel,
  ExperienceTimeline,
  InterviewGuide,
  LinksPanel,
  SkillsAndEducation,
} from "@/components/client/candidate-detail/profile";


import {
  ActivitySection,
  AuditTrailSection,
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
    onError: (e: Error) => {
      const msg = proposalErrorMessage(e.message);
      setRequestFailed(msg);
      setPendingKey(null);
      toast.error("Could not request interview", {
        description: msg,
        action: {
          label: "Try again",
          onClick: () => {
            // Re-opening the dialog with the same action will allow retry
            setDialogAction("request_interview");
          },
        },
      });
    },
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
                    } catch (e) {
                      const msg = e instanceof Error ? e.message.replace(/^Error:\s*/, "") : "";
                      toast.error("That decision can no longer be undone", {
                        description: msg || "Your recruiter can reverse it for you.",
                      });
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
  const NO_REASON_NEEDED = new Set<ActionKey>(["shortlist"]);
 const RESULT_STAGE: Partial<Record<ActionKey, MatchStage>> = {
 shortlist: "shortlisted",
 request_interview: "interview_process",
 offer: "offer",
 hire: "hired",
 not_moving_forward: "not_moving_forward",
 };
  const handleAct = (k: ActionKey, fromStage: MatchStage) => {
    if (act.isPending || requestMut.isPending) return;
    stageBeforeRef.current = fromStage;
    const to = RESULT_STAGE[k];
    nextStepAfterRef.current = to ? confirmationLine(to) : null;
    if (NO_REASON_NEEDED.has(k)) {
      setPendingKey(k);
      act.mutate({ action: k });
    } else {
      setDialogAction(k);
    }
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

  const verdictTrusted = true;


 return (
 <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-8 lg:pt-8">
 <div className="flex items-center justify-between gap-3">
 <BackLink />
 <LiveUpdatedChip updatedAt={live.updatedAt} />
 </div>

 {/* 1 — IDENTITY */}
 <CandidateHeader
 candidate={candidate}
 readOnly={readOnly}
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

 <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
 <div className="space-y-4 lg:col-span-8">
 {/* 2 — THE VERDICT */}
 {verdictTrusted ? (
 <div id="sec-fit" className="scroll-mt-24 space-y-3">
  <FitHero candidate={candidate} />
 </div>
 ) : (
  <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
  We are still reconciling the evidence for this candidate. The fit assessment below is based on the initial screening.
  </div>

 )}

 {/* 3 — WHY, AND WHAT TO CHECK */}
 <TopSignals candidate={candidate} />

 {/* 4 — CONTACT (one preview, one download) */}
 <ContactBlock candidate={candidate} />
 </div>

      {/* 5 — DECISION BAR */}
      <aside className="space-y-4 lg:col-span-4">
        <ActionArea
          actions={actions}
          readOnly={readOnly}
          pending={act.isPending || requestMut.isPending}
          pendingKey={pendingKey}
          onAct={(k) => handleAct(k, candidate.stage)}
          stage={candidate.stage}
          matchId={candidate.match_id}
          subject={actionSubject}
        />

        {dialogAction === "request_interview" && orgId && (
          <RequestInterviewDialog
            orgId={orgId}
            timezone={orgTimezone}
            submitting={requestMut.isPending}
            failed={requestFailed}
            onClose={() => {
              setDialogAction(null);
              setRequestFailed(null);
            }}
            onSubmit={(payload) => {
              setPendingKey("request_interview");
              requestMut.mutate(payload);
            }}
            fetchCandidates={async () => {
              const res = await listSchedulableCandidates({ data: { orgId: orgId! } });
              return res as any;
            }}
            initialMatchId={candidate.match_id}
          />
        )}

        <NextStepNote
          stage={candidate.stage}
          stageEnteredAt={candidate.stage_entered_at}
        />
 {orgId && (
 <OpenThreadButton
 orgId={orgId}
 scope="candidate"
 candidateMatchId={id}
 subject={candidate.candidate.display_name}
 label="Conversation about this candidate"
 />
 )}
 <TalentMemoryAction
 orgId={orgId}
 matchId={candidate.match_id}
 candidateName={candidate.candidate.display_name}
 roleTitle={candidate.position?.title ?? null}
 readOnly={readOnly}
 />
 </aside>
 </div>

 {/* BELOW THE FOLD — four tabs, everything else lives inside them. */}
 <Tabs defaultValue="summary" className="mt-8">
 <TabsList className="flex w-full flex-wrap justify-start">
 <TabsTrigger value="summary">Summary &amp; evidence</TabsTrigger>
 <TabsTrigger value="interview">Interview</TabsTrigger>
 <TabsTrigger value="cv">CV</TabsTrigger>
 <TabsTrigger value="activity">Activity</TabsTrigger>
 </TabsList>

 <TabsContent value="summary" className="mt-4 space-y-4">
  {/* Requirement coverage is hidden per B5 until fixed */}
  {/* <RequirementCoverage candidate={candidate} withRationale /> */}
  {/* Score breakdown is hidden per B4 until fixed */}
  {/* <ScoreBreakdown candidate={candidate} /> */}

 <WhyThisCandidate candidate={candidate} />
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
 <AvailabilityPanel candidate={candidate} />
 <ExperienceTimeline candidate={candidate} />
 <SkillsAndEducation candidate={candidate} />
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
  <div className="grid gap-4 sm:grid-cols-2">
    <LinksPanel candidate={candidate} />
  </div>

 </TabsContent>

 <TabsContent value="interview" className="mt-4 space-y-4">
 <InterviewGuide candidate={candidate} />
 <div className="rounded-xl border bg-card p-4">
 <h2 className="text-sm font-semibold">Interview feedback</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Feedback is collected and shown in one place, alongside the scheduled
 interview.
 </p>
 <Button asChild variant="outline" size="sm" className="mt-3">
 <Link to="/client/interviews" search={{ interview: undefined, feedback: undefined }}>Go to interviews →</Link>
 </Button>
 </div>
 </TabsContent>

 <TabsContent value="cv" className="mt-4 space-y-4">
 <div className="rounded-xl border bg-card p-4">
 <h2 className="text-sm font-semibold">CV</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 {candidate.contact_released
 ? "Preview or download the CV from the contact block at the top of this page."
 : "The CV is released as soon as this candidate is published to you."}
 </p>
 </div>
 {candidate.contact_released && (
 <div className="rounded-xl border bg-card p-4">
 <CvDownloadAudit
 matchId={candidate.match_id}
 title="Who downloaded this CV"
 limit={15}
 />
 </div>
 )}
 </TabsContent>

 <TabsContent value="activity" className="mt-4 space-y-4">
 {(interviews.length > 0 || decisions.length > 0) && (
 <ActivitySection interviews={interviews} decisions={decisions} />
 )}
 <JourneySection matchId={candidate.match_id} />
 <AuditTrailSection candidate={candidate} />
 </TabsContent>
 </Tabs>


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
