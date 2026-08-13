import * as React from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DownloadLatestCvLink } from "@/components/download-cv-button";
import { ReviewTimelineStrip } from "@/components/client/candidates/review-timeline";
import { AgeBadge } from "@/components/client/age-badge";
import { formatDaysInStage } from "@/lib/time-age";
import { DecisionBar } from "@/components/client/decision-bar";
import { NextStepNote } from "@/components/client/next-step-note";
import { UndoWindow } from "@/components/client/undo-window";
import { fitChips } from "@/lib/client-evidence-bullets";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { EvidencedScore } from "@/components/client/score-ring";
import { buildShortlistRationale } from "@/lib/client-rationale";
import { deriveCardAssessment } from "@/lib/client/card-assessment-state";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { FitPresentation } from "@/lib/client-fit-presentation";

const ACCENT: Record<FitPresentation["accent"], { ring: string; chip: string; dot: string }> = {
  emerald: {
    ring: "ring-success/40",
    chip: "bg-success/10 text-success dark:text-success border-success/20",
    dot: "bg-success",
  },
  sky: {
    ring: "ring-info/40",
    chip: "bg-info/10 text-info dark:text-info border-info/20",
    dot: "bg-info",
  },
  amber: {
    ring: "ring-warning/40",
    chip: "bg-warning/10 text-warning-foreground dark:text-warning-foreground border-warning/20",
    dot: "bg-warning",
  },
  slate: {
    ring: "ring-muted-foreground/30",
    chip: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  rose: {
    ring: "ring-destructive/40",
    chip: "bg-destructive/10 text-destructive dark:text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
};

type Stage = ClientCandidateDTO["stage"];

function stageLabel(s: Stage): string {
  return (
    {
      delivered: "New — awaiting review",
      shortlisted: "Shortlisted",
      interview_process: "Interview process",
      offer: "Offer stage",
      hired: "Hired",
      not_moving_forward: "Not moving forward",
    } as const
  )[s];
}



export function CandidateCard({
  candidate,
  orgId: orgIdProp,
  compareSelected,
  compareDisabled,
  onToggleCompare,
}: {
  candidate: ClientCandidateDTO;
  /** Active workspace id. Falls back to the ?org search param when omitted. */
  orgId?: string | null;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (id: string) => void;
}) {
  const search = useSearch({ strict: false }) as { org?: string };
  const c = candidate;
  const accent = ACCENT[c.fit.accent];
  const rationale = React.useMemo(() => buildShortlistRationale(c), [c]);
  // Bullets come only from evidence a recruiter verified and marked shareable.
  const evidenceCard = c.evidence_card ?? { bullets: [], summaryInProgress: true, verifiedCount: 0 };
  const bullets = evidenceCard.bullets;
  const gaps = rationale.gaps;
  const chips = React.useMemo(() => fitChips(c), [c]);
  // Exactly one assessment state per card: settled, re-checking, or pending.
  const assessment = React.useMemo(
    () =>
      deriveCardAssessment({
        fitLabel: c.fit_label,
        score: c.score,
        evidenceBullets: bullets.length,
        support: c.evidence_support ?? null,
        freshness: c.freshness ?? null,
      }),
    [c.fit_label, c.score, bullets.length, c.evidence_support, c.freshness],
  );

  // The figure only renders through the evidenced-number contract.
  const evidencedFit =
    c.explanation?.kind === "explained" ? (c.explanation.number ?? null) : null;

  // Decision actions need the workspace id. The ?org param is only present when
  // a multi-workspace user is switching, so fall back to the active workspace.
  const orgId = orgIdProp ?? search.org ?? null;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card p-5 transition hover:shadow-md hover:border-primary/40 ${
        compareSelected ? `ring-2 ${accent.ring}` : ""
      }`}
    >
      {onToggleCompare && (
        <label className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={!!compareSelected}
            disabled={compareDisabled && !compareSelected}
            onCheckedChange={() => onToggleCompare(c.match_id)}
            aria-label={`Compare ${c.candidate.display_name}`}
            className="touch-target"
          />
          Compare
        </label>
      )}

      {/* Identity — full name, and exactly ONE assessment state */}
      <div className="min-w-0 pr-24">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-base truncate">{c.candidate.display_name}</h3>
          {assessment.state === "settled" ? (
            <>
              <CandidateScoreBadge
                fitLabel={c.fit_label}
                evidence={c.evidence_support}
                unicorn={c.unicorn}
              />
              {assessment.thin && (
                <span className="text-[11px] font-medium rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                  Limited evidence so far
                </span>
              )}
            </>
          ) : (
            <span
              className="text-[11px] font-medium rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground"
              title={assessment.note}
            >
              {assessment.state === "rechecking" ? "Being re-checked" : "Screening in progress"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{assessment.note}</p>
        {(c.candidate.headline || c.candidate.current_role) && (
          <p className="text-sm text-foreground/80 mt-0.5 line-clamp-1">
            {c.candidate.headline ??
              [c.candidate.current_role, c.candidate.current_company]
                .filter(Boolean)
                .join(" · ")}
          </p>
        )}
        {c.position?.title && (
          <p className="text-xs text-muted-foreground mt-1 truncate">For {c.position.title}</p>
        )}
      </div>

      {/* The figure, with the criteria behind it, the method and a way in. */}
      {assessment.state === "settled" && evidencedFit && (
        <EvidencedScore
          number={evidencedFit}
          accent={c.fit.accent}
          matchId={c.match_id}
          org={search.org ?? null}
          className="mt-3 rounded-lg border bg-muted/30 p-3"
        />
      )}



      {/* Why we shortlisted — one bullet per requirement, each attributed.
          When there is no write-up yet, the single state line above already
          says so; a second sentence here would only repeat it. */}
      {bullets.length > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Evidence against your requirements
            </div>
          </div>
          <ul className="mt-2 space-y-1.5">
            {bullets.map((b) => (
              <li key={b.id} className="flex gap-2 text-xs leading-snug">
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`}
                />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{b.requirement}</span>
                  {b.claim && <span className="text-muted-foreground"> — {b.claim}</span>}
                  <span className="ml-1 text-[10px] text-muted-foreground/80">[{b.where}]</span>
                </span>
              </li>
            ))}
          </ul>

        {gaps.length > 0 && (
          <p className="mt-2 text-xs text-warning-foreground line-clamp-2">
            Not evidenced yet: {gaps.slice(0, 2).map((g) => g.requirement).join(", ")}
          </p>
          )}
        </div>
      )}


      {/* Practical fit: availability, location, compensation */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                chip.tone === "good"
                  ? "border-success/20 bg-success/10 text-success"
                  : chip.tone === "watch"
                    ? "border-warning/20 bg-warning/10 text-warning-foreground"
                    : "border-border bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className="font-medium">{chip.label}</span>
              <span className="truncate max-w-[14rem]">{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Stage + clock */}
      <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground">
        <span>{stageLabel(c.stage)}</span>
        {c.stage_entered_at && (
          <span className="tabular-nums">· {formatDaysInStage(c.stage_entered_at)}</span>
        )}
        {c.stage === "delivered" && <AgeBadge since={c.delivered_at ?? c.stage_entered_at} />}
      </div>

      {/* One click each: Advance, Hold, Decline — all reversible */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="secondary" className="min-w-[5.5rem]">
          <Link
            to="/client/candidates/$id"
            params={{ id: c.match_id }}
            search={search.org ? { org: search.org } : undefined}
          >
            Review
          </Link>
        </Button>
        {orgId && (
          <DecisionBar
            orgId={orgId}
            matchId={c.match_id}
            stage={c.stage}
            candidateName={c.candidate.display_name}
            compact
          />
        )}
      </div>

      {/* Where this application stands, at a glance. */}
      <div className="mt-3">
        <ReviewTimelineStrip timeline={c.review_timeline} showLabels />
      </div>

      {/* One-click CV, only once contact details are released. */}
      {c.contact_released && (
        <div className="mt-2">
          <DownloadLatestCvLink matchId={c.match_id} />
        </div>
      )}

      {/* Every decision is reversible for a short window, visibly. */}
      <div className="mt-3">
        <UndoWindow orgId={orgId} matchId={c.match_id} candidateName={c.candidate.display_name} />
      </div>

      {/* A decision must never vanish: show what we do next, who owns it, when. */}
      <NextStepNote stage={c.stage} stageEnteredAt={c.stage_entered_at} className="mt-3" />
    </div>
  );
}
