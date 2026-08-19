import { CvDownloadAudit } from "@/components/cv-download-audit";
/**
 * Secondary tabs of the admin candidate workspace.
 *
 * These panels are heavy — CV rendering, the evidence graph, score explainability,
 * audit history — and none of them are on screen at first paint. They live here so
 * the route only ships the profile view up front and pulls each panel in when a
 * reviewer actually opens it.
 */
import { StructuredNotesPanel } from "@/components/admin/structured-notes-panel";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RecordActivityTab } from "@/components/admin/record-activity-tab";
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
import { AdminScoreNumber } from "@/components/admin/admin-score-number";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
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
  ChevronRight,
  Info,
} from "lucide-react";
import { FitHero, WhyWeShortlisted, RequirementCoverage, WhyThisCandidate, WhatNeedsValidation } from "@/components/client/candidate-detail/evidence";
import { ExperienceTimeline, SkillsAndEducation, AvailabilityPanel, ProfilePanel, LinksPanel } from "@/components/client/candidate-detail/profile";
import { ActivitySection } from "@/components/client/candidate-detail/activity";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

import {
  safeNode,
  toReqText,
  cleanLine,
  Row,
} from "@/components/admin/candidate-detail/primitives";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";


// ── CV & parsed ────────────────────────────────────────────────────────────
export function CvTab({ cv, matchId, cp, insights }: { cv: Any; matchId: string; cp: Any; insights: Any }) {
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Check what was read from this CV beside the original document, field by field.
        </span>
        <Link
          to="/admin/candidates/$id/parse"
          params={{ id: matchId }}
          className="font-medium underline underline-offset-2"
        >
          Open parse review
        </Link>
      </div>

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
            <Row label="Extracted" v={cv.extraction_completed_at ? new Date(cv.extraction_completed_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }) : "—"} />
          </dl>
        </aside>
      </div>
    </div>
  );
}

// ── Enrichment ─────────────────────────────────────────────────────────────
export function EnrichmentTab({ cp, evidence }: { cp: Any; evidence: Any }) {
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
            <span>{new Date(evidence.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Evidence ───────────────────────────────────────────────────────────────
export function EvidenceTab({
  evidence,
  result,
  matchId,
}: {
  evidence: Any;
  result: Any;
  matchId: string;
}) {
  const items = result?.requirement_assessment ?? result?.evidence ?? [];
  const llmVerdicts: Any[] = Array.isArray(evidence?.extracted?.insights?.requirement_verdicts)
    ? evidence.extracted.insights.requirement_verdicts
    : [];
  const contradictions = result?.contradiction_status && result.contradiction_status !== "none"
    ? result.contradiction_status
    : null;

  // Evidence items carry the verbatim passages, reviewer status and any stored
  // confidence. Failure here degrades the graph, it does not break the tab.
  const { data: evidenceItems } = useQuery({
    queryKey: ["admin-evidence-items", matchId],
    queryFn: () => listAdminEvidence({ data: { matchId } }),
    retry: false,
  });

  const chain = useMemo(
    () =>
      buildEvidenceChain({
        assessment: result?.requirement_assessment ?? null,
        verdicts: llmVerdicts,
        items: (evidenceItems ?? []) as Any[],
      }),
    [result?.requirement_assessment, llmVerdicts, evidenceItems],
  );

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

      <EvidenceCompletenessGate matchId={matchId} />


      <EvidenceGraph
        nodes={chain.nodes}
        meta={chain.meta}
        variant="full"
        idPrefix="admin-evidence-graph"
        title="Evidence graph"
        description="Follow one requirement from the evidence found, through the source passage and the rule applied, to the points it moved and what it means for the decision."
      />



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
                      <code className="opacity-60">
                        {typeof e.location === 'string' 
                          ? e.location.replace(/^cv:(\d+)-(\d+)$/, 'CV · characters $1–$2') 
                          : (e.source ?? "")}
                      </code>
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
export function ScoreTab({
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
            engine {currentRun.engine_version} · {currentRun.completed_at ? new Date(currentRun.completed_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }) : "—"}
          </span>
        </div>
        {/* Staff-only number: always with its confidence and rubric version. */}
        <AdminScoreNumber run={currentRun} size="lg" className="mt-4" />
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
export function ScreeningTab({ result, evidence }: { result: Any; evidence: Any }) {
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
                      {safeNode(s.normalized_value || s.answer) ?? "—"}
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
            const val = safeNode(a.value) ?? "—";
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
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{safeNode(llm.candidate_answer) || "—"}</div>
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
export function HistoryTab({
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
                {r.completed_at ? new Date(r.completed_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }) : "—"}{" "}
                <code className="opacity-60">{r.engine_version}</code>{" "}
                <span className="ml-1 text-muted-foreground">{r.status}</span>
              </span>
              <AdminScoreNumber run={r} />
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
                  {j.created_at ? new Date(j.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }) : ""}
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
                  {new Date(d.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}{" "}
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
export function PreviewTab({ matchId, match: m }: { matchId: string; match?: Any }) {
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
  if (!data) {
    const isApproved = m?.admin_status === "approved";
    const isVisible = m?.client_visibility === "visible";
    
    let message = "No client-visible data yet. The candidate is still internal.";
    if (isApproved && !isVisible) {
      message = "Candidate is approved but Hidden. Publish them to populate the client view.";
    } else if (isApproved && isVisible) {
      message = "Generating preview... (the record exists but the DTO failed to assemble)";
    }

    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        {message}
      </div>
    );
  }
  const dto = (data as Any).candidate;
  const interviews = (data as Any).interviews ?? [];
  const decisions = (data as Any).decisions ?? [];

  return (
    <div className="space-y-6">
      <Alert className="taas-bg-info-soft border-info/20">
        <Eye className="h-4 w-4 taas-tx-info" />
        <AlertDescription className="text-xs text-info/80">
          This is an exact preview of what the client sees in their workspace.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border bg-background p-6 shadow-sm">
        <FitHero candidate={dto} />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <WhyWeShortlisted candidate={dto} />
            <RequirementCoverage candidate={dto} />
            <WhyThisCandidate candidate={dto} />
            <WhatNeedsValidation candidate={dto} />
            <ExperienceTimeline candidate={dto} />
            <SkillsAndEducation candidate={dto} />
          </div>
          <aside className="space-y-6 lg:col-span-4">
            <AvailabilityPanel candidate={dto} />
            <ProfilePanel candidate={dto} />
            <LinksPanel candidate={dto} />
            {interviews.length > 0 && (
              <ActivitySection interviews={interviews} decisions={decisions} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Activity & audit ───────────────────────────────────────────────────────
export function ActivityAuditTab({
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
    <div className="space-y-4">
      {/* The audited record changes, paginated so the whole history is reachable. */}
      <RecordActivityTab entity="candidate" id={matchId} title="Record audit" />

      {/* Every signed CV link issued for this candidate: who, when, which side. */}
      <CvDownloadAudit matchId={matchId} title="CV download audit trail" limit={50} />


    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Decisions &amp; role events — match #{matchId.slice(0, 8)} · record changes, decisions and role
        events
      </div>
      <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        Decisions taken on this candidate, interleaved with changes to the surrounding role.
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
                  <Badge
                    variant={
                      e.kind === "decision" ? "default" : e.kind === "record" ? "secondary" : "outline"
                    }
                  >
                    {e.kind}
                  </Badge>
                  <span className="font-mono text-xs">{e.label}</span>
                </div>
                {e.detail && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div>{new Date(e.when).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}</div>
                {e.trace && <div className="font-mono text-[10px]">{e.trace}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}


// ── Action rail (all lifecycle actions in one place) ───────────────────────
export function JourneyTab({ matchId }: { matchId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["candidate-journey", matchId],
    queryFn: () => getCandidateJourney({ data: { candidateMatchId: matchId } }),
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading timeline…</div>;
  if (isError)
    return (
      <ErrorState
        title="We couldn't load the journey"
        description="The timeline didn't come back. Nothing is lost — try again."
        onRetry={() => void refetch()}
      />
    );
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

