import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  advanceProcessing,
  applyReviewDecision,
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
} from "lucide-react";


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
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl space-y-3 p-10 text-center">
        <h1 className="text-lg font-semibold text-destructive">
          Couldn't load candidate
        </h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </Button>
      </div>
    );
  },
  component: CandidateWorkspace,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TABS = [
  { id: "profile", label: "Profile", icon: User },
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
  parsing: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  enriching: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  ready_to_score: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  scored: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  manual_review_required: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  ocr_required: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
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

  const run = async (label: string, fn: () => Promise<Any>) => {
    setBusy(label);
    try {
      const r = await fn();
      toast.success(
        `${label} → ${r?.state ?? r?.action ?? "done"}${r?.trace_id ? ` (${r.trace_id})` : ""}`,
      );
      await invalidate();
    } catch (e) {
      toast.error(`${label} failed: ${(e as Error).message}`);
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
              <ProfileTab cp={cp} pos={pos} m={m} siblings={siblings} />
            )}
            {tab === "cv" && <CvTab cv={cv} />}
            {tab === "enrichment" && <EnrichmentTab cp={cp} evidence={evidence} />}
            {tab === "evidence" && (
              <EvidenceTab evidence={evidence} result={currentResult} />
            )}
            {tab === "score" && (
              <ScoreTab currentRun={currentRun} result={currentResult} />
            )}
            {tab === "screening" && (
              <ScreeningTab result={currentResult} />
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
            <span>·</span>
            <span className="font-mono">#{m.id.slice(0, 8)}</span>
            {m.last_processing_trace_id && (
              <>
                <span>·</span>
                <span className="font-mono">trace {m.last_processing_trace_id.slice(0, 12)}</span>
              </>
            )}
          </div>
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
}: {
  cp: Any;
  pos: Any;
  m: Any;
  siblings: Any[];
}) {
  return (
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
  );
}

function Row({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{v ?? <span className="text-muted-foreground">—</span>}</dd>
    </>
  );
}

// ── CV & parsed ────────────────────────────────────────────────────────────
function CvTab({ cv }: { cv: Any }) {
  if (!cv)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No CV on file for this candidate.
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Extracted text</h2>
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
        </div>
        <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">
          {cv.extracted_text?.trim() || "(no text extracted)"}
        </pre>
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
                    {r.text ?? r.requirement_text ?? "—"}
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
function ScoreTab({ currentRun, result }: { currentRun: Any; result: Any }) {
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
          <p className="mt-3 whitespace-pre-wrap text-sm">{currentRun.explanation}</p>
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
              <h4 className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Strengths</h4>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {(result?.strengths ?? []).map((s: string, i: number) => (
                  <li key={i}>{s}</li>
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
                  <li key={i}>{s}</li>
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
function ScreeningTab({ result }: { result: Any }) {
  const items = (result?.screening_evidence ?? []) as Any[];
  if (items.length === 0)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No screening answers on file.
      </div>
    );
  return (
    <ul className="space-y-2">
      {items.map((s, i) => (
        <li
          key={i}
          className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"
        >
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
        </li>
      ))}
    </ul>
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
                          ? "text-emerald-700 dark:text-emerald-300"
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
                onSelect={() =>
                  onRun("archive", () =>
                    applyReviewDecision({
                      data: { match_id: m.id, action: "archive", reason },
                    }),
                  )
                }
                data-qa-action="overflow-hide"
                className="text-destructive"
              >
                Hide (archive)
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
        <div className="rounded-lg border bg-emerald-500/10 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-200">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Live for client
          </div>
        </div>
      )}
    </aside>
  );
}

