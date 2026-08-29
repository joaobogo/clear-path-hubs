import { toFitPresentation } from "@/lib/client-fit-presentation";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getReviewRecord,
  correctEvidenceItem,
  setEligibilityDecision,
  requestCandidateInformation,
  recomputeScore,
} from "@/lib/scoring-review.functions";
import { applyReviewDecision } from "@/lib/processing.functions";
import {
  humanizeCode,
  humanizeCriterionKey,
  humanizeEvidenceLocation,
} from "@/lib/humanize-codes";
import { HumanVerificationPanel } from "@/components/admin/human-verification-panel";
import {
  methodLabel,
  methodSentence,
  normalizeEvaluationMethod,
} from "@/lib/scoring/evaluation-method";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminScoreNumber } from "@/components/admin/admin-score-number";
import { scoreVoidedByUnreadableCv } from "@/lib/scoring/published-score";
import { renderQuote } from "@/lib/evidence/quote-hygiene";
import { resolveParseFailure } from "@/lib/parse-failure/parse-failure-codes";
import { UnicornMarker } from "@/components/unicorn-marker";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  History,
  FileText,
  Lock,
  RefreshCw,
} from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDateTime, pluralize } from "@/lib/format/datetime";
import { formatAnswerValue } from "@/lib/human-labels";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const searchSchema = z.object({
  queue: fallback(z.string(), "ready_for_decision").default("ready_for_decision"),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "oldest_first").default("oldest_first"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/admin/scoring/review/$matchId")({
  validateSearch: zodValidator(searchSchema),
  loader: async ({ context, params }) => {
    const rec = await context.queryClient.ensureQueryData({
      queryKey: ["review-record", params.matchId],
      queryFn: () => getReviewRecord({ data: { match_id: params.matchId } }),
    });
    if (!rec) throw notFound();
    return rec;
  },
  head: () => ({
    meta: [
      { title: "Review submission · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Evidence-by-dimension review with versioned corrections." },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Submission not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.scoring.review.$matchId.tsx"),
  component: ReviewWorkspace,
});

const RESULTS = [
  "strong",
  "partial",
  "weak",
  "missing",
  "contradictory",
  "not_applicable",
  "needs_validation",
] as const;

const RESULT_TONE: Record<string, string> = {
  strong: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  weak: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  missing: "bg-destructive/10 text-destructive",
  contradictory: "bg-destructive/10 text-destructive",
  needs_validation: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  not_applicable: "bg-muted text-muted-foreground",
};

function provenance(item: Any) {
  const kind = String(item.source_kind ?? "").toLowerCase();
  if (item.reviewer_status === "edited" || item.reviewer_status === "accepted")
    return { label: "Admin-verified", tone: "bg-primary/10 text-primary" };
  if (kind.includes("intake") || kind.includes("answer") || kind.includes("screening"))
    return { label: "Candidate-provided", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400" };
  return { label: "Extracted", tone: "bg-muted text-muted-foreground" };
}

function fmt(v: unknown) {
  if (v == null || v === "") return "—";
  // Numbers are never enum tokens. 54.3 once matched the token pattern below
  // (digits, dot, digits) and was "humanized" into "54 3" — the page built for
  // hand-verifying scores garbled every decimal it showed.
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  const s = String(v);
  // Stored enum tokens ("provisional_scoring") read as a label, never as a key.
  // A token must contain a letter — numeric strings pass through untouched.
  return /[a-z]/.test(s) && /^[a-z0-9]+([_.][a-z0-9]+)+$/.test(s) ? humanizeCode(s) : s;
}

/** A stored 0-1 coverage ratio as the whole percentage every surface shows. */
function pctOfRatio(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

function ReviewWorkspace() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const data = Route.useLoaderData() as Any;
  const router = useRouter();
  const navigate = useNavigate();

  const {
    match,
    profile,
    position,
    rubric,
    currentRun,
    previousRun,
    evidenceItems,
    eligibility,
    overrides,
    decisions,
    answers,
    audit,
    document: doc,
  } = data;
  useDetailCrumb((profile as Any)?.full_name ?? null);

  const correct = useServerFn(correctEvidenceItem);
  const decideEligibility = useServerFn(setEligibilityDecision);
  const requestInfo = useServerFn(requestCandidateInformation);
  const recompute = useServerFn(recomputeScore);
  const decide = useServerFn(applyReviewDecision);

  // Unsaved-correction guard: any draft blocks accidental navigation away.
  const [drafts, setDrafts] = useState<Record<string, { result?: string; reason: string }>>({});
  const dirty = Object.keys(drafts).length > 0;
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    run: () => Promise<void>;
  }>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const refresh = useCallback(async () => {
    await router.invalidate();
  }, [router]);

  const grouped = useMemo(() => {
    const map = new Map<string, Any[]>();
    for (const it of evidenceItems as Any[]) {
      const key = it.rubric_dimension_key ?? "unmapped";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()];
  }, [evidenceItems]);

  const dimensionWeights: Record<string, number> =
    (rubric?.weights as Record<string, number> | null) ??
    (position?.evaluation_weights as Record<string, number> | null) ??
    {};

  const answerByQuestion = useMemo(
    () =>
      (answers as Any[]).map((a) => ({
        question: a.screening_questions?.question ?? "Question",
        dealbreaker: Boolean(a.screening_questions?.dealbreaker),
        answer: formatAnswerValue(a.answer),
      })),
    [answers],
  );

  // Keyboard-efficient review: j/k walk dimensions, no destructive shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "j") setFocusIndex((i) => Math.min(i + 1, Math.max(grouped.length - 1, 0)));
      if (e.key === "k") setFocusIndex((i) => Math.max(i - 1, 0));
      if (e.key === "j" || e.key === "k") {
        const id = grouped[e.key === "j" ? Math.min(focusIndex + 1, grouped.length - 1) : Math.max(focusIndex - 1, 0)]?.[0];
        if (id) document.getElementById(`dim-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grouped, focusIndex]);

  function guardLeave(e: React.MouseEvent) {
    if (dirty && !window.confirm("You have unsaved corrections. Leave anyway?")) {
      e.preventDefault();
    }
  }

  async function saveCorrection(item: Any) {
    const draft = drafts[item.id];
    if (!draft) return;
    if (draft.reason.trim().length < 8) {
      toast.error("Add a reason of at least 8 characters.");
      return;
    }
    if (!draft.result || draft.result === item.result) {
      toast.error("Change the evidence result before saving.");
      return;
    }
    setBusy(true);
    try {
      const res = await correct({
        data: {
          match_id: params.matchId,
          evidence_item_id: item.id,
          reason: draft.reason.trim(),
          patch: { result: draft.result as (typeof RESULTS)[number] },
          rescore: true,
        },
      });
      setDrafts((d) => {
        const next = { ...d };
        delete next[item.id];
        return next;
      });
      toast.success(
        res.rescored?.ok
          ? "Correction saved and score recomputed."
          : "Correction saved. Rescore did not run — trigger it from the pipeline.",
      );
      await refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not save the correction.");
    } finally {
      setBusy(false);
    }
  }

  async function runRecompute() {
    setBusy(true);
    try {
      await recompute({ data: { match_id: params.matchId } });
      toast.success("Score recomputed successfully.");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message || "Recompute failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runDecision(action: "approve_for_client" | "hold" | "archive", label: string) {
    if (action !== "approve_for_client" && decisionReason.trim().length < 8) {
      toast.error("A reason is required for hold and reject.");
      return;
    }
    setBusy(true);
    try {
      await decide({
        data: {
          match_id: params.matchId,
          action,
          reason: decisionReason.trim() || undefined,
          // Approval is internal; publishing to the client is a separate step.
          ...(action === "approve_for_client" ? { publish: false } : {}),
        },
      });
      setDecisionReason("");
      toast.success(`${label} recorded. Contact details remain unreleased.`);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message || "Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  const scoreVoided = scoreVoidedByUnreadableCv(match as Any);

  // The screening questions a disqualifying answer tripped, read off the cap
  // the engine recorded ("disqualifying_answer: <question>, <question>").
  const disqualifyingCaps: string[] = (
    ((currentRun?.result as Any)?.applied_caps as Any[] | undefined) ?? []
  )
    .map((c: Any) => String(c?.reason ?? ""))
    .filter((r) => r.startsWith("disqualifying_answer:"))
    .map((r) => r.slice("disqualifying_answer:".length).trim())
    .filter(Boolean);

  const scoreDelta =
    currentRun && previousRun
      ? Number(currentRun.final_score ?? currentRun.score ?? 0) -
        Number(previousRun.final_score ?? previousRun.score ?? 0)
      : null;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/scoring/review"
          search={search}
          onClick={guardLeave}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to queues
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="rounded border px-1.5 py-0.5">j</kbd>
          <kbd className="rounded border px-1.5 py-0.5">k</kbd>
          <span>move between dimensions</span>
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {profile?.full_name ?? "Unnamed candidate"}
          <UnicornMarker score={currentRun} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {position?.title ?? "—"} · {position?.organizations?.name ?? "—"} · state{" "}
          {fmt(match.canonical_state)} · processing {fmt(match.processing_state)}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* A score computed from text that later proved unreadable is not a
              score. The candidate workspace header already says so; this page
              still printed "Score 41 · Not recommended" beside a processing
              state of ocr_required (audit #4, item 13). */}
          {scoreVoided ? (
            <Badge variant="outline" className="border-warning/40 bg-warning/10">
              No score — CV unreadable
            </Badge>
          ) : (
            <>
              {/* Staff view: the number never travels without its confidence pair
                  and the rubric version it was scored against. */}
              <AdminScoreNumber run={currentRun as never} />
              <Badge variant="secondary">Fit {toFitPresentation((currentRun?.fit_label ?? currentRun?.fit_band ?? null) as string | null, (currentRun?.final_score ?? currentRun?.score ?? null) as number | null).headline}</Badge>
            </>
          )}
          <Badge variant="secondary">Eligibility {fmt(match.eligibility_status)}</Badge>
          <Badge variant={match.contact_released_at ? "default" : "outline"}>
            <Lock className="mr-1 size-3" />
            Contact {match.contact_released_at ? "released" : "withheld"}
          </Badge>
        </div>
      </header>

      {dirty ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Unsaved corrections</AlertTitle>
          <AlertDescription>
            Save or discard your dimension edits before leaving this record.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* `ocr_required` was not in this condition, so a CV that extracted into
          byte soup got no explanation here at all — and the message itself was
          printed raw, giving "cv_unreadable" where a sentence belongs (audit
          #4, H1). The failure catalogue already writes the cause and the next
          action for every code. */}
      {match.processing_state === "failed" ||
      match.processing_state === "ocr_required" ||
      doc?.parse_state === "failed" ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {match.processing_state === "ocr_required"
              ? "This document could not be read as text"
              : "Document could not be parsed"}
          </AlertTitle>
          <AlertDescription>
            {(() => {
              const raw = String(
                match.processing_error_message ?? doc?.parse_error ?? doc?.parse_error_code ?? "",
              );
              // A bare code becomes its written cause; a real sentence is left
              // exactly as it was written.
              const looksLikeCode = /^[a-z0-9]+(_[a-z0-9]+)*$/.test(raw.trim());
              if (!looksLikeCode) return fmt(raw);
              const failure = resolveParseFailure(raw.trim());
              return `${failure.cause} ${failure.nextAction}`;
            })()}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Job requirements + scoring configuration */}
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Job requirements and scoring configuration</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Must-haves</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {(Array.isArray(position?.requirements) ? position.requirements : []).map(
                    (r: Any, i: number) => (
                      <li key={i}>• {typeof r === "string" ? r : r?.label ?? JSON.stringify(r)}</li>
                    ),
                  )}
                  {!Array.isArray(position?.requirements) || position.requirements.length === 0 ? (
                    <li className="text-muted-foreground">None recorded</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Preferred</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {(Array.isArray(position?.preferred_requirements)
                    ? position.preferred_requirements
                    : []
                  ).map((r: Any, i: number) => (
                    <li key={i}>• {typeof r === "string" ? r : r?.label ?? JSON.stringify(r)}</li>
                  ))}
                  {!Array.isArray(position?.preferred_requirements) ||
                  position.preferred_requirements.length === 0 ? (
                    <li className="text-muted-foreground">None recorded</li>
                  ) : null}
                </ul>
              </div>
            </div>
            {/* The criteria list the score was actually computed against. */}
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium">
                Criteria as scored{" "}
                {rubric ? `— ${fmt(rubric.label)} v${rubric.version_number}` : ""}
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {(Array.isArray(rubric?.dimensions) ? rubric.dimensions : []).map(
                  (r: Any, i: number) => (
                    <li key={`d-${i}`}>• {typeof r === "string" ? r : r?.label ?? JSON.stringify(r)}</li>
                  ),
                )}
                {(Array.isArray(rubric?.qualifiers) ? rubric.qualifiers : []).map(
                  (r: Any, i: number) => (
                    <li key={`q-${i}`} className="text-muted-foreground">
                      • {typeof r === "string" ? r : r?.label ?? JSON.stringify(r)} (preferred)
                    </li>
                  ),
                )}
                {!Array.isArray(rubric?.dimensions) || rubric.dimensions.length === 0 ? (
                  <li className="text-muted-foreground">
                    No criteria recorded on this rubric version
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Rubric {rubric ? `v${rubric.version_number} (${fmt(rubric.status)})` : "not versioned"} ·
              engine {fmt(currentRun?.engine_version)} ·{" "}
              <span title={methodSentence(currentRun?.evaluation_method)}>
                method {methodLabel(currentRun?.evaluation_method)}
              </span>
              {normalizeEvaluationMethod(currentRun?.evaluation_method) === "legacy" ? (
                <> · produced before the current scoring contract</>
              ) : null}
              {Object.keys(dimensionWeights).length > 0 ? (
                <>
                  {" "}
                  · weights{" "}
                  {Object.entries(dimensionWeights)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")}
                </>
              ) : null}
            </div>
            {position?.updated_at && currentRun?.completed_at &&
            new Date(position.updated_at) > new Date(currentRun.completed_at) ? (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Job changed after scoring</AlertTitle>
                <AlertDescription>
                  This job was edited on {formatDateTime(position.updated_at)}, after the
                  current score ran.
                </AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 gap-1.5"
                  onClick={runRecompute}
                  disabled={busy}
                >
                  <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                  Recompute now
                </Button>
              </Alert>
            ) : null}
          </Card>

          {/* Machine-derived vs human-verified criteria, and reviewer verdicts */}
          <HumanVerificationPanel matchId={params.matchId} onChanged={refresh} />

          {/* Evidence per dimension */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Evidence by dimension</h2>
            {/* The structured evidence-items table is written by a separate
                pipeline step that often covers only the dimensions a reviewer
                has already touched. Gating the run's own evidence on
                `grouped.length === 0` meant ONE admin-verified dimension hid
                the other seven requirements entirely (audit #4, M18). The
                run's assessment is now always available beneath whatever
                structured items exist. */}
            {(() => {
              // EVERY requirement the run assessed, not only the ones that
              // found evidence. A requirement with nothing behind it is the
              // most important row on this page — it is the gap the reviewer
              // is deciding about — and filtering it out left the panel
              // showing a single dimension out of eight (audit #4, item 21).
              const runRows = Array.isArray((currentRun?.result as Any)?.requirement_assessment)
                ? ((currentRun.result as Any).requirement_assessment as Any[]).filter((r: Any) =>
                    Boolean(r?.text),
                  )
                : [];
              if (grouped.length === 0 && runRows.length === 0) {
                return (
                  <Card className="p-6 text-sm text-muted-foreground">
                    No structured evidence yet. Run the pipeline or review the CV directly.
                  </Card>
                );
              }
              if (runRows.length === 0) return null;
              return (
                <Card className="space-y-3 p-5">
                  <p className="text-xs text-muted-foreground">
                    {grouped.length === 0
                      ? "From the scoring run — structured review items have not been generated for this candidate, so row-level corrections are made from the Score tab."
                      : "From the scoring run — every requirement the run assessed. Dimensions with structured review items are shown above and can be corrected there."}
                  </p>
                  {runRows.map((r: Any, i: number) => (
                    <div key={i} className="space-y-1 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            RESULT_TONE[String(r.status)] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {humanizeCode(String(r.status ?? "unknown"))}
                        </span>
                        <span className="text-sm font-medium">{String(r.text ?? "")}</span>
                      </div>
                      {(() => {
                        // Quotes go through the same hygiene every other
                        // surface uses, so byte soup from an unreadable CV is
                        // never quoted here as evidence (audit #4, item 13).
                        const quotes = (Array.isArray(r.evidence) ? (r.evidence as Any[]) : [])
                          .map((e: Any) => renderQuote(String(e?.snippet ?? "")))
                          .filter(Boolean)
                          .slice(0, 3);
                        if (quotes.length === 0) {
                          return (
                            <p className="pl-2 text-xs italic text-muted-foreground">
                              No passage in the application supports this requirement.
                            </p>
                          );
                        }
                        return quotes.map((q, j) => (
                          <p
                            key={j}
                            className="border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground"
                          >
                            {q}
                          </p>
                        ));
                      })()}
                    </div>
                  ))}
                </Card>
              );
            })()}
            {grouped.map(([dim, items], gi) => (
              <Card
                key={dim}
                id={`dim-${dim}`}
                className={`space-y-3 p-5 ${gi === focusIndex ? "ring-1 ring-primary/40" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{humanizeCode(dim)}</h3>
                  {dimensionWeights[dim] != null ? (
                    <Badge variant="outline">weight {dimensionWeights[dim]}</Badge>
                  ) : null}
                </div>
                {items.map((item: Any) => {
                  const prov = provenance(item);
                  const draft = drafts[item.id];
                  return (
                    <div key={item.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            RESULT_TONE[item.result] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.result ? humanizeCode(item.result) : "—"}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${prov.tone}`}>
                          {prov.label}
                        </span>
                        {item.supporting_role ? (
                          <Badge variant="outline">{item.supporting_role}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          confidence {item.confidence ?? "—"}
                        </span>
                        {item.integrity_ok === false ? (
                          <Badge variant="destructive">flagged</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {humanizeCriterionKey(item.rubric_criterion_key)}
                      </p>
                      {item.source_passage ? (
                        <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                          “{item.source_passage}”
                          {humanizeEvidenceLocation(item.source_location) ? (
                            <span className="ml-2 not-italic text-xs">
                              ({humanizeEvidenceLocation(item.source_location)})
                            </span>
                          ) : null}
                        </blockquote>
                      ) : (
                        <p className="text-sm text-muted-foreground">No source passage captured.</p>
                      )}
                      {item.normalized_meaning ? (
                        <p className="text-sm">{item.normalized_meaning}</p>
                      ) : null}
                      {item.validation_need ? (
                        <p className="text-xs text-amber-600">
                          Needs validation: {humanizeCode(item.validation_need)}
                        </p>
                      ) : null}

                      <details className="rounded-md bg-muted/40 p-3">
                        <summary className="cursor-pointer text-xs font-medium">
                          Correct this dimension
                        </summary>
                        <div className="mt-3 space-y-2">
                          <select
                            aria-label="Corrected result"
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={draft?.result ?? item.result ?? ""}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [item.id]: { result: e.target.value, reason: d[item.id]?.reason ?? "" },
                              }))
                            }
                          >
                            {RESULTS.map((r) => (
                              <option key={r} value={r}>
                                {humanizeCode(r)}
                              </option>
                            ))}
                          </select>
                          <Textarea
                            aria-label="Reason for correction"
                            placeholder="Why is the extracted result wrong? (required, min 8 characters)"
                            value={draft?.reason ?? ""}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [item.id]: {
                                  result: d[item.id]?.result ?? item.result,
                                  reason: e.target.value,
                                },
                              }))
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={busy || !draft}
                              onClick={() =>
                                setConfirm({
                                  title: "Save correction and recompute?",
                                  body: "The evidence change is versioned with your reason, and the score is recalculated from the updated evidence.",
                                  run: () => saveCorrection(item),
                                })
                              }
                            >
                              Save and recompute
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!draft}
                              onClick={() =>
                                setDrafts((d) => {
                                  const next = { ...d };
                                  delete next[item.id];
                                  return next;
                                })
                              }
                            >
                              Discard
                            </Button>
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </Card>
            ))}
          </section>

          {/* Candidate-provided answers */}
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Candidate-provided answers</h2>
            {answerByQuestion.length === 0 ? (
              <p className="text-sm text-muted-foreground">No screening answers recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {answerByQuestion.map((a, i) => (
                  <li key={i}>
                    <p className="text-xs text-muted-foreground">
                      {a.question} {a.dealbreaker ? "· dealbreaker" : ""}
                    </p>
                    <p>{a.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* History */}
          <Card className="space-y-3 p-5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" /> Correction and decision history
            </h2>
            {overrides.length === 0 && decisions.length === 0 && audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manual intervention yet.</p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {(overrides as Any[]).map((o) => (
                <li key={o.id} className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)} · evidence corrected
                  </p>
                  <p>
                    {fmt(o.before_state?.result)} → {fmt(o.after_state?.result)} — {fmt(o.reason)}
                  </p>
                </li>
              ))}
              {/* Repeated attempts at the same blocked action are one event
                  with a count, not four identical rows a minute apart
                  ("Score Approval Blocked" at 04:36, 04:37, 04:38 and 01:30 —
                  audit #4, M17). Runs are consecutive rows sharing the action
                  and reason. */}
              {(() => {
                const rows = decisions as Any[];
                const groups: Array<{ first: Any; count: number; lastAt: string }> = [];
                for (const d of rows) {
                  const prev = groups[groups.length - 1];
                  const sameAction =
                    prev &&
                    String(prev.first.decision_type) === String(d.decision_type) &&
                    String(prev.first.reason ?? "") === String(d.reason ?? "");
                  if (sameAction) {
                    prev.count += 1;
                    // Rows arrive newest-first, so the last one seen is oldest.
                    prev.lastAt = d.created_at;
                  } else {
                    groups.push({ first: d, count: 1, lastAt: d.created_at });
                  }
                }
                return groups.map((g) => (
                  <li key={g.first.id} className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(g.first.created_at)} · {fmt(g.first.decision_type)}
                      {g.count > 1 ? ` · ×${g.count} (since ${formatDateTime(g.lastAt)})` : ""}
                    </p>
                    <p>{fmt(g.first.reason)}</p>
                  </li>
                ));
              })()}
              {(audit as Any[])
                // Every review decision is dual-written: a score_decisions
                // row (rendered above, with its reason) AND a mirroring
                // audit_events row. Rendering both printed the same action
                // twice with the same timestamp (audit A-12). The audit list
                // keeps only events the decisions list does not already tell.
                .filter(
                  (a) =>
                    !(decisions as Any[]).some(
                      (d) =>
                        Math.abs(
                          new Date(a.created_at).getTime() - new Date(d.created_at).getTime(),
                        ) < 10_000 && String(a.action ?? "").startsWith("score"),
                    ),
                )
                .map((a) => (
                  <li key={a.id} className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)} · {fmt(a.action)}
                    </p>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        {/* Right rail: comparison, eligibility, actions */}
        <aside className="space-y-4">
          <Card className="space-y-2 p-5">
            <h2 className="text-sm font-semibold">Version comparison</h2>
            {scoreVoided ? (
              /* Same rule as the header: the figures below were computed from
                 text that proved unreadable, so "SCORE 41.4" is not a fact
                 about this candidate (audit #4, item 13). */
              <p className="text-sm text-muted-foreground">
                No score to compare — the CV could not be read. Run OCR or retry parse, then
                rescore.
              </p>
            ) : currentRun ? (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Current</dt>
                  <dd>{fmt(currentRun.final_score ?? currentRun.score)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Previous</dt>
                  <dd>
                    {previousRun ? fmt(previousRun.final_score ?? previousRun.score) : "—"}
                  </dd>
                </div>
                {scoreDelta != null ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Change</dt>
                    <dd className={scoreDelta >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {scoreDelta > 0 ? "+" : ""}
                      {scoreDelta.toFixed(1)}
                    </dd>
                  </div>
                ) : null}
                {/* A 0-1 ratio through the generic formatter printed "0.8" /
                    "1" / "0.4" here while every other surface shows the same
                    figure as a percentage (audit #4, M3). */}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Must-have coverage</dt>
                  <dd>{pctOfRatio(currentRun.must_have_coverage)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Preferred coverage</dt>
                  <dd>{pctOfRatio(currentRun.preferred_coverage)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Contradictions</dt>
                  <dd>{fmt(currentRun.contradiction_status)}</dd>
                </div>
                {/* Name the pairs — an unexplained flag cannot be resolved. */}
                {Array.isArray((currentRun.result as Any)?.contradiction_rows) &&
                  ((currentRun.result as Any).contradiction_rows as Any[]).length > 0 && (
                    <div className="col-span-2 space-y-1 pt-1">
                      {((currentRun.result as Any).contradiction_rows as Any[]).map(
                        (r: Any, i: number) => (
                          <p key={i} className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs">
                            Answered yes to “{r.question}” — no CV evidence for “{r.requirement}”.
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {/* A disqualifying answer has no contradiction row: its pair is
                    the screening question and the dealbreaker it tripped, which
                    the engine records in the cap reason. Without this the
                    banner said only "disqualifying answer — read the evidence
                    before approving", and the reviewer had to go and find WHICH
                    answer on another tab (audit #4, item 11). */}
                {disqualifyingCaps.length > 0 && (
                  <div className="col-span-2 space-y-1 pt-1">
                    {disqualifyingCaps.map((reason, i) => (
                      <p
                        key={i}
                        className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs"
                      >
                        Disqualifying screening answer on “{reason}” — the score is capped because
                        of it.
                      </p>
                    ))}
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No score run yet.</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Totals are computed. To change a score, correct the underlying evidence with a reason.
            </p>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Critical requirements</h2>
            {(eligibility as Any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualifiers configured.</p>
            ) : null}
            {(eligibility as Any[]).map((c) => (
              <EligibilityRow
                key={c.id}
                check={c}
                busy={busy}
                onDecide={async (status, reason) => {
                  setBusy(true);
                  try {
                    await decideEligibility({
                      data: { match_id: params.matchId, check_id: c.id, status, reason },
                    });
                    toast.success("Eligibility updated.");
                    await refresh();
                  } catch (err) {
                    toast.error((err as Error).message || "Could not update eligibility.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))}
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Document</h2>
            <p className="inline-flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              {/* A filename is never an enum token — fmt() once title-cased
                  "curriculo_atual.pdf" into "Curriculo Atual Pdf". */}
              {doc?.filename ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Parse state {fmt(doc?.parse_state)}
              {typeof doc?.page_count === "number"
                ? ` · ${pluralize(doc.page_count, "page")}`
                : ""}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link
                to="/admin/candidates/$id"
                params={{ id: params.matchId }}
                onClick={guardLeave}
              >
                Open full profile
              </Link>
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" /> Decision
            </h2>
            <Textarea
              aria-label="Decision reason"
              placeholder="Reason (required for hold and reject)"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
            />
            <div className="grid gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    title: "Approve for client?",
                    body: "The candidate becomes visible to this client. Contact details stay withheld until you release them separately.",
                    run: () => runDecision("approve_for_client", "Approval"),
                  })
                }
              >
                Approve for client
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    title: "Put on hold?",
                    body: "The submission stays internal and remains in the review queues.",
                    run: () => runDecision("hold", "Hold"),
                  })
                }
              >
                Hold
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    title: "Reject from this job?",
                    body: "The submission is archived for this job. Other applications are unaffected.",
                    run: () => runDecision("archive", "Rejection"),
                  })
                }
              >
                Reject from this job
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Approval never releases contact details — that is a separate, audited action on the
              candidate profile.
            </p>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Request information</h2>
            <Textarea
              aria-label="Message to candidate"
              placeholder="What do you need from the candidate?"
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || infoMessage.trim().length < 10}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await requestInfo({
                    data: { match_id: params.matchId, message: infoMessage.trim() },
                  });
                  setInfoMessage("");
                  toast.success(
                    r.notified
                      ? "Request sent to the candidate."
                      : "Request logged. The candidate has no account to notify yet.",
                  );
                  await refresh();
                } catch (err) {
                  toast.error((err as Error).message || "Could not send the request.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send request
            </Button>
          </Card>
        </aside>
      </div>

      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                await c?.run();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="sr-only"
        onClick={() => navigate({ to: "/admin/scoring/review", search })}
      >
        Back
      </button>
    </div>
  );
}

function EligibilityRow({
  check,
  busy,
  onDecide,
}: {
  check: Any;
  busy: boolean;
  onDecide: (
    status: "eligible" | "not_eligible" | "needs_validation" | "excepted",
    reason: string,
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string>(check.status ?? "needs_validation");
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{check.qualifier_label ?? check.qualifier_key}</p>
        {/* Words, not enum keys — this printed "not_evaluated" (M18). */}
        <Badge variant={check.status === "eligible" ? "default" : "outline"}>
          {humanizeCode(String(check.status ?? "unknown"))}
        </Badge>
      </div>
      {check.reason ? <p className="text-xs text-muted-foreground">{check.reason}</p> : null}
      <select
        aria-label={`Set ${check.qualifier_key} status`}
        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="eligible">eligible</option>
        <option value="not_eligible">not eligible</option>
        <option value="needs_validation">needs validation</option>
        <option value="excepted">excepted</option>
      </select>
      <Textarea
        aria-label="Eligibility reason"
        className="min-h-[60px] text-xs"
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || reason.trim().length < 8 || status === check.status}
        onClick={async () => {
          await onDecide(
            status as "eligible" | "not_eligible" | "needs_validation" | "excepted",
            reason.trim(),
          );
          setReason("");
        }}
      >
        Save qualifier
      </Button>
    </div>
  );
}
