import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  advanceProcessing,
  applyReviewDecision,
  getAdminMatch,
  markOcrDone,
  rescore,
  retryParse,
} from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/candidates/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["admin-candidate", params.id],
      queryFn: () => getAdminMatch({ data: { id: params.id } }),
    });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({
    meta: [
      { title: "Match review · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="p-8">Match not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load: {error.message}</div>
  ),
  component: MatchDetail,
});

interface ScoreRunResult {
  score: number;
  fit_label: string;
  overall_confidence: number;
  must_have_coverage: number;
  preferred_coverage: number;
  category_breakdown: { must_have: number; preferred: number; screening_alignment: number };
  requirement_assessment: Array<{
    id: string;
    text: string;
    required: boolean;
    status: string;
    matched_terms: string[];
    evidence: Array<{ snippet: string; location: string }>;
  }>;
  strengths: string[];
  concerns: string[];
  evidence: Array<{ requirement_text: string; snippet: string; source: string; matched_terms: string[] }>;
  screening_evidence: Array<{ question: string; normalized_value: string; aligned: string }>;
  contradiction_status: string;
  completed_at: string;
  engine_version: string;
  input_hash: string;
}

function MatchDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-candidate", id],
    queryFn: () => getAdminMatch({ data: { id } }),
  });
  if (!data) return null;
  const { match, runs, decisions, jobs, evidence, cv } = data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = match as any;
  const pos = m.positions;
  const cp = m.candidate_profiles;
  const currentRun = runs[0];
  const currentResult: ScoreRunResult | null =
    (currentRun?.result as unknown as ScoreRunResult) ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [overrideScore, setOverrideScore] = useState<string>("");
  const [reason, setReason] = useState("");

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setFeedback(null);
    setError(null);
    try {
      const r = (await fn()) as { state?: string; action?: string; trace_id?: string };
      setFeedback(
        `${label} → ${r.state ?? r.action ?? "done"}${r.trace_id ? ` (${r.trace_id})` : ""}`,
      );
      await router.invalidate();
    } catch (e) {
      setError(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <Link to="/admin/candidates" className="text-sm text-muted-foreground hover:underline">
          ← Queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {cp?.full_name} — {pos?.title}
        </h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {cp?.email} · {pos?.organizations?.name} · Position status:{" "}
          <span className="font-medium">{pos?.status}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>{m.processing_state.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">admin: {m.admin_status}</Badge>
          <Badge variant="outline">visibility: {m.client_visibility}</Badge>
          {m.last_processing_trace_id && (
            <span className="text-xs text-muted-foreground">
              trace: <code>{m.last_processing_trace_id}</code>
            </span>
          )}
        </div>
        {m.processing_error_message && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>{m.processing_error_code ?? "error"}</AlertTitle>
            <AlertDescription>{m.processing_error_message}</AlertDescription>
          </Alert>
        )}
      </div>

      {feedback && <Alert><AlertDescription>{feedback}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Score card */}
          <section className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Current score</h2>
              {currentRun && (
                <span className="text-xs text-muted-foreground">
                  engine {currentRun.engine_version} · {new Date(currentRun.completed_at ?? "").toLocaleString()}
                </span>
              )}
            </div>
            {!currentRun ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No score run yet. Advance the pipeline to compute one.
              </p>
            ) : (
              <>
                <div className="mt-4 flex items-baseline gap-4">
                  <div className="text-4xl font-semibold tabular-nums">{currentRun.score?.toFixed(1)}</div>
                  <Badge variant="secondary">{currentRun.fit_label?.replace(/_/g, " ")}</Badge>
                  <span className="text-sm text-muted-foreground">
                    confidence {Math.round((currentRun.confidence ?? 0) * 100)}%
                  </span>
                </div>
                <p className="mt-2 text-sm">{currentRun.explanation}</p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Must-have coverage" pct={currentRun.must_have_coverage} />
                  <Metric label="Preferred coverage" pct={currentRun.preferred_coverage} />
                  <Metric
                    label="Screening alignment"
                    pct={currentResult?.category_breakdown.screening_alignment ?? null}
                  />
                </div>
                {currentRun.contradiction_status &&
                  currentRun.contradiction_status !== "none" && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTitle>Contradiction</AlertTitle>
                      <AlertDescription>
                        {currentRun.contradiction_status.replace(/_/g, " ")}
                      </AlertDescription>
                    </Alert>
                  )}
              </>
            )}
          </section>

          {/* Requirement coverage */}
          {currentResult && (
            <section className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Requirement coverage</h2>
              <ul className="mt-3 space-y-3">
                {currentResult.requirement_assessment.map((r) => (
                  <li key={r.id} className="rounded border bg-card p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">
                          {r.required && <span className="text-destructive">* </span>}
                          {r.text}
                        </div>
                        {r.matched_terms.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            matched: {r.matched_terms.join(", ")}
                          </div>
                        )}
                      </div>
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
                    </div>
                    {r.evidence.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                        {r.evidence.map((e, i) => (
                          <li key={i}>“…{e.snippet}…” <code className="opacity-60">{e.location}</code></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Strengths / concerns */}
          {currentResult && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Strengths</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                  {currentResult.strengths.length === 0 && (
                    <li className="text-muted-foreground list-none">None surfaced.</li>
                  )}
                  {currentResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Concerns</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                  {currentResult.concerns.length === 0 && (
                    <li className="text-muted-foreground list-none">None flagged.</li>
                  )}
                  {currentResult.concerns.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </section>
          )}

          {/* Screening evidence */}
          {currentResult && currentResult.screening_evidence.length > 0 && (
            <section className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Screening answers</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {currentResult.screening_evidence.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{s.question}</div>
                      <div className="text-muted-foreground">{s.normalized_value}</div>
                    </div>
                    <Badge variant={s.aligned === "aligned" ? "default" : s.aligned === "misaligned" ? "destructive" : "outline"}>
                      {s.aligned}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Score history */}
          <section className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Score history</h2>
            <ul className="mt-2 text-sm space-y-1">
              {runs.length === 0 && <li className="text-muted-foreground">No runs.</li>}
              {runs.map((r: any) => (
                <li key={r.id} className="flex justify-between border-b py-1">
                  <span>
                    {(r.completed_at && new Date(r.completed_at).toLocaleString()) || "—"} ·{" "}
                    <code className="text-xs">{r.engine_version}</code>
                  </span>
                  <span className="tabular-nums">
                    {r.score?.toFixed(1)} · {r.fit_label} · hash <code>{r.input_hash?.slice(0, 12)}</code>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Processing history */}
          <section className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Processing history</h2>
            <ul className="mt-2 text-xs space-y-1 font-mono">
              {jobs.length === 0 && <li className="text-muted-foreground">No jobs recorded.</li>}
              {jobs.map((j: any) => (
                <li key={j.id} className={j.status === "failed" ? "text-destructive" : ""}>
                  {new Date(j.created_at ?? "").toLocaleString()} · {j.job_type} → {j.status}
                  {j.error_code ? ` (${j.error_code}: ${j.error_message})` : ""} · {j.trace_id}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right column: actions + CV */}
        <aside className="space-y-6">
          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="text-lg font-semibold">Pipeline actions</h2>
            <Button
              className="w-full"
              disabled={busy !== null}
              onClick={() => run("advance", () => advanceProcessing({ data: { match_id: id } }))}
            >
              Advance pipeline
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy !== null}
              onClick={() => run("retry parse", () => retryParse({ data: { match_id: id } }))}
            >
              Retry parse
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy !== null}
              onClick={() => run("rescore", () => rescore({ data: { match_id: id } }))}
            >
              Rescore (idempotent)
            </Button>
            {m.processing_state === "ocr_required" && (
              <div className="pt-2">
                <Label htmlFor="ocr">OCR text</Label>
                <Textarea
                  id="ocr"
                  rows={4}
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  placeholder="Paste OCR output (min 60 chars)"
                />
                <Button
                  className="mt-2 w-full"
                  disabled={busy !== null || ocrText.length < 60}
                  onClick={() =>
                    run("mark OCR done", () => markOcrDone({ data: { match_id: id, ocr_text: ocrText } }))
                  }
                >
                  Attach OCR & continue
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="text-lg font-semibold">Review decision</h2>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={busy !== null || m.processing_state !== "scored"}
              onClick={() =>
                run("approve for client", () =>
                  applyReviewDecision({ data: { match_id: id, action: "approve_for_client", reason } }),
                )
              }
            >
              Approve for client
            </Button>
            {m.processing_state !== "scored" && (
              <p className="text-xs text-muted-foreground">
                Approval requires a scored, evidence-backed run.
              </p>
            )}
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy !== null}
              onClick={() =>
                run("hold", () =>
                  applyReviewDecision({ data: { match_id: id, action: "hold", reason } }),
                )
              }
            >
              Hold
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={busy !== null}
              onClick={() =>
                run("archive", () =>
                  applyReviewDecision({ data: { match_id: id, action: "archive", reason } }),
                )
              }
            >
              Archive
            </Button>
            <div className="pt-2">
              <Label htmlFor="override">Manual override score</Label>
              <div className="flex gap-2">
                <Input
                  id="override"
                  type="number"
                  min={0}
                  max={100}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                />
                <Button
                  disabled={busy !== null || overrideScore === ""}
                  onClick={() =>
                    run("override", () =>
                      applyReviewDecision({
                        data: {
                          match_id: id,
                          action: "manual_override",
                          approved_score: Number(overrideScore),
                          reason,
                        },
                      }),
                    )
                  }
                >
                  Save
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded as a decision — the underlying score run stays immutable.
              </p>
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold">CV</h2>
            {cv ? (
              <div className="mt-2 text-sm">
                <div>{cv.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {cv.mime_type} · {(Number(cv.size ?? 0) / 1024).toFixed(0)} KB · OCR used:{" "}
                  {cv.ocr_used ? "yes" : "no"} · extractions: {cv.extraction_attempts}
                </div>
                {cv.signed_url && (
                  <a
                    href={cv.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-primary hover:underline"
                  >
                    Open CV (5 min link) →
                  </a>
                )}
                {cv.extracted_text && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm">Extracted text preview</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs bg-muted p-2 rounded">
                      {cv.extracted_text.slice(0, 2000)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No CV on file.</p>
            )}
          </section>

          {evidence && (
            <section className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Evidence snapshot</h2>
              <div className="mt-2 text-xs text-muted-foreground">
                engine {evidence.engine_version} · {new Date(evidence.created_at).toLocaleString()}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm">Structured payload</summary>
                <pre className="mt-2 max-h-64 overflow-auto text-xs bg-muted p-2 rounded">
                  {JSON.stringify(evidence.extracted, null, 2)}
                </pre>
              </details>
            </section>
          )}

          {decisions.length > 0 && (
            <section className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Decision history</h2>
              <ul className="mt-2 text-xs space-y-1">
                {decisions.map((d: any) => (
                  <li key={d.id}>
                    {new Date(d.created_at).toLocaleString()} · <strong>{d.decision_type}</strong>
                    {d.approved_score != null ? ` @ ${d.approved_score}` : ""} — {d.reason ?? "—"}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, pct }: { label: string; pct: number | null }) {
  const p = pct == null ? null : Math.round(pct * 100);
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{p == null ? "—" : `${p}%`}</div>
    </div>
  );
}
