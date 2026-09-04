import { formatEnumLabel, sanitizeInternalMarkers } from "@/lib/human-labels";
import { memo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { presentEvidenceList } from "@/lib/evidence/evidence-presentation";
import { renderQuote } from "@/lib/evidence/quote-hygiene";

import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { buildShortlistRationale } from "@/lib/client-rationale";
import { buildValidationList, type ValidationItem } from "@/lib/client/validation-list";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type {
  FitPresentation,
  RequirementRow,
  RequirementStatus,
} from "@/lib/client-fit-presentation";
import { SectionCard } from "./shared";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate, formatDateTime } from "@/lib/format/datetime";
import { getEvidenceCounts, type EvidenceCounts } from "@/lib/client/evidence-counts";
import { requirementStatusLabel, resolveRequirementStatus } from "@/lib/client/requirement-status";


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
        label: requirementStatusLabel(status),
        aria: requirementStatusLabel(status),
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
  const pretty = (s: string) => formatEnumLabel(s);
  return (
    <section
      aria-labelledby="evaluation-heading"
      className="hidden rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3
          id="evaluation-heading"
          className="text-sm font-semibold tracking-tight"
        >
          How this score was built
        </h3>
        {/* Engine/run identifiers are internal provenance, not client copy. */}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every category is grounded in verbatim CV evidence and screening
        answers. Nothing is inferred. Each evaluation is versioned and
        preserved — Re-scoring adds a new result; the old one is kept.
      </p>

      {ev.contradiction && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Conflicting signals found
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {/* Already a complete human sentence naming the pair — never an
                enum plus boilerplate (audit #3, finding 2). */}
            {ev.contradiction}
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
                        · weighting {Math.round(c.weight * 100)}%
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
          {formatDateTime(ev.completed_at)}
        </p>
      )}
    </section>
  );
});

function coverageVerdictLine(counts: EvidenceCounts): string | null {
  if (counts.total === 0) return null;
  const { met, partial, unknown, total } = counts;
  if (met === total) {
    return `Scored against your ${total} requirements — all are fully evidenced.`;
  }
  if (partial === total) {
    return `Scored against your ${total} requirements — every one shows supporting signals; direct quotes are still being attached.`;
  }
  if (unknown === total) {
    return `Scored against your ${total} requirements — none show evidence yet.`;
  }
  const chunks: string[] = [];
  if (met > 0) chunks.push(`${met} fully met`);
  if (partial > 0) chunks.push(`${partial} partly evidenced`);
  if (unknown > 0) chunks.push(`${unknown} not evidenced`);
  // Conflicted rows count toward the total, so they must appear in the
  // sentence — the parts once summed to 8 of "your 10 requirements" (S-18).
  if (counts.contradicted > 0) chunks.push(`${counts.contradicted} in conflict`);
  return `Scored against your ${total} requirements — ${chunks.join(" · ")}.`;
}

export const FitHero = memo(function FitHero({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const fit = candidate.fit;
  // Once a candidate is hired or no longer moving forward, a recommendation to
  // interview is stale advice — the decision is already made.
  // The stage is stated once, as the chip beside the candidate's name. A decided
  // candidate therefore shows no recommendation line here rather than repeating
  // it, and stale advice ("interview them") is never shown after a decision.
  const decided =
    candidate.stage === "hired" || candidate.stage === "not_moving_forward";
  const recommendation = decided ? null : fit.recommendation;
  const ring = accentToRing(fit.accent);
  const bg = accentToSoftBg(fit.accent);

  // No completed assessment — say so. Rendering the fallback band here once
  // labelled every unpublished candidate "Consider", including one whose real
  // verdict was a dealbreaker cap.
  if (!fit.assessed) {
    return (
      <section
        aria-labelledby="fit-heading"
        className="rounded-xl border bg-muted/30 p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Fit for {candidate.position?.title ?? "this role"}
        </div>
        <h2 id="fit-heading" className="mt-3 text-2xl font-semibold tracking-tight">
          Assessment in review
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          We're finishing this candidate's assessment. The fit verdict and its
          supporting evidence appear here once our team approves it.
        </p>
        {candidate.summary && (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            {candidate.summary}
          </p>
        )}
      </section>
    );
  }
  // The fit ring that used to live here was disabled with `{false && …}` and
  // left in place: 33 lines of unreachable SVG, plus the arc maths and the
  // `accentToRing` lookup feeding it. Removed with its dead inputs — the band
  // is stated in words directly above, which is what the employer reads.
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
          {candidate.score != null ? (
            <div className="mt-3">
              <div className="text-5xl font-semibold tracking-tight tabular-nums">
                {Math.round(candidate.score)}
                {/* A literal space as well as the margin: copied text and
                    screen readers read "77out of 100" without it. */}{" "}
                <span className="ml-1.5 text-lg font-medium text-muted-foreground">
                  out of 100
                </span>
              </div>
              <h2 id="fit-heading" className="mt-1 text-2xl font-semibold tracking-tight">
                {fit.headline}
              </h2>
              {recommendation && (
                <p className={cn("mt-0.5 text-sm font-medium", ring.text)}>
                  {recommendation}
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 id="fit-heading" className="mt-1 text-2xl font-semibold tracking-tight">
                {fit.headline}
              </h2>
              {recommendation && (
                <p className={cn("mt-0.5 text-sm font-medium", ring.text)}>
                  {recommendation}
                </p>
              )}
            </>
          )}
          {(() => {
            const line = coverageVerdictLine(getEvidenceCounts(candidate.requirement_rows));
            return line ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {line}
              </p>
            ) : null;
          })()}
          {candidate.summary && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {candidate.summary}
            </p>
          )}
          {candidate.last_updated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Scored {formatDate((candidate.last_updated))}
            </p>
          )}
        </div>
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
      // Stage-neutral: this card renders for every delivered candidate, most
      // of whom are not shortlisted (audit S-23).
      title="Why this candidate stands out"
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
            ) : l.underReview ? (
              <p className="mt-1 text-sm text-muted-foreground italic">
                Evidence under review
              </p>
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

/** Text identity for dedupe: case, punctuation and ellipsis insensitive. */
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\u2026]|\.\.\./g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when the two lines say the same thing, or one is a slice of the other. */
function saysTheSame(a: string | null, b: string | null): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export const RequirementRowView = memo(function RequirementRowView({

  row,
  claim = null,
}: {
  row: RequirementRow;
  /** Optional shortlist-rationale claim, shown as one line inside this row. */
  claim?: string | null;
})  {
  // Render-time safety: an unresolved requirement reads as "Not evidenced",
  // never as work in progress.
  const status = resolveRequirementStatus(row);
  const badge = statusBadge(status);
  // Presentation hygiene: identical and near-identical snippets collapse to
  // one, nothing repeats the summary line above, and a quote that survives as
  // a broken fragment is not shown at all.
  // Both of these are CV-derived and were rendered raw, so character-offset
  // slices reached the client as debris — "TORY Lead Full-Stack Engineer"
  // (cut out of HISTORY), "NGUAGES - Portuguese" (out of LANGUAGES). The
  // quotes inside "Show evidence" were already cleaned; these two lines, which
  // are the ones actually read, were not. Same helper, same treatment.
  const safeExplanation = renderQuote(row.explanation) || null;
  const safeClaim = renderQuote(claim) || null;
  // The claim is NOT in the exclusion list: suppressing a quote for restating
  // the rationale made "Show evidence (2)" in Requirement coverage and
  // "Show evidence (1)" in Why this candidate for the same requirement
  // (audit S-22). A quote matching the claim is verbatim corroboration —
  // it renders with its Verified tag; only the explanation line dedupes.
  // ONE line per requirement, and no expander.
  //
  // The row used to show a summary line and, beneath it, a "Show evidence"
  // dropdown containing the same sentence again with a source label. Every
  // requirement on the page repeated itself, and the two never reliably
  // deduped against each other because they arrive from different places and
  // are trimmed differently.
  //
  // Rather than keep tuning a text comparison, the row now states the evidence
  // once. The summary is preferred when the requirement carries one; otherwise
  // the strongest quote stands in, so a row is never left blank.
  const evidence = presentEvidenceList(row.evidence, []);
  const shownExplanation = safeExplanation ?? evidence[0]?.quote ?? null;

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
          {shownExplanation && (
            <p className="mt-1 text-sm text-muted-foreground">{shownExplanation}</p>
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
      {safeClaim && !saysTheSame(safeClaim, shownExplanation) && (
        <p className="mt-2 text-sm text-foreground/90">{safeClaim}</p>
      )}

      {evidence.length === 0 && !shownExplanation && status === "not_evidenced" && (
        <p className="mt-2 text-sm text-muted-foreground italic">
          Not evidenced in this candidate's record.
        </p>
      )}
    </li>
  );
});

export const RequirementCoverage = memo(function RequirementCoverage({
  candidate,
  withRationale = false,
}: {
  candidate: ClientCandidateDTO;
  /** Folds the "why we shortlisted" summary into this single requirement list. */
  withRationale?: boolean;
}) {
  const { requirement_rows } = candidate;
  if (requirement_rows.length === 0) return null;
  const rationale = withRationale ? buildShortlistRationale(candidate) : null;
  return (
    <SectionCard
      title="Requirement coverage"
      icon={<CheckCircle2 className="h-4 w-4" />}
      description="Every declared role requirement, mapped to the evidence we found."
    >
      {rationale && rationale.lines.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">{rationale.summary}</p>
      )}
      <div className="mt-4">
        {(() => {
          // The progress bar and the label must share the same percentage:
          // requirements with a direct quoted passage, over all declared
          // requirements. Related-only signals are shown separately.
          const counts = getEvidenceCounts(requirement_rows);
          const total = counts.total;
          const quoted = counts.quoted;
          const pct = total > 0 ? Math.round((quoted / total) * 100) : 0;
          return (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Requirements with a quoted passage</span>
                <span className="tabular-nums">
                  {quoted} of {total} · {pct}%
                </span>
              </div>
              <Progress value={pct} className="mt-1" />
              {/* This counts whether a passage was FOUND; the line above counts
                  how far each requirement was MET. A partly-evidenced
                  requirement still has a quote, so "9 fully met · 1 partly
                  evidenced" sitting above "10 of 10" is not a contradiction —
                  but nothing said so, and it read as one (launch pass, 2 Sep). */}
              {quoted === total && counts.met < total && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Every requirement has a supporting quote. How fully each one is met is
                  the separate figure above.
                </p>
              )}
            </>
          );
        })()}
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
  withCoverage = false,
}: {
  candidate: ClientCandidateDTO;
  /** Folds the Requirement coverage figures into this single evidence panel. */
  withCoverage?: boolean;
}) {
  const rationale = buildShortlistRationale(candidate);
  const roleTitle = candidate.position?.title ?? null;
  // One row per declared requirement, must-haves first — the same rows the
  // comparison grid and score breakdown read.
  const rows = [...candidate.requirement_rows].sort((a, b) =>
    a.importance === b.importance ? 0 : a.importance === "must_have" ? -1 : 1,
  );
  if (rows.length === 0) return null;
  // A rationale claim, where one exists, is shown inside its requirement's row.
  const claimByKey = new Map<string, string>();
  for (const l of rationale.lines) {
    if (!l.claim) continue;
    claimByKey.set(l.id, l.claim);
    claimByKey.set(l.requirement.trim().toLowerCase(), l.claim);
  }


  const counts = getEvidenceCounts(candidate.requirement_rows);

  return (
    <SectionCard
      title={roleTitle ? `Why this candidate for ${roleTitle}` : "Why this candidate"}
      icon={<Sparkles className="h-4 w-4" />}
      description="Each of your requirements, what the candidate showed for it, and where that came from."
    >
      {/* The band and figure are stated once, in the fit hero above. */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{rationale.summary}</span>
      </div>


      {withCoverage && counts.total > 0 && (
        <div className="mt-4">
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Requirement coverage: ${counts.met} fully met, ${counts.partial} partly evidenced, ${counts.unknown} not evidenced`}
          >
            {counts.met > 0 && (
              <div
                className="h-full taas-bg-success-solid"
                style={{ width: `${(counts.met / counts.total) * 100}%` }}
              />
            )}
            {counts.partial > 0 && (
              <div
                className="h-full taas-bg-warning-solid"
                style={{ width: `${(counts.partial / counts.total) * 100}%` }}
              />
            )}
            {counts.unknown > 0 && (
              <div
                className="h-full taas-bg-neutral-solid"
                style={{ width: `${(counts.unknown / counts.total) * 100}%` }}
              />
            )}
          </div>
          {/* The coverage figures are stated once, on the fit card above. */}
          <Separator className="mt-4" />
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <RequirementRowView
            key={row.id}
            row={row}
            claim={
              claimByKey.get(row.id) ??
              claimByKey.get(row.label.trim().toLowerCase()) ??
              null
            }
          />
        ))}
      </ul>

    </SectionCard>
  );
});


export const WhatNeedsValidation = memo(function WhatNeedsValidation({
  candidate,
  title = "What needs validation",
  preferredLimit = Infinity,
  onInterviewGuideClick,
}: {
  candidate: ClientCandidateDTO;
  title?: string;
  preferredLimit?: number;
  onInterviewGuideClick?: () => void;
}) {
  // Every hook runs before any early return. `useState` used to sit BELOW the
  // guard, so the render where a candidate became hired (or ran out of
  // validation items) called fewer hooks than the render before it — React
  // throws "Rendered fewer hooks than expected" and the client's candidate
  // page white-screens at the exact moment they hire someone.
  const [showAll, setShowAll] = useState(false);

  // Derived from the same coverage statuses rendered by RequirementCoverage, so
  // a badge and its validation sentence can never disagree.
  const items = buildValidationList(candidate.requirement_rows, candidate.concerns);
  // Once the hiring decision is made, "confirm before a hiring decision" is
  // stale advice — hide the section for hired candidates.
  if (items.length === 0 || candidate.stage === "hired") return null;

  const rowById = new Map(candidate.requirement_rows.map((r) => [r.id, r]));
  const isMustHave = (item: ValidationItem) => {
    const label = item.label;
    if (!label) return false;
    const row =
      rowById.get(item.id) ??
      candidate.requirement_rows.find(
        (r) => r.label.trim().toLowerCase() === label.trim().toLowerCase(),
      );
    return row?.importance === "must_have";
  };

  const notes = items.filter((i) => i.label == null);
  const reqItems = items.filter((i) => i.label != null);
  const mustItems = reqItems.filter(isMustHave);
  const preferredItems = reqItems.filter((i) => !isMustHave(i));
  const visiblePreferred = showAll ? preferredItems : preferredItems.slice(0, preferredLimit);
  const hiddenPreferredCount = preferredItems.length - visiblePreferred.length;
  const visibleItems = [...notes, ...mustItems, ...visiblePreferred];

  return (
    <SectionCard
      title={title}
      icon={<Info className="h-4 w-4" />}
      description="Areas to confirm during the interview before a hiring decision."
    >
      <ul className="space-y-2">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-2 rounded-md border p-3 text-sm",
              item.tone === "warning"
                ? "taas-bd-warning taas-bg-warning-soft"
                : "bg-muted/30",
            )}
          >
            <Info
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.tone === "warning" ? "taas-fg-warning" : "text-muted-foreground",
              )}
              aria-hidden
            />
            <span>
              {item.label ? (
                <>
                  <strong className="font-medium">{item.label}</strong> — {item.sentence}
                </>
              ) : (
                item.sentence
              )}
            </span>
          </li>
        ))}
      </ul>

      {hiddenPreferredCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Show all ({preferredItems.length})
        </button>
      )}

      {onInterviewGuideClick && (
        <button
          type="button"
          onClick={onInterviewGuideClick}
          className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          See interview question guide →
        </button>
      )}
    </SectionCard>
  );
});

