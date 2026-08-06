import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { StructuredNotesPanel } from "@/components/admin/structured-notes-panel";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  advanceProcessing,
  applyReviewDecision,
  deleteCandidateMatch,
  getAdminMatch,
  markOcrDone,
  rescore,
  retryParse,
  retryHydration,
  retryEnrichment,
} from "@/lib/processing.functions";
import {
  getClientPreview,
  setMatchClientVisibility,
  getPositionActivity,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConfirmAction, ErrorState } from "@/components/ds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  FileText,
  Sparkles,
  ScanText,
  Gauge,
  ListChecks,
  History as HistoryIcon,
  ClipboardCheck,
  Eye,
  Activity as ActivityIcon,
  ExternalLink,
  Wrench,
  MoreHorizontal,
  Milestone,
  ClipboardList,
} from "lucide-react";
import { DownloadCvButton } from "@/components/download-cv-button";
import { ScoreExplainability } from "@/components/candidate/score-explainability";
import { ScoreStalenessChip, freshnessFromRow } from "@/components/admin/score-staleness-chip";
import { JourneyTimeline } from "@/components/candidate/journey-timeline";
import { getCandidateJourney } from "@/lib/journey.functions";
import { AdminDossier } from "@/components/candidate/admin-dossier";
import { EvidenceGraph } from "@/components/evidence/evidence-graph";
import { buildEvidenceChain } from "@/lib/evidence/evidence-graph";
import { listAdminEvidence } from "@/lib/evidence/evidence.functions";
import { EvidenceCompletenessGate } from "@/components/admin/evidence-completeness-gate";
import { ProcessState } from "@/components/ds/process-state";
import { candidateProcessStatus } from "@/lib/loading/process-catalogue";
import {
  approvePreflightBlock,
  explainApproveFailure,
  type ApproveFailure,
} from "@/lib/scoring/approve-failure";
import { CandidateHistoryTimeline } from "@/components/admin/candidate-history-timeline";
import { CandidateNextActionBar } from "@/components/admin/candidate-next-action-bar";
import { ContactStatusBadges } from "@/components/admin/contact-status-badges";

// Secondary tabs are code-split: first paint pays only for the profile view.
const TAB_MODULE = () => import("@/components/admin/candidate-detail/tabs");
const CvTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.CvTab })));
const EnrichmentTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.EnrichmentTab })));
const EvidenceTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.EvidenceTab })));
const ScoreTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.ScoreTab })));
const ScreeningTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.ScreeningTab })));
const HistoryTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.HistoryTab })));
const PreviewTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.PreviewTab })));
const ActivityAuditTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.ActivityAuditTab })));
const JourneyTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.JourneyTab })));

function TabFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-5 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <span className="sr-only">Loading panel…</span>
    </div>
  );
}




const searchSchema = z.object({
  /** Permalink target from the history timeline: `<source>:<row id>`. */
  event: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/admin/candidates/$id")({
  validateSearch: zodValidator(searchSchema),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-candidate", params.id],
      queryFn: () => getAdminMatch({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  head: () => ({
    meta: [
      { title: "Candidate workspace · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Candidate not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.candidates.$id.tsx"),
  component: CandidateWorkspace,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "dossier", label: "Intake & notes", icon: ClipboardList },
  { id: "journey", label: "Journey", icon: Milestone },
  { id: "cv", label: "CV & parsed", icon: FileText },
  { id: "enrichment", label: "Enrichment", icon: Sparkles },
  { id: "evidence", label: "Evidence", icon: ScanText },
  { id: "score", label: "Score", icon: Gauge },
  { id: "screening", label: "Screening", icon: ListChecks },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "preview", label: "Client preview", icon: Eye },
  { id: "activity", label: "Activity & audit", icon: ActivityIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATE_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  parsing: "bg-info/15 text-info dark:text-info",
  enriching: "bg-info/15 text-info dark:text-info",
  ready_to_score: "bg-info/15 text-info dark:text-info",
  scored: "bg-success/15 text-success dark:text-success",
  manual_review_required: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  ocr_required: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  failed: "bg-destructive/15 text-destructive",
  provider_blocked: "bg-destructive/15 text-destructive",
};

function CandidateWorkspace() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-candidate", id],
    queryFn: () => getAdminMatch({ data: { id } }),
  });

  const { event: focusEventId } = Route.useSearch();
  const [tab, setTab] = useState<TabId>(focusEventId ? "history" : "profile");
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return null;
  const { match, runs, decisions, jobs, evidence, cv, siblings } = data as Any;
  const m = match as Any;
  const cp = m.candidate_profiles as Any;
  const pos = m.positions as Any;
  const currentRun = runs[0] as Any | undefined;
  const currentResult = (currentRun?.result ?? null) as Any | null;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-candidate", id] });
    await router.invalidate();
  };

  const run = async (
    label: string,
    fn: () => Promise<Any>,
    opts?: { onError?: (err: Error) => void; onSuccess?: () => void },
  ) => {
    setBusy(label);
    try {
      const r = await fn();
      toast.success(
        `${label} → ${r?.state ?? r?.action ?? "done"}${r?.trace_id ? ` (${r.trace_id})` : ""}`,
      );
      opts?.onSuccess?.();
      await invalidate();
    } catch (e) {
      if (opts?.onError) opts.onError(e as Error);
      else toast.error(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
      <WorkspaceHeader
        m={m}
        cp={cp}
        pos={pos}
        currentRun={currentRun}
      />

      <CandidateNextActionBar matchId={id} onNavigateTab={(t) => setTab(t as TabId)} />

      {/* Mirrors the database's contact decision. Explains, never gates. */}
      <ContactStatusBadges
        organizationId={m.organization_id}
        candidateProfileId={cp?.id}
      />



      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <nav
            role="tablist"
            aria-label="Candidate sections"
            className="flex flex-wrap gap-1 border-b"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  data-qa-action={`candidate-tab-${t.id}`}
                  className={
                    "inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm transition " +
                    (active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <section>
            {tab === "profile" && (
              <ProfileTab cp={cp} pos={pos} m={m} siblings={siblings} evidence={evidence} />
            )}
            <Suspense fallback={<TabFallback />}>
              {tab === "dossier" && <AdminDossier matchId={id} />}
            {tab === "journey" && (
              <div className="space-y-4">
                <JourneyTab matchId={id} />
                <StructuredNotesPanel targetKind="candidate_match" targetId={id} />
              </div>
            )}
            {tab === "cv" && <CvTab cv={cv} matchId={id} cp={cp} insights={evidence?.extracted?.insights ?? null} />}
            {tab === "enrichment" && <EnrichmentTab cp={cp} evidence={evidence} />}
            {tab === "evidence" && (
              <EvidenceTab evidence={evidence} result={currentResult} matchId={id} />
            )}
            {tab === "score" && (
              <ScoreTab
                currentRun={currentRun}
                result={currentResult}
                runs={runs}
                decisions={decisions}
                evidence={evidence}
              />
            )}
            {tab === "screening" && (
              <ScreeningTab result={currentResult} evidence={evidence} />
            )}
            {tab === "history" && (
              <div className="space-y-4">
                <CandidateHistoryTimeline
                  matchId={id}
                  focusEventId={focusEventId || null}
                />
                <HistoryTab runs={runs} jobs={jobs} decisions={decisions} />
              </div>
            )}
            {tab === "preview" && <PreviewTab matchId={id} />}
            {tab === "activity" && (
              <ActivityAuditTab
                matchId={id}
                positionId={pos?.id}
                decisions={decisions}
              />
            )}
            </Suspense>
          </section>
        </div>

        <ActionRail
          m={m}
          currentRun={currentRun}
          busy={busy}
          onRun={run}
          onDone={invalidate}
          onSetTab={setTab}
        />

      </div>
    </main>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function WorkspaceHeader({
  m,
  cp,
  pos,
  currentRun,
}: {
  m: Any;
  cp: Any;
  pos: Any;
  currentRun?: Any;
}) {
  const stateTone =
    STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground";
  return (
    <header className="space-y-3">
      <Link
        to="/admin/publish"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Publish desk
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {cp?.full_name ?? "Unknown candidate"}
            </h1>
            {currentRun?.score != null && (
              <ScoreStalenessChip
                freshness={freshnessFromRow({
                  scored_at: currentRun.completed_at ?? null,
                  scored_input_hash: currentRun.input_hash ?? null,
                  scored_engine_version: currentRun.engine_version ?? null,
                  profile_updated_at: cp?.updated_at ?? null,
                  brief_updated_at: pos?.updated_at ?? null,
                })}
              />
            )}
            {currentRun?.score != null && (
              <Badge variant="secondary" className="tabular-nums">
                Score {Math.round(currentRun.score)}
                {currentRun.fit_label && (
                  <span className="ml-1 opacity-70">
                    · {String(currentRun.fit_label).replace(/_/g, " ")}
                  </span>
                )}
              </Badge>
            )}
            <Badge className={stateTone}>
              {m.processing_state.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">admin: {m.admin_status}</Badge>
            <Badge variant="outline">visibility: {m.client_visibility}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {cp?.email && <span>{cp.email}</span>}
            {cp?.email && pos?.title && <span>·</span>}
            <Link
              to="/admin/positions/$id"
              params={{ id: pos?.id ?? "" }}
              className="hover:underline"
            >
              {pos?.title ?? "—"}
            </Link>
            {pos?.organizations?.name && (
              <>
                <span>·</span>
                <Link
                  to="/admin/clients/$id"
                  params={{ id: pos?.organizations?.id ?? "" }}
                  className="hover:underline"
                >
                  {pos.organizations.name}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/candidates/$id/evidence" params={{ id: m.id }}>
              <ScanText className="mr-2 h-4 w-4" /> Evidence record
            </Link>
          </Button>
          <DownloadCvButton matchId={m.id} />
        </div>
      </div>
      {m.processing_error_message && (
        <Alert variant="destructive">
          <AlertTitle>{m.processing_error_code ?? "Processing error"}</AlertTitle>
          <AlertDescription>{m.processing_error_message}</AlertDescription>
        </Alert>
      )}
          {(() => {
        const status = candidateProcessStatus(String(m.processing_state));
        return status && status.phase !== "done" ? (
          <ProcessState compact status={status} />
        ) : null;
      })()}
    </header>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────
function ProfileTab({
  cp,
  pos,
  m,
  siblings,
  evidence,
}: {
  cp: Any;
  pos: Any;
  m: Any;
  siblings: Any[];
  evidence: Any;
}) {
  const insights = evidence?.extracted?.insights as Any | null;
  return (
    <div className="space-y-4">
      {insights && <InsightsBriefing insights={insights} />}
      <div className="grid gap-4 lg:grid-cols-2">

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Candidate profile</h2>
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
          <Row label="Headline" v={cp?.headline} />
          <Row label="Location" v={cp?.location} />
          <Row label="Timezone" v={cp?.timezone} />
          <Row label="Availability" v={cp?.availability} />
          <Row label="Experience" v={cp?.years_experience != null ? `${cp.years_experience} yrs` : null} />
          <Row label="Phone" v={cp?.phone} />
          <Row label="LinkedIn" v={cp?.linkedin_url && <a href={cp.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Profile ↗</a>} />
          <Row label="Work auth" v={typeof cp?.work_authorization === "string" ? cp.work_authorization : cp?.work_authorization ? JSON.stringify(cp.work_authorization) : null} />
          <Row label="Consent" v={cp?.consent ? "Given" : "Not recorded"} />
        </dl>
        {cp?.summary && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{cp.summary}</p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Submission &amp; position</h2>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            <Row label="Application" v={<span className="font-mono text-xs">{m.application_id?.slice(0, 8)}…</span>} />
            <Row label="Submitted" v={m.created_at ? new Date(m.created_at).toLocaleString() : null} />
            <Row label="Stage" v={(m.stage ?? "—").replace(/_/g, " ")} />
            <Row label="Position" v={<Link to="/admin/positions/$id" params={{ id: pos?.id ?? "" }} className="text-primary hover:underline">{pos?.title}</Link>} />
            <Row label="Position status" v={pos?.status} />
            <Row label="Client" v={pos?.organizations?.name} />
          </dl>
        </div>

        {siblings && siblings.length > 1 && (
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Other applications by this candidate</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {siblings.filter((s) => s.id !== m.id).map((s) => (
                <li key={s.id}>
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: s.id }}
                    className="text-primary hover:underline"
                  >
                    {s.position_title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function InsightsBriefing({ insights }: { insights: Any }) {
  const rec = String(insights?.overall_recommendation ?? "consider");
  const recTone =
    rec === "advance" ? "bg-success/15 text-success dark:text-success"
    : rec === "reject" ? "bg-destructive/15 text-destructive"
    : "bg-warning/15 text-warning-foreground dark:text-warning-foreground";
  const highlights: string[] = Array.isArray(insights?.highlights) ? insights.highlights : [];
  const strengths: Any[] = Array.isArray(insights?.strengths) ? insights.strengths : [];
  const concerns: Any[] = Array.isArray(insights?.concerns) ? insights.concerns : [];
  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Candidate briefing</h2>
        <Badge variant="secondary" className="capitalize">
          {String(insights?.seniority ?? "unknown")}
        </Badge>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${recTone}`}>
          {rec}
        </span>
        {typeof insights?.confidence === "number" && (
          <span className="text-xs text-muted-foreground">
            confidence {Math.round(insights.confidence * 100)}%
          </span>
        )}
      </div>
      {insights?.headline_suggested && (
        <p className="mt-2 text-sm font-medium text-foreground">{insights.headline_suggested}</p>
      )}
      {insights?.pitch_summary && (
        <div
          className={`mt-3 rounded-md border-l-4 p-3 text-sm leading-relaxed ${
            insights.pitch_tone === "sell"
              ? "border-success bg-success/10 text-foreground"
              : insights.pitch_tone === "cautious"
                ? "border-destructive bg-destructive/10 text-foreground"
                : "border-warning bg-warning/10 text-foreground"
          }`}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {insights.pitch_tone === "sell"
              ? "Recruiter pitch"
              : insights.pitch_tone === "cautious"
                ? "Honest read"
                : "Balanced view"}
          </div>
          {insights.pitch_summary}
        </div>
      )}
      {insights?.narrative && (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {insights.narrative}
        </div>
      )}
      {highlights.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Highlights
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </>
      )}
      {(strengths.length > 0 || concerns.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-background/60 p-3">
            <h4 className="text-xs font-semibold uppercase text-success dark:text-success">
              Why they fit
            </h4>
            <ul className="mt-2 space-y-2 text-sm">
              {strengths.length === 0 && <li className="text-muted-foreground">None surfaced.</li>}
              {strengths.map((s, i) => (
                <li key={i}>
                  <div className="font-medium">{s.title}</div>
                  {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
                  {s.cv_quote && (
                    <div className="mt-1 border-l-2 border-success/40 pl-2 text-xs italic text-muted-foreground">
                      "{s.cv_quote}"
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <h4 className="text-xs font-semibold uppercase text-destructive">
              Where they may fall short
            </h4>
            <ul className="mt-2 space-y-2 text-sm">
              {concerns.length === 0 && <li className="text-muted-foreground">None flagged.</li>}
              {concerns.map((c, i) => (
                <li key={i}>
                  <div className="font-medium">{c.title}</div>
                  {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


function ActionRail({
  m,
  currentRun,
  busy,
  onRun,
  onDone,
  onSetTab,
}: {
  m: Any;
  currentRun?: Any;
  busy: string | null;
  onRun: (
    label: string,
    fn: () => Promise<Any>,
    opts?: { onError?: (err: Error) => void; onSuccess?: () => void },
  ) => Promise<void>;
  onDone: () => Promise<void>;
  onSetTab: (t: Any) => void;
}) {
  const [reason, setReason] = useState("");
  const [approveFailure, setApproveFailure] = useState<ApproveFailure | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [override, setOverride] = useState("");
  const setVisFn = useServerFn(setMatchClientVisibility);

  const publish = useMutation({
    mutationFn: (visibility: "visible" | "hidden") =>
      setVisFn({ data: { match_id: m.id, visibility } }),
    onSuccess: async (r) => {
      toast.success(`Visibility updated · ${r.trace_id ?? ""}`);
      await onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { confirm, confirmDialog } = useConfirmAction();
  const scored = m.processing_state === "scored";
  const isPublished = m.client_visibility === "visible";
  const approved = m.admin_status === "approved";
  const needsRepair =
    m.processing_state === "failed" ||
    m.processing_state === "provider_blocked" ||
    m.processing_state === "manual_review_required" ||
    m.processing_state === "ocr_required";

  // Approve safety: block doomed requests before they are sent, and never let a
  // non-retryable failure be clicked again.
  const preflightBlock = approvePreflightBlock(m.canonical_state);
  const approveBlocked = !!preflightBlock || approveFailure?.retryable === false;
  const runApprove = () => {
    setApproveFailure(null);
    return onRun(
      "approve",
      () =>
        applyReviewDecision({
          data: { match_id: m.id, action: "approve_for_client", reason },
        }),
      {
        onSuccess: () => setApproveFailure(null),
        onError: (err) => {
          const failure = explainApproveFailure(err.message);
          setApproveFailure(failure);
          toast.error(`${failure.title} — ${failure.detail}`);
        },
      },
    );
  };

  // Context-aware primary action — one at a time, following readiness order.
  let primary: { label: string; qa: string; onClick: () => void; disabled?: boolean };
  if (needsRepair) {
    primary = {
      label: "Review evidence",
      qa: "primary-review-evidence",
      onClick: () => onSetTab("evidence"),
    };
  } else if (scored && !approved) {
    primary = {
      label: approveFailure?.retryable ? "Retry approve score" : "Approve score",
      qa: "primary-approve-score",
      disabled: !!busy || approveBlocked,
      onClick: runApprove,
    };
  } else if (approved && !isPublished) {
    primary = {
      label: "Preview as client",
      qa: "primary-preview-client",
      onClick: () => onSetTab("preview"),
    };
  } else if (approved && isPublished) {
    primary = {
      label: "View client preview",
      qa: "primary-view-preview",
      onClick: () => onSetTab("preview"),
    };
  } else {
    primary = {
      label: "Review evidence",
      qa: "primary-review-evidence",
      onClick: () => onSetTab("evidence"),
    };
  }

  // Publish secondary is shown only when scored & approved.
  const canPublish = scored && approved && !!m.current_score_run_id;

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {confirmDialog}
      {/* Context-aware primary action bar */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Next step</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Actions follow readiness: review → approve → preview → publish.
        </p>
        {scored && !approved && preflightBlock && (
          <Alert variant="destructive" className="mt-3" data-qa="approve-preflight-block">
            <AlertTitle className="text-xs">Approval unavailable</AlertTitle>
            <AlertDescription className="text-xs">{preflightBlock}</AlertDescription>
          </Alert>
        )}
        {approveFailure && (
          <Alert variant="destructive" className="mt-3" data-qa="approve-failure">
            <AlertTitle className="text-xs">{approveFailure.title}</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>{approveFailure.detail}</p>
              {approveFailure.nextStep && (
                <p className="font-medium">Next: {approveFailure.nextStep}</p>
              )}
              <p className="font-mono text-[10px] opacity-70 break-all">
                {approveFailure.raw}
              </p>
              {!approveFailure.retryable && (
                <p className="opacity-80">
                  Retrying will fail the same way — resolve the cause first.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="mt-3 flex items-stretch gap-2">
          <Button
            className="flex-1"
            disabled={primary.disabled}
            onClick={primary.onClick}
            data-qa-action={primary.qa}
          >
            {busy === "approve" ? "Approving…" : primary.label}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="More actions"
                data-qa-action="candidate-overflow-menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Repair &amp; processing</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry parse", () => retryParse({ data: { match_id: m.id } }))
                }
                data-qa-action="overflow-retry-parse"
              >
                Retry parse
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy || m.processing_state !== "ocr_required"}
                onSelect={() => onSetTab("cv")}
                data-qa-action="overflow-run-ocr"
              >
                Run OCR…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry hydration", () =>
                    retryHydration({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-retry-hydration"
              >
                Retry hydration
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry enrichment", () =>
                    retryEnrichment({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-retry-enrichment"
              >
                Retry enrichment
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("rescore", () => rescore({ data: { match_id: m.id } }))
                }
                data-qa-action="overflow-rescore"
              >
                Rescore
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("advance", () =>
                    advanceProcessing({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-advance"
              >
                Advance processing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Review</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("hold", () =>
                    applyReviewDecision({
                      data: { match_id: m.id, action: "hold", reason },
                    }),
                  )
                }
                data-qa-action="overflow-hold"
              >
                Hold
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={(event) => {
                  event.preventDefault();
                  void (async () => {
                  const c = await confirm({
                    title: "Delete candidate from this position",
                    object: (m.full_name as string | null) ?? "This candidate",
                    description:
                      "The candidate is removed from the client view and archived on this position.",
                    impact: [
                      "The client immediately loses access to this profile",
                      "Scoring runs and evidence stay on the audit trail",
                      "You are returned to the candidate list",
                    ],
                    reason: {
                      label: "Reason for deletion",
                      required: true,
                      placeholder: "e.g. duplicate application",
                    },
                    typedConfirmation: "DELETE",
                    confirmLabel: "Delete candidate",
                    tone: "destructive",
                  });
                  if (!c.confirmed) return;
                  onRun("delete", async () => {
                    const r = await deleteCandidateMatch({
                      data: { match_id: m.id, reason: c.reason || reason },
                    });
                    // Navigate back to the admin list after delete
                    setTimeout(() => {
                      window.location.href = "/admin/candidates";
                    }, 400);
                    return r;
                  });
                  })();
                }}
                data-qa-action="overflow-delete"
                className="text-destructive"
              >
                Delete candidate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Publish button surfaces only when it is the next real step */}
        {canPublish && !isPublished && (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            disabled={publish.isPending}
            onClick={() => publish.mutate("visible")}
            data-qa-action="publish-to-client"
          >
            Publish candidate
          </Button>
        )}
        {isPublished && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            disabled={publish.isPending}
            onClick={() => publish.mutate("hidden")}
            data-qa-action="unpublish-from-client"
          >
            Unpublish
          </Button>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline">processing: {m.processing_state.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">review: {m.admin_status}</Badge>
          <Badge variant={isPublished ? "default" : "outline"}>
            {isPublished ? "Published" : "Not published"}
          </Badge>
        </div>
      </div>

      {/* Review notes + manual override — kept persistent (audit-visible input) */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Review notes</h2>
        <Label htmlFor="reason" className="mt-2 text-xs">
          Reason (attaches to the next review decision)
        </Label>
        <Textarea
          id="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Note for the audit trail…"
        />

        <Label htmlFor="override" className="mt-3 block text-xs">
          Manual override score
        </Label>
        <div className="flex gap-2">
          <Input
            id="override"
            type="number"
            min={0}
            max={100}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!!busy || override === ""}
            onClick={() =>
              onRun("override", () =>
                applyReviewDecision({
                  data: {
                    match_id: m.id,
                    action: "manual_override",
                    approved_score: Number(override),
                    reason,
                  },
                }),
              )
            }
          >
            Save
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Recorded as a decision — the underlying score run stays immutable.
        </p>
      </div>

      {/* Inline OCR entry — only when the pipeline is blocked on it */}
      {m.processing_state === "ocr_required" && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Attach OCR text</h2>
          <Label htmlFor="ocr" className="mt-2 text-xs">
            Paste OCR output (min 60 chars)
          </Label>
          <Textarea
            id="ocr"
            rows={3}
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
          />
          <Button
            className="mt-2 w-full"
            size="sm"
            disabled={!!busy || ocrText.length < 60}
            onClick={() =>
              onRun("attach OCR", () =>
                markOcrDone({ data: { match_id: m.id, ocr_text: ocrText } }),
              )
            }
          >
            Attach OCR &amp; continue
          </Button>
        </div>
      )}

      {currentRun && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            Every action is auditable and safe to retry.
          </div>
        </div>
      )}

      {isPublished && (
        <div className="rounded-lg border bg-success/10 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-success dark:text-success">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Live for client
          </div>
        </div>
      )}
    </aside>
  );
}


