import { Link, useSearch } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { UnicornMarker } from "@/components/unicorn-marker";
import { clientStageLabel } from "@/lib/client-stage-labels";
import { candidateLineFor } from "@/lib/client-fit-presentation";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function cardHeadline(c: ClientCandidateDTO): string {
  // One resolver, shared with the compact list and the pipeline board — this
  // copy also used ?? on a field that is "" when nothing is known, so its own
  // fallback could never run (audit 1 Sep, F38).
  return candidateLineFor({
    headline: c.candidate.headline,
    current_role: c.candidate.current_role,
    current_company: c.candidate.current_company,
    years_experience: c.candidate.years_experience,
    location: c.candidate.location,
  });
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
 * The card shows the candidate, fit and tracking stage. Clicking the
 * candidate name opens their details; stages change only on the Kanban.
 */
export function CandidateCard({
  candidate,
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

  return (
    <div
      className={`group relative min-w-0 max-w-full overflow-hidden rounded-xl border bg-card p-4 transition hover:shadow-md hover:border-primary/40 ${
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
          <UnicornMarker unicorn={c.unicorn} className="ml-1" />
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


    </div>
  );
}
