import { Link, useSearch } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { FitPresentation } from "@/lib/client-fit-presentation";

const ACCENT: Record<FitPresentation["accent"], { ring: string; chip: string; bar: string; dot: string }> = {
  emerald: {
    ring: "ring-success/40",
    chip: "bg-success/10 text-success dark:text-success border-success/20",
    bar: "bg-success",
    dot: "bg-success",
  },
  sky: {
    ring: "ring-info/40",
    chip: "bg-info/10 text-info dark:text-info border-info/20",
    bar: "bg-info",
    dot: "bg-info",
  },
  amber: {
    ring: "ring-warning/40",
    chip: "bg-warning/10 text-warning-foreground dark:text-warning-foreground border-warning/20",
    bar: "bg-warning",
    dot: "bg-warning",
  },
  slate: {
    ring: "ring-muted-foreground/30",
    chip: "bg-muted text-muted-foreground border-border",
    bar: "bg-muted-foreground/60",
    dot: "bg-muted-foreground/60",
  },
  rose: {
    ring: "ring-destructive/40",
    chip: "bg-destructive/10 text-destructive dark:text-destructive border-destructive/20",
    bar: "bg-destructive",
    dot: "bg-destructive",
  },
};

function stageLabel(s: ClientCandidateDTO["stage"]): string {
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

function primaryAction(s: ClientCandidateDTO["stage"]): string {
  return (
    {
      delivered: "Review candidate",
      shortlisted: "Request interview",
      interview_process: "Review interview",
      offer: "Review offer",
      hired: "View hire details",
      not_moving_forward: "View decision",
    } as const
  )[s];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
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
  const cov = c.coverage;
  const mustPct = cov.must_total ? Math.round((cov.must_met / cov.must_total) * 100) : 0;

  return (
    <div
      className={`group relative rounded-xl border bg-card p-5 transition hover:shadow-md hover:border-primary/40 ${
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

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
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
          <p className="text-xs text-muted-foreground mt-1">
            {[
              c.position?.title,
              c.candidate.location,
              c.candidate.availability,
              c.candidate.years_experience ? `${c.candidate.years_experience}y exp` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approved fit</div>
          <div className="text-3xl font-semibold tabular-nums leading-none mt-0.5">
            {c.score == null ? "—" : c.score.toFixed(0)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">/ 100</div>
        </div>
      </div>

      {/* Must-have coverage */}
      {cov.must_total > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>
              Must-haves: <span className="text-foreground font-medium">{cov.must_met}/{cov.must_total}</span>
              {cov.must_partial > 0 && <span className="ml-1">· {cov.must_partial} partial</span>}
              {cov.must_missing > 0 && <span className="ml-1">· {cov.must_missing} missing</span>}
            </span>
            <span>{mustPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${accent.bar} transition-all`} style={{ width: `${mustPct}%` }} />
          </div>
        </div>
      )}

      {/* Recommendation + top evidence */}
      <div className="mt-3 text-xs text-foreground/80">
        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${accent.dot}`} />
        <span className="font-medium">{c.fit.recommendation}.</span>{" "}
        {c.strengths[0] && <span className="text-muted-foreground">{c.strengths[0]}</span>}
      </div>
      {c.strengths[1] && (
        <div className="mt-1.5 text-xs text-muted-foreground line-clamp-1">• {c.strengths[1]}</div>
      )}
      {c.main_consideration && (
        <div className="mt-1.5 text-xs text-warning-foreground dark:text-warning-foreground line-clamp-1">
          ⚠ {c.main_consideration}
        </div>
      )}

      {/* Footer: stage · delivered · primary action */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
        <div className="text-[11px] text-muted-foreground">
          {stageLabel(c.stage)}
          {c.delivered_at && <span className="mx-1">·</span>}
          {c.delivered_at && <span>Delivered {timeAgo(c.delivered_at)}</span>}
        </div>
        <Link
          to="/client/candidates/$id"
          params={{ id: c.match_id }}
          search={search.org ? { org: search.org } : undefined}
          className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          {primaryAction(c.stage)} →
        </Link>
      </div>
    </div>
  );
}
