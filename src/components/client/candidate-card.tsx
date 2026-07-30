import * as React from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AgeBadge } from "@/components/client/age-badge";
import { formatDaysInStage } from "@/lib/time-age";
import { DecisionBar } from "@/components/client/decision-bar";
import { fitChips } from "@/lib/client-evidence-bullets";
import { buildShortlistRationale } from "@/lib/client-rationale";
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

/** The single forward move available from this stage. */
function advanceStep(s: Stage): { to: Stage; label: string } | null {
  return (
    {
      delivered: { to: "shortlisted", label: "Advance" },
      shortlisted: { to: "interview_process", label: "Advance" },
      interview_process: { to: "offer", label: "Advance" },
      offer: { to: "hired", label: "Advance" },
      hired: null,
      not_moving_forward: { to: "shortlisted", label: "Reopen" },
    } as const
  )[s];
}

function advanceMeaning(s: Stage): string {
  return (
    {
      delivered: "Adds them to your shortlist.",
      shortlisted: "Starts the interview process.",
      interview_process: "Moves them to offer stage.",
      offer: "Marks them as hired.",
      hired: "",
      not_moving_forward: "Puts them back on your shortlist.",
    } as const
  )[s];
}

export function CandidateCard({
  candidate,
  compareSelected,
  compareDisabled,
  onToggleCompare,
}: {
  candidate: ClientCandidateDTO;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (id: string) => void;
}) {
  const search = useSearch({ strict: false }) as { org?: string };
  const c = candidate;
  const accent = ACCENT[c.fit.accent];
  const rationale = React.useMemo(() => buildShortlistRationale(c), [c]);
  const bullets = rationale.evidenced.slice(0, 3);
  const gaps = rationale.gaps;
  const chips = React.useMemo(() => fitChips(c), [c]);

  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirmAction();
  const move = useServerFn(moveMatchStage);
  const [busy, setBusy] = React.useState<null | "advance" | "decline">(null);

  const orgId = search.org ?? null;
  const advance = advanceStep(c.stage);
  const canDecline = c.stage !== "hired" && c.stage !== "not_moving_forward";
  const showActions = !!orgId;

  async function runMove(kind: "advance" | "decline", to: Stage, reason?: string) {
    if (!orgId) return;
    setBusy(kind);
    try {
      await move({ data: { orgId, matchId: c.match_id, toStage: to, reason } });
      toast.success(kind === "advance" ? "Candidate advanced" : "Candidate declined");
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("reason_required")
          ? "A short reason is required to decline."
          : "We couldn't save that decision. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

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
          />
          Compare
        </label>
      )}

      {/* Identity — qualitative outcome only, never a score */}
      <div className="min-w-0 pr-24">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-base truncate">{c.candidate.display_name}</h3>
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${accent.chip}`}>
            {c.fit.headline}
          </span>
        </div>
        {c.candidate.headline && (
          <p className="text-sm text-foreground/80 mt-0.5 line-clamp-1">{c.candidate.headline}</p>
        )}
        {c.position?.title && (
          <p className="text-xs text-muted-foreground mt-1 truncate">For {c.position.title}</p>
        )}
      </div>

      {/* Why we shortlisted — one bullet per requirement, each attributed */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Why we shortlisted
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">{rationale.summary}</div>
        </div>
        {bullets.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {bullets.map((b) => (
              <li key={b.id} className="flex gap-2 text-xs leading-snug">
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    b.verdict === "met" ? accent.dot : "bg-muted-foreground/50"
                  }`}
                />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{b.requirement}</span>
                  {b.verdict === "partial" && (
                    <span className="text-muted-foreground"> (partly)</span>
                  )}
                  <span className="text-muted-foreground"> — {b.claim}</span>
                  {b.sources.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground/80">
                      [{b.sources.join(" · ")}]
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            We haven't evidenced your requirements for this candidate yet.
          </p>
        )}
        {gaps.length > 0 && (
          <p className="mt-2 text-xs text-warning-foreground line-clamp-2">
            Not evidenced yet: {gaps.slice(0, 2).map((g) => g.requirement).join(", ")}
          </p>
        )}
      </div>

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

    </div>
  );
}
