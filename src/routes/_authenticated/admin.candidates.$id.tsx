import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import { StructuredNotesPanel } from "@/components/admin/structured-notes-panel";
import { ComponentErrorBoundary } from "@/components/ds/component-error-boundary";
import { normalizeFocusEventId } from "@/lib/candidate-history";
import { createFileRoute, notFound, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { getAdminMatch, getMatchHeavyDetail } from "@/lib/processing.functions";
import {
  User,
  FileText,
  Sparkles,
  ScanText,
  Gauge,
  ListChecks,
  History as HistoryIcon,
  Eye,
  Activity as ActivityIcon,
  Milestone,
  ClipboardList,
} from "lucide-react";
import { AdminDossier } from "@/components/candidate/admin-dossier";
import { CandidateHistoryTimeline } from "@/components/admin/candidate-history-timeline";
import { CandidateNextActionBar } from "@/components/admin/candidate-next-action-bar";
import { ContactStatusBadges } from "@/components/admin/contact-status-badges";
import { WorkspaceHeader } from "@/components/admin/candidate-detail/workspace-header";
import { ProfileTab } from "@/components/admin/candidate-detail/profile-tab";
import { ActionRail } from "@/components/admin/candidate-detail/action-rail";

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
const TAB_IDS = TABS.map((t) => t.id) as unknown as [TabId, ...TabId[]];

/** Tabs that read score-run results, raw CV text or the signed preview URL. */
const HEAVY_TABS = new Set<TabId>([
  "cv",
  "enrichment",
  "evidence",
  "score",
  "screening",
  "history",
]);

const searchSchema = z.object({
  /** Deep-linkable tab so a shared URL opens the same panel. */
  tab: fallback(z.enum(TAB_IDS), "profile").default("profile"),
  /** Permalink target from the history timeline: `<source>:<row id>`. */
  event: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/admin/candidates/$id")({
  validateSearch: zodValidator(searchSchema),
  loader: async ({ context, params }) => {
    // heavy:false — the profile tab never needs run results or raw CV text.
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-candidate", params.id, "light"],
      queryFn: () => getAdminMatch({ data: { id: params.id, heavy: false } }),
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

function CandidateWorkspace() {
  const { id } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-candidate", id, "light"],
    queryFn: () => getAdminMatch({ data: { id, heavy: false } }),
  });

  const { event: rawEvent, tab: urlTab } = Route.useSearch();
  // Some links produce `?tab=profile&event=` with no value; a blank param means
  // "no focused event" and must never be treated as an event id.
  const focusEventId = normalizeFocusEventId(rawEvent);
  // The tab lives in the URL so deep links and back/forward keep working.
  const tab: TabId = focusEventId && urlTab === "profile" ? "history" : urlTab;
  const setTab = (next: TabId) =>
    void navigate({ search: (prev: { tab: TabId; event: string }) => ({ ...prev, tab: next }), replace: true });
  const [busy, setBusy] = useState<string | null>(null);

  // Only fetched once a tab that needs the large payloads is open.
  const heavyQuery = useQuery({
    queryKey: ["admin-candidate", id, "heavy"],
    queryFn: () => getMatchHeavyDetail({ data: { id } }),
    enabled: HEAVY_TABS.has(tab),
    staleTime: 30_000,
  });

  if (!data) return null;
  const { match, runs: lightRuns, decisions, jobs, evidence: lightEvidence, siblings } =
    data as Any;
  const heavy = heavyQuery.data as Any | undefined;
  const runs = (heavy?.runs ?? lightRuns) as Any[];
  const evidence = (heavy?.evidence ?? lightEvidence) as Any;
  const cv = (heavy?.cv ?? null) as Any;
  const m = match as Any;
  const cp = m.candidate_profiles as Any;
  useDetailCrumb(cp?.full_name ?? null);
  const pos = m.positions as Any;
  const currentRun = runs[0] as Any | undefined;
  const currentResult = (currentRun?.result ?? null) as Any | null;
  const heavyPending = HEAVY_TABS.has(tab) && heavyQuery.isPending;

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
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
      <WorkspaceHeader m={m} cp={cp} pos={pos} currentRun={currentRun} />

      <ComponentErrorBoundary boundary="admin.candidate.next-action" tone="admin">
        <CandidateNextActionBar matchId={id} onNavigateTab={(t) => setTab(t as TabId)} />
      </ComponentErrorBoundary>

      {/* Mirrors the database's contact decision. Explains, never gates. */}
      <ContactStatusBadges organizationId={m.organization_id} candidateProfileId={cp?.id} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <nav
            role="tablist"
            aria-label="Candidate sections"
            className="flex gap-1 overflow-x-auto border-b pb-px sm:flex-wrap"
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
                    "inline-flex flex-shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm transition " +
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
            {heavyQuery.isError && HEAVY_TABS.has(tab) && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
              >
                <p className="font-medium text-destructive">This panel could not load.</p>
                <p className="mt-1 text-muted-foreground">
                  {(heavyQuery.error as Error).message}
                </p>
                <button
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => void heavyQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            )}
            {heavyPending ? (
              <TabFallback />
            ) : (
              <Suspense fallback={<TabFallback />}>
                {tab === "dossier" && <AdminDossier matchId={id} />}
                {tab === "journey" && (
                  <div className="space-y-4">
                    <JourneyTab matchId={id} />
                    <StructuredNotesPanel targetKind="candidate_match" targetId={id} />
                  </div>
                )}
                {tab === "cv" && (
                  <CvTab
                    cv={cv}
                    matchId={id}
                    cp={cp}
                    insights={evidence?.extracted?.insights ?? null}
                  />
                )}
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
                {tab === "screening" && <ScreeningTab result={currentResult} evidence={evidence} />}
                {tab === "history" && (
                  <div className="space-y-4">
                    <ComponentErrorBoundary boundary="admin.candidate.history-timeline" tone="admin">
                      <CandidateHistoryTimeline matchId={id} focusEventId={focusEventId} />
                    </ComponentErrorBoundary>
                    <ComponentErrorBoundary boundary="admin.candidate.history-runs" tone="admin">
                      <HistoryTab runs={runs} jobs={jobs} decisions={decisions} />
                    </ComponentErrorBoundary>
                  </div>
                )}
                {tab === "preview" && <PreviewTab matchId={id} match={m} />}
                {tab === "activity" && (
                  <ComponentErrorBoundary boundary="admin.candidate.activity" tone="admin">
                    <ActivityAuditTab matchId={id} positionId={pos?.id} decisions={decisions} />
                  </ComponentErrorBoundary>
                )}
              </Suspense>
            )}
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
    </div>
  );
}
