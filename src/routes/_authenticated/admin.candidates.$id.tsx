import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useMemo, useState } from "react";
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
import { useConfirmAction } from "@/components/ds";
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
import { JourneyTimeline } from "@/components/candidate/journey-timeline";
import { getCandidateJourney } from "@/lib/journey.functions";
import { AdminDossier } from "@/components/candidate/admin-dossier";
import {
  approvePreflightBlock,
  explainApproveFailure,
  type ApproveFailure,
} from "@/lib/scoring/approve-failure";



export const Route = createFileRoute("/_authenticated/admin/candidates/$id")({
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

  const [tab, setTab] = useState<TabId>("profile");
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
            {tab === "dossier" && <AdminDossier matchId={id} />}
            {tab === "journey" && <JourneyTab matchId={id} />}
            {tab === "cv" && <CvTab cv={cv} matchId={id} cp={cp} insights={evidence?.extracted?.insights ?? null} />}
            {tab === "enrichment" && <EnrichmentTab cp={cp} evidence={evidence} />}
            {tab === "evidence" && (
              <EvidenceTab evidence={evidence} result={currentResult} />
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
              <HistoryTab runs={runs} jobs={jobs} decisions={decisions} />
            )}
            {tab === "preview" && <PreviewTab matchId={id} />}
            {tab === "activity" && (
              <ActivityAuditTab
                matchId={id}
                positionId={pos?.id}
                decisions={decisions}
              />
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


function safeNode(v: unknown): React.ReactNode {
  if (v == null || v === "") return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (React.isValidElement(v)) return v;
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : null)).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return null;
    const compact = keys
      .map((k) => {
        const val = (v as Record<string, unknown>)[k];
        if (val == null || val === "") return null;
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return `${k}: ${val}`;
        return null;
      })
      .filter(Boolean);
    return compact.length ? compact.join(" · ") : null;
  }
  return null;
}

function toReqText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "[object Object]") return "—";
    return t;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toReqText).filter((s) => s && s !== "—").join(", ") || "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const cand = o.text ?? o.label ?? o.name ?? o.requirement ?? o.requirement_text ?? o.title;
    if (typeof cand === "string" && cand.trim() && cand.trim() !== "[object Object]") return cand.trim();
    return "—";
  }
  return "—";
}

function cleanLine(s: string): string {
  return s.replace(/\[object Object\]/g, "requirement").trim();
}


function Row({ label, v }: { label: string; v: React.ReactNode }) {
  const safe = safeNode(v);
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{safe ?? <span className="text-muted-foreground">—</span>}</dd>
    </>
  );
}

// ── CV & parsed ────────────────────────────────────────────────────────────
function CvTab({ cv, matchId, cp, insights }: { cv: Any; matchId: string; cp: Any; insights: Any }) {
  if (!cv)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No CV on file for this candidate.
      </div>
    );
  const skills: string[] = Array.isArray(cp?.skills) ? cp.skills : [];
  const experience: Any[] = Array.isArray(cp?.experience) ? cp.experience : [];
  const education: Any[] = Array.isArray(cp?.education) ? cp.education : [];
  const languages: Any[] = Array.isArray(cp?.languages) ? cp.languages : [];
  const currentRole = experience[0];
  const pitchTone = String(insights?.pitch_tone ?? "balanced");
  return (
    <div className="space-y-4">
      {insights?.pitch_summary && (
        <div
          className={`rounded-lg border-l-4 p-4 text-sm leading-relaxed ${
            pitchTone === "sell"
              ? "border-success bg-success/10"
              : pitchTone === "cautious"
                ? "border-destructive bg-destructive/10"
                : "border-warning bg-warning/10"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>
              {pitchTone === "sell"
                ? "Recruiter pitch"
                : pitchTone === "cautious"
                  ? "Honest read"
                  : "Balanced view"}
            </span>
            {insights?.headline_suggested && (
              <span className="normal-case text-muted-foreground">· {insights.headline_suggested}</span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-foreground">{insights.pitch_summary}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Snapshot</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Seniority</dt>
                <dd className="capitalize">{insights?.seniority ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current role</dt>
                <dd className="truncate">
                  {currentRole
                    ? `${currentRole.title ?? currentRole.role ?? "—"} · ${currentRole.company ?? "—"}`
                    : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Languages
                </dt>
                <dd>
                  {languages.length === 0
                    ? "—"
                    : languages
                        .map((l) => (typeof l === "string" ? l : `${l.language ?? "?"}${l.level ? ` (${l.level})` : ""}`))
                        .join(" · ")}
                </dd>
              </div>
            </dl>

            {skills.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Top skills
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {skills.slice(0, 20).map((s, i) => (
                    <Badge key={i} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {experience.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Experience
                </div>
                <ul className="mt-2 space-y-2 text-sm">
                  {experience.slice(0, 5).map((e, i) => (
                    <li key={i} className="border-l-2 border-primary/40 pl-3">
                      <div className="font-medium">
                        {e.title ?? e.role ?? "Role"}{" "}
                        <span className="text-muted-foreground">· {e.company ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.start_date ?? e.start ?? ""} — {e.end_date ?? e.end ?? "present"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {education.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Education
                </div>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {education.slice(0, 4).map((e, i) => (
                    <li key={i}>
                      {e.degree ?? "Degree"} · {e.institution ?? e.school ?? "—"}{" "}
                      <span className="text-xs text-muted-foreground">
                        {e.start_date ?? ""}—{e.end_date ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Extracted text</h2>
              <div className="flex items-center gap-2">
                {cv.signed_url && (
                  <a
                    href={cv.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open original <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <DownloadCvButton matchId={matchId} mode="preview" />
                <DownloadCvButton matchId={matchId} />

              </div>
            </div>
            <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">
              {cv.extracted_text?.trim() || "(no text extracted)"}
            </pre>
          </div>
        </div>

        <aside className="rounded-lg border bg-card p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            File details
          </h3>
          <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs">
            <Row label="Filename" v={cv.filename} />
            <Row label="Type" v={cv.mime_type} />
            <Row label="Size" v={`${(Number(cv.size ?? 0) / 1024).toFixed(0)} KB`} />
            <Row label="OCR used" v={cv.ocr_used ? "Yes" : "No"} />
            <Row label="Attempts" v={cv.extraction_attempts} />
            <Row label="Extracted" v={cv.extraction_completed_at ? new Date(cv.extraction_completed_at).toLocaleString() : "—"} />
          </dl>
        </aside>
      </div>
    </div>
  );
}

// ── Enrichment ─────────────────────────────────────────────────────────────
function EnrichmentTab({ cp, evidence }: { cp: Any; evidence: Any }) {
  const skills: string[] = Array.isArray(cp?.skills) ? cp.skills : [];
  const experience: Any[] = Array.isArray(cp?.experience) ? cp.experience : [];
  const education: Any[] = Array.isArray(cp?.education) ? cp.education : [];
  const languages: Any[] = Array.isArray(cp?.languages) ? cp.languages : [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Skills</h2>
        {skills.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None extracted.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s, i) => (
              <Badge key={i} variant="secondary">{s}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Languages</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {languages.length === 0 && <li className="text-muted-foreground">None extracted.</li>}
          {languages.map((l, i) => (
            <li key={i}>{typeof l === "string" ? l : `${l.language ?? "?"} · ${l.level ?? ""}`.trim()}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold">Experience</h2>
        {experience.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No experience parsed.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {experience.map((e, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="font-medium">
                  {e.title ?? e.role ?? "Role"} <span className="text-muted-foreground">· {e.company ?? "—"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {e.start_date ?? e.start ?? ""} — {e.end_date ?? e.end ?? "present"}
                </div>
                {e.description && <p className="mt-1 whitespace-pre-wrap text-xs">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold">Education</h2>
        {education.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No education parsed.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {education.map((e, i) => (
              <li key={i}>
                {e.degree ?? "Degree"} · {e.institution ?? e.school ?? "—"}{" "}
                <span className="text-xs text-muted-foreground">
                  {e.start_date ?? ""}—{e.end_date ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {evidence && (
        <div className="rounded-lg border bg-muted/30 p-4 lg:col-span-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Enrichment snapshot · engine {evidence.engine_version}</span>
            <span>{new Date(evidence.created_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Evidence ───────────────────────────────────────────────────────────────
function EvidenceTab({ evidence, result }: { evidence: Any; result: Any }) {
  const items = result?.requirement_assessment ?? result?.evidence ?? [];
  const llmVerdicts: Any[] = Array.isArray(evidence?.extracted?.insights?.requirement_verdicts)
    ? evidence.extracted.insights.requirement_verdicts
    : [];
  const contradictions = result?.contradiction_status && result.contradiction_status !== "none"
    ? result.contradiction_status
    : null;
  return (
    <div className="space-y-4">
      {contradictions && (
        <Alert variant="destructive">
          <AlertTitle>Contradiction detected</AlertTitle>
          <AlertDescription>
            {String(contradictions).replace(/_/g, " ")} — review evidence before publishing.
          </AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No evidence yet. Run the scoring pipeline to generate evidence.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r: Any, i: number) => (
            <li key={r.id ?? i} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">
                    {r.required && <span className="text-destructive">* </span>}
                    {toReqText(r.text ?? r.requirement_text ?? r.label ?? r.name)}
                  </div>
                  {r.matched_terms?.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      matched: {r.matched_terms.join(", ")}
                    </div>
                  )}
                </div>
                {r.status && (
                  <Badge
                    variant={
                      r.status === "met"
                        ? "default"
                        : r.status === "partial"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {r.status}
                  </Badge>
                )}
              </div>
              {(r.evidence ?? []).length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(r.evidence as Any[]).map((e, j) => (
                    <li key={j}>
                      "…{e.snippet}…"{" "}
                      <code className="opacity-60">{e.location ?? e.source ?? ""}</code>
                    </li>
                  ))}
                </ul>
              )}
              {r.snippet && (
                <p className="mt-2 text-xs text-muted-foreground">
                  "…{r.snippet}…"
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {llmVerdicts.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">AI evidence review</h3>
            <span className="text-xs text-muted-foreground">
              Per-requirement verdicts grounded in verbatim CV quotes.
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {llmVerdicts.map((v, i) => {
              const tone =
                v.verdict === "met" ? "default"
                : v.verdict === "partial" ? "secondary"
                : v.verdict === "contradicted" ? "destructive"
                : "outline";
              return (
                <li key={i} className="rounded-md border bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      {v.required && <span className="text-destructive">* </span>}
                      <span className="font-medium">{toReqText(v.requirement_text)}</span>
                    </div>
                    <Badge variant={tone as Any} className="capitalize">{v.verdict}</Badge>
                  </div>
                  {v.rationale && (
                    <div className="mt-1 text-xs text-muted-foreground">{v.rationale}</div>
                  )}
                  {v.cv_quote && (
                    <div className="mt-1 border-l-2 border-primary/30 pl-2 text-xs italic text-muted-foreground">
                      "{v.cv_quote}"
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {evidence?.raw_text_sample && (
        <details className="rounded-lg border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium">Raw text sample</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
            {evidence.raw_text_sample}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Score ──────────────────────────────────────────────────────────────────
function ScoreTab({
  currentRun,
  result,
  runs,
  decisions,
  evidence,
}: {
  currentRun: Any;
  result: Any;
  runs?: Any[];
  decisions?: Any[];
  evidence?: Any;
}) {
  if (!currentRun)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No score run yet.
      </div>
    );
  const catBreakdown = result?.category_breakdown ?? {};
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Fit score</h2>
          <span className="text-xs text-muted-foreground">
            engine {currentRun.engine_version} · {currentRun.completed_at ? new Date(currentRun.completed_at).toLocaleString() : "—"}
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-4">
          <div className="text-5xl font-semibold tabular-nums">
            {Math.round(currentRun.score ?? 0)}
          </div>
          <Badge variant="secondary">{(currentRun.fit_label ?? "").replace(/_/g, " ")}</Badge>
          <span className="text-sm text-muted-foreground">
            confidence {Math.round((currentRun.confidence ?? 0) * 100)}%
          </span>
        </div>
        {currentRun.explanation && (
          <p className="mt-3 whitespace-pre-wrap text-sm">{cleanLine(String(currentRun.explanation))}</p>
        )}

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category breakdown
        </h3>
        <div className="mt-2 space-y-2">
          <Bar label="Must-have coverage" value={currentRun.must_have_coverage} />
          <Bar label="Preferred coverage" value={currentRun.preferred_coverage} />
          <Bar label="Screening alignment" value={catBreakdown.screening_alignment} />
        </div>

        {(result?.strengths?.length > 0 || result?.concerns?.length > 0) && (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-background/50 p-3">
              <h4 className="text-xs font-semibold uppercase text-success dark:text-success">Strengths</h4>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {(result?.strengths ?? []).map((s: string, i: number) => (
                  <li key={i}>{cleanLine(String(s))}</li>
                ))}
                {(result?.strengths ?? []).length === 0 && (
                  <li className="list-none text-muted-foreground">None surfaced.</li>
                )}
              </ul>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <h4 className="text-xs font-semibold uppercase text-destructive">Concerns</h4>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {(result?.concerns ?? []).map((s: string, i: number) => (
                  <li key={i}>{cleanLine(String(s))}</li>
                ))}
                {(result?.concerns ?? []).length === 0 && (
                  <li className="list-none text-muted-foreground">None flagged.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      <aside className="rounded-lg border bg-card p-4 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Provenance
        </h3>
        <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs">
          <Row label="Engine" v={currentRun.engine_version} />
          <Row label="Input hash" v={<span className="font-mono">{currentRun.input_hash?.slice(0, 12)}…</span>} />
          <Row label="Status" v={currentRun.status} />
          <Row label="Contradiction" v={(currentRun.contradiction_status ?? "none").replace(/_/g, " ")} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Score runs are immutable. Rescoring writes a new row and keeps every prior score.
        </p>
      </aside>

      <div className="lg:col-span-2">
        <ScoreExplainability
          runs={runs ?? []}
          decisions={decisions ?? []}
          result={result}
          evidence={evidence}
        />
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value?: number | null }) {
  const pct =
    value == null ? null : Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {pct == null ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

// ── Screening ──────────────────────────────────────────────────────────────
function ScreeningTab({ result, evidence }: { result: Any; evidence: Any }) {
  const items = (result?.screening_evidence ?? []) as Any[];
  const llmAnalysis: Any[] = Array.isArray(evidence?.extracted?.insights?.screening_analysis)
    ? evidence.extracted.insights.screening_analysis
    : [];
  const rawAnswers: Any[] = Array.isArray(evidence?.screening_normalized?.answers)
    ? evidence.screening_normalized.answers
    : [];

  // Build a merged view keyed by question_id when possible.
  const byId = new Map<string, Any>();
  for (const a of rawAnswers) if (a?.question_id) byId.set(String(a.question_id), a);
  const analysisById = new Map<string, Any>();
  for (const a of llmAnalysis) if (a?.question_id) analysisById.set(String(a.question_id), a);

  const hasAnything = items.length > 0 || rawAnswers.length > 0 || llmAnalysis.length > 0;
  if (!hasAnything) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No screening answers on file.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((s, i) => {
            const llm = analysisById.get(String(s.question_id ?? ""));
            return (
              <li key={i} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.question}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {s.normalized_value || s.answer || "—"}
                    </div>
                  </div>
                  <Badge
                    variant={
                      s.aligned === "aligned"
                        ? "default"
                        : s.aligned === "misaligned"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {s.aligned ?? "n/a"}
                  </Badge>
                </div>
                {llm && (
                  <div className="mt-2 rounded-md border bg-background/60 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                        CV supports:
                      </span>
                      <Badge
                        variant={
                          llm.cv_supports === "yes" ? "default"
                          : llm.cv_supports === "no" ? "destructive"
                          : "outline"
                        }
                      >
                        {llm.cv_supports}
                      </Badge>
                    </div>
                    {llm.note && <p className="mt-1 text-muted-foreground">{llm.note}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length === 0 && rawAnswers.length > 0 && (
        <ul className="space-y-2">
          {rawAnswers.map((a, i) => {
            const llm = analysisById.get(String(a.question_id ?? ""));
            const val = a?.value == null ? "—"
              : typeof a.value === "string" ? a.value
              : JSON.stringify(a.value);
            return (
              <li key={i} className="rounded-lg border bg-card p-4">
                <div className="text-sm font-medium">{a.question}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{val}</div>
                {llm && (
                  <div className="mt-2 rounded-md border bg-background/60 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                        CV supports:
                      </span>
                      <Badge
                        variant={
                          llm.cv_supports === "yes" ? "default"
                          : llm.cv_supports === "no" ? "destructive"
                          : "outline"
                        }
                      >
                        {llm.cv_supports}
                      </Badge>
                    </div>
                    {llm.note && <p className="mt-1 text-muted-foreground">{llm.note}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length === 0 && rawAnswers.length === 0 && llmAnalysis.length > 0 && (
        <ul className="space-y-2">
          {llmAnalysis.map((llm, i) => (
            <li key={i} className="rounded-lg border bg-card p-4 text-sm">
              <div className="font-medium">{llm.question}</div>
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{llm.candidate_answer || "—"}</div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">CV supports:</span>
                <Badge
                  variant={
                    llm.cv_supports === "yes" ? "default"
                    : llm.cv_supports === "no" ? "destructive"
                    : "outline"
                  }
                >
                  {llm.cv_supports}
                </Badge>
              </div>
              {llm.note && <p className="mt-1 text-xs text-muted-foreground">{llm.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Silence unused-var warnings */}
      <span className="hidden">{byId.size}</span>
    </div>
  );
}

// ── History ────────────────────────────────────────────────────────────────
function HistoryTab({
  runs,
  jobs,
  decisions,
}: {
  runs: Any[];
  jobs: Any[];
  decisions: Any[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Score history</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {runs.length === 0 && <li className="text-muted-foreground">No runs.</li>}
          {runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-b py-1 last:border-0">
              <span className="text-xs">
                {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}{" "}
                <code className="opacity-60">{r.engine_version}</code>{" "}
                <span className="ml-1 text-muted-foreground">{r.status}</span>
              </span>
              <span className="tabular-nums">
                {r.score != null ? Math.round(r.score) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Processing history</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {jobs.length === 0 && <li className="text-muted-foreground">No jobs.</li>}
          {jobs.map((j) => (
            <li key={j.id} className="border-b py-1 text-xs last:border-0">
              <div className="flex items-center justify-between">
                <span>
                  <strong className="font-medium">{j.job_type}</strong> ·{" "}
                  <span
                    className={
                      j.status === "failed"
                        ? "text-destructive"
                        : j.status === "completed"
                          ? "text-success dark:text-success"
                          : "text-muted-foreground"
                    }
                  >
                    {j.status}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {j.created_at ? new Date(j.created_at).toLocaleString() : ""}
                </span>
              </div>
              {j.error_message && (
                <div className="mt-0.5 text-destructive">{j.error_code}: {j.error_message}</div>
              )}
              {j.trace_id && (
                <div className="font-mono text-[10px] text-muted-foreground">{j.trace_id}</div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold">Decisions</h2>
        {decisions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No decisions recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {decisions.map((d) => (
              <li key={d.id} className="border-b py-1 text-xs last:border-0">
                <span className="text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}{" "}
                </span>
                · <strong>{d.decision_type}</strong>
                {d.approved_score != null && (
                  <span className="tabular-nums"> @ {d.approved_score}</span>
                )}
                {d.reason && <> — {d.reason}</>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Client preview ─────────────────────────────────────────────────────────
function PreviewTab({ matchId }: { matchId: string }) {
  const previewFn = useServerFn(getClientPreview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-preview", matchId],
    queryFn: () => previewFn({ data: { match_id: matchId } }),
  });
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading preview…</div>;
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>Preview failed: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  if (!data)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No client-visible data yet. Approve for client to populate the client view.
      </div>
    );
  const dto = data as Any;
  return (
    <div className="rounded-lg border-2 border-dashed bg-background p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        Client view — exactly what the client will see
      </div>
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-lg font-semibold">{dto.full_name ?? dto.name ?? "Candidate"}</h3>
            <div className="text-sm text-muted-foreground">
              {dto.headline ?? ""}{dto.location ? ` · ${dto.location}` : ""}
            </div>
          </div>
          {dto.score != null && (
            <Badge variant="secondary" className="tabular-nums">Fit {Math.round(dto.score)}</Badge>
          )}
        </div>
        {dto.explanation && <p className="mt-3 whitespace-pre-wrap text-sm">{dto.explanation}</p>}
        {Array.isArray(dto.strengths) && dto.strengths.length > 0 && (
          <>
            <h4 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Strengths</h4>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {dto.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ul>
          </>
        )}
        {Array.isArray(dto.evidence) && dto.evidence.length > 0 && (
          <>
            <h4 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Evidence</h4>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {dto.evidence.slice(0, 8).map((e: Any, i: number) => (
                <li key={i}>"…{e.snippet}…"</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This preview always mirrors the sanitized client DTO — never raw admin data.
      </p>
    </div>
  );
}

// ── Activity & audit ───────────────────────────────────────────────────────
function ActivityAuditTab({
  matchId,
  positionId,
  decisions,
}: {
  matchId: string;
  positionId?: string;
  decisions: Any[];
}) {
  const posActivityFn = useServerFn(getPositionActivity);
  const { data: posActivity } = useQuery({
    queryKey: ["position-activity-for-match", positionId],
    queryFn: () =>
      positionId ? posActivityFn({ data: { id: positionId, limit: 40 } }) : Promise.resolve([]),
    enabled: !!positionId,
  });
  const events = useMemo(() => {
    const decisionEvents = decisions.map((d) => ({
      when: d.created_at,
      kind: "decision",
      label: d.decision_type,
      detail: d.reason ?? (d.approved_score != null ? `@ ${d.approved_score}` : ""),
      trace: null,
    }));
    const posEvents = ((posActivity as Any[]) ?? []).map((r) => ({
      when: r.created_at,
      kind: "audit",
      label: r.action,
      detail: r.actor_user_id ? `actor ${String(r.actor_user_id).slice(0, 8)}` : "system",
      trace: r.trace_id,
    }));
    return [...decisionEvents, ...posEvents].sort(
      (a, b) => new Date(b.when).valueOf() - new Date(a.when).valueOf(),
    );
  }, [decisions, posActivity]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Activity &amp; audit — match #{matchId.slice(0, 8)}
      </div>
      {events.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No activity yet.
        </p>
      ) : (
        <ul className="divide-y">
          {events.map((e, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-4 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={e.kind === "decision" ? "default" : "outline"}>
                    {e.kind}
                  </Badge>
                  <span className="font-mono text-xs">{e.label}</span>
                </div>
                {e.detail && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div>{new Date(e.when).toLocaleString()}</div>
                {e.trace && <div className="font-mono text-[10px]">{e.trace}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Action rail (all lifecycle actions in one place) ───────────────────────
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
  onRun: (label: string, fn: () => Promise<Any>) => Promise<void>;
  onDone: () => Promise<void>;
  onSetTab: (t: Any) => void;
}) {
  const [reason, setReason] = useState("");
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
      label: "Approve score",
      qa: "primary-approve-score",
      disabled: !!busy,
      onClick: () =>
        onRun("approve", () =>
          applyReviewDecision({
            data: { match_id: m.id, action: "approve_for_client", reason },
          }),
        ),
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
        <div className="mt-3 flex items-stretch gap-2">
          <Button
            className="flex-1"
            disabled={primary.disabled}
            onClick={primary.onClick}
            data-qa-action={primary.qa}
          >
            {primary.label}
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


function JourneyTab({ matchId }: { matchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["candidate-journey", matchId],
    queryFn: () => getCandidateJourney({ data: { candidateMatchId: matchId } }),
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading timeline…</div>;
  const events = data?.events ?? [];
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Candidate journey</h2>
        <p className="text-xs text-muted-foreground">
          Full relationship at a glance — from sourced or applied through rehire.
        </p>
      </header>
      <JourneyTimeline events={events} />
    </div>
  );
}
