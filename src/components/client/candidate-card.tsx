import { Link, useSearch } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { CandidatePrimaryAction } from "@/components/client/candidate-primary-action";
import { clientStageLabel } from "@/lib/client-stage-labels";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function cardHeadline(c: ClientCandidateDTO): string {
  const title =
    c.candidate.headline ??
    [c.candidate.current_role, c.candidate.current_company]
      .filter(Boolean)
      .join(" · ");
  const meta = [
    c.candidate.years_experience != null ? `${c.candidate.years_experience} yrs` : null,
    c.candidate.location,
  ]
    .filter(Boolean)
    .join(" · ");
  if (title && meta) return `${title} · ${meta}`;
  return title || meta || "—";
}

/**
 * Decision-first candidate card for client surfaces.
 *
 * Demoted from this card to the candidate detail page:
 * - full evidence bullets
 * - practical-fit chips (availability, compensation, location)
 * - review timeline strip
 * - one-click CV download
 * - undo window / next-step note
 *
 * The card now shows exactly: name, score band chip, one-line headline,
 * stage, and one primary action. Tapping the name or action opens the detail
 * page where everything above is still one click away.
 */
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
  const orgId = orgIdProp ?? search.org ?? null;

  return (
    <div
      className={`group relative rounded-xl border bg-card p-4 transition hover:shadow-md hover:border-primary/40 ${
        compareSelected ? "ring-2 ring-primary/40" : ""
      }`}
    >
      {onToggleCompare && (
        <label className="absolute right-3 top-3 flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
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

      <div className="min-w-0 pr-20">
        <Link
          to="/client/candidates/$id"
          params={{ id: c.match_id }}
          search={search.org ? { org: search.org } : undefined}
          className="block text-sm font-semibold hover:underline truncate"
        >
          {c.candidate.display_name}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{cardHeadline(c)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CandidateScoreBadge
          score={c.score}
          fitLabel={c.fit_label}
          evidence={c.evidence_support}
          unicorn={c.unicorn}
        />
        <span className="text-xs text-muted-foreground">{clientStageLabel(c.stage)}</span>
      </div>

      <div className="mt-3">
        {orgId ? (
          <CandidatePrimaryAction
            orgId={orgId}
            matchId={c.match_id}
            stage={c.stage}
            candidateName={c.candidate.display_name}
          />
        ) : (
          <Link
            to="/client/candidates/$id"
            params={{ id: c.match_id }}
            search={search.org ? { org: search.org } : undefined}
            className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Review
          </Link>
        )}
      </div>
    </div>
  );
}
