import { memo } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { buildShortlistRationale } from "@/lib/client-rationale";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type {
  FitPresentation,
  RequirementRow,
  RequirementStatus,
} from "@/lib/client-fit-presentation";
import { SectionCard, Metric } from "./shared";

export function statusBadge(status: RequirementStatus) {
  switch (status) {
    case "met":
      return {
        label: "Met",
        aria: "Met",
        icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
        className: "taas-bg-success-soft taas-fg-success ",
      };
    case "partial":
      return {
        label: "Partial",
        aria: "Partially met",
        icon: <Info className="h-3 w-3" aria-hidden />,
        className: "taas-bg-warning-soft taas-fg-warning ",
      };
    case "contradicted":
      return {
        label: "Conflict",
        aria: "Contradicted",
        icon: <XCircle className="h-3 w-3" aria-hidden />,
        className: "taas-bg-danger-soft taas-fg-danger ",
      };
    case "not_applicable":
      return {
        label: "N/A",
        aria: "Not applicable",
        icon: <Info className="h-3 w-3" aria-hidden />,
        className: "taas-bg-neutral-soft taas-fg-neutral ",
      };
    default:
      return {
        label: "Not evidenced",
        aria: "Not evidenced",
        icon: <Info className="h-3 w-3" aria-hidden />,
        className: "taas-bg-neutral-soft taas-fg-neutral ",
      };
  }
}

export function accentToRing(accent: FitPresentation["accent"]) {
  switch (accent) {
    case "emerald":
      return { text: "taas-fg-success ", stroke: "taas-fg-success" };
    case "sky":
      return { text: "taas-fg-info ", stroke: "taas-fg-info" };
    case "amber":
      return { text: "taas-fg-warning ", stroke: "taas-fg-warning" };
    case "rose":
      return { text: "taas-fg-danger ", stroke: "taas-fg-danger" };
    default:
      return { text: "taas-fg-neutral ", stroke: "taas-fg-neutral" };
  }
}

export function accentToSoftBg(accent: FitPresentation["accent"]) {
  switch (accent) {
    case "emerald":
      return "taas-bg-success-soft";
    case "sky":
      return "taas-bg-info-soft";
    case "amber":
      return "taas-bg-warning-soft";
    case "rose":
      return "taas-bg-danger-soft";
    default:
      return "bg-muted/30";
  }
}

export const EvaluationProvenance = memo(function EvaluationProvenance({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const ev = candidate.evaluation;
  const anyValue = ev.category_breakdown.some((c) => c.value != null);
  if (!ev.engine_version && !ev.contradiction && !anyValue) return null;
  const pretty = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <section
      aria-labelledby="evaluation-heading"
      className="rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3
          id="evaluation-heading"
          className="text-sm font-semibold tracking-tight"
        >
          How this score was built
        </h3>
        {ev.engine_version && (
          <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
            {ev.engine_version}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every category is grounded in verbatim CV evidence and screening
        answers. Nothing is inferred. Each evaluation is versioned and
        preserved — a rescore appends a new run, never edits the old one.
      </p>

      {ev.contradiction && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Conflicting signals found
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {pretty(ev.contradiction)} — flagged in evidence review before this
            candidate was delivered to your workspace.
          </p>
        </div>
      )}

      {anyValue && (
        <div className="mt-4 space-y-2.5">
          {ev.category_breakdown.map((c) => {
            const pct =
              c.value == null
                ? null
                : Math.max(0, Math.min(100, Math.round(c.value * 100)));
            return (
              <div key={c.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">
                    {c.label}
                    {c.weight != null && (
                      <span className="ml-2 text-muted-foreground">
                        · weight {Math.round(c.weight * 100)}%
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {pct == null ? "—" : `${pct}%`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${pct ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ev.completed_at && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Evaluation completed{" "}
          {new Date(ev.completed_at).toLocaleString()}
        </p>
      )}
    </section>
  );
});

export const FitHero = memo(function FitHero({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const fit = candidate.fit;
  const score = candidate.score;
  const ring = accentToRing(fit.accent);
  const bg = accentToSoftBg(fit.accent);
  const dashArray = 251.2; // 2π·40
  const dashOffset = score != null ? dashArray * (1 - score / 100) : dashArray;

  return (
    <section
      aria-labelledby="fit-heading"
      className={cn("rounded-xl border p-5 sm:p-6", bg)}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Fit for {candidate.position?.title ?? "this role"}
          </div>
          <h2 id="fit-heading" className="mt-1 text-2xl font-semibold tracking-tight">
            {fit.headline}
          </h2>
          <p className={cn("mt-0.5 text-sm font-medium", ring.text)}>
            {fit.recommendation}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Role-specific fit. This candidate carries no global rating.
          </p>
          {candidate.summary && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {candidate.summary}
            </p>
          )}
          {candidate.last_updated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Scored {new Date(candidate.last_updated).toLocaleDateString()}
            </p>
          )}
        </div>
        {score != null && (
          <div className="flex items-center gap-4">
            <div
              role="img"
              aria-label={`Fit for this role: ${fit.headline} — ${fit.recommendation}`}
              className="relative"
            >
              <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
                <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  className={ring.stroke}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 48 48)"
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                <span className="text-xs font-semibold leading-tight">
                  {fit.headline}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  fit
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export const WhyWeShortlisted = memo(function WhyWeShortlisted({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const rationale = buildShortlistRationale(candidate);
  if (rationale.lines.length === 0) return null;
  const tone: Record<string, string> = {
    met: "border-success/30 bg-success/5",
    partial: "border-warning/30 bg-warning/5",
    gap: "border-border bg-muted/30",
    not_applicable: "border-border bg-muted/20",
  };
  return (
    <SectionCard
      title="Why we shortlisted"
      icon={<CheckCircle2 className="h-4 w-4" />}
      description="One line for every requirement you gave us at intake, with the source of each claim."
    >
      <p className="text-xs text-muted-foreground">{rationale.summary}</p>
      <ul className="mt-3 space-y-2">
        {rationale.lines.map((l) => (
          <li key={l.id} className={`rounded-md border p-3 ${tone[l.verdict]}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{l.requirement}</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {l.importance === "must_have" ? "Must-have" : "Preferred"}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{l.verdictLabel}</span>
            </div>
            {l.claim ? (
              <p className="mt-1 text-sm text-muted-foreground">{l.claim}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground italic">
                No evidence captured for this yet — we will not claim it.
              </p>
            )}
            {l.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.sources.map((src) => (
                  <span
                    key={src}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    Source: {src}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
});

export const RequirementRowView = memo(function RequirementRowView({
  row,
}: {
  row: RequirementRow;
}) {
  const badge = statusBadge(row.status);
  return (
    <li className="rounded-md border bg-background/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.label}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {row.importance === "must_have" ? "Must-have" : "Preferred"}
            </Badge>
          </div>
          {row.explanation && (
            <p className="mt-1 text-sm text-muted-foreground">{row.explanation}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            badge.className,
          )}
          aria-label={badge.aria}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>
      {row.evidence.length > 0 && (
        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="evidence" className="border-none">
            <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
              Show evidence ({row.evidence.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="mt-1 space-y-2 border-l-2 border-muted pl-3 text-sm">
                {row.evidence.map((e, i) => (
                  <li key={i}>
                    {e.source && (
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {e.source}
                      </div>
                    )}
                    <div className="text-foreground/90">{e.snippet}</div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </li>
  );
});

export const RequirementCoverage = memo(function RequirementCoverage({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const { coverage, requirement_rows } = candidate;
  if (requirement_rows.length === 0) return null;
  return (
    <SectionCard
      title="Requirement coverage"
      icon={<CheckCircle2 className="h-4 w-4" />}
      description="Every declared role requirement, mapped to the evidence we found."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Must-have met" value={`${coverage.must_met}/${coverage.must_total || "—"}`} tone="emerald" />
        <Metric label="Partially met" value={coverage.must_partial} tone="amber" />
        <Metric label="Not evidenced" value={coverage.must_missing} tone="slate" />
        <Metric label="Preferred met" value={`${coverage.preferred_met}/${coverage.preferred_total || "—"}`} tone="sky" />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall coverage</span>
          <span className="tabular-nums">{coverage.overall_pct}%</span>
        </div>
        <Progress value={coverage.overall_pct} className="mt-1" />
      </div>
      <Separator className="my-4" />
      <ul className="space-y-2">
        {requirement_rows.map((r) => (
          <RequirementRowView key={r.id} row={r} />
        ))}
      </ul>
    </SectionCard>
  );
});

export const WhyThisCandidate = memo(function WhyThisCandidate({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  if (candidate.strengths.length === 0) return null;
  return (
    <SectionCard
      title="Why this candidate"
      icon={<Sparkles className="h-4 w-4" />}
      description="The strongest verified reasons to consider this candidate for the role."
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {candidate.strengths.map((s, i) => (
          <li key={i} className="rounded-md border taas-bd-success taas-bg-success-soft p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 taas-fg-success" aria-hidden />
              <span className="text-sm">{s}</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
});

export const WhatNeedsValidation = memo(function WhatNeedsValidation({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const concerns = candidate.concerns;
  const partial = candidate.requirement_rows.filter(
    (r) => r.status === "partial" || r.status === "not_evidenced" || r.status === "contradicted",
  );
  if (concerns.length === 0 && partial.length === 0) return null;
  return (
    <SectionCard
      title="What needs validation"
      icon={<Info className="h-4 w-4" />}
      description="Areas to confirm during the interview before a hiring decision."
    >
      <ul className="space-y-2">
        {concerns.map((c, i) => (
          <li key={`c-${i}`} className="flex items-start gap-2 rounded-md border taas-bd-warning taas-bg-warning-soft p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning" aria-hidden />
            <span>{c}</span>
          </li>
        ))}
        {partial.slice(0, 4).map((r) => (
          <li key={r.id} className="flex items-start gap-2 rounded-md border taas-bd-warning taas-bg-warning-soft p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning" aria-hidden />
            <span>
              <strong className="font-medium">{r.label}</strong> —{" "}
              {r.status === "partial"
                ? "partially evidenced; confirm depth in the interview."
                : r.status === "contradicted"
                ? "the evidence conflicts; ask the candidate to clarify."
                : "no supporting evidence found; validate directly."}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
});
