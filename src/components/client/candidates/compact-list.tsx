import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@tanstack/react-router";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { UnicornMarker } from "@/components/unicorn-marker";
import { CandidateCard } from "@/components/client/candidate-card";
import { clientStageLabel } from "@/lib/client-stage-labels";
import { candidateLineFor } from "@/lib/client-fit-presentation";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function candidateHeadline(c: ClientCandidateDTO): string {
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
 * Decision-first list for the client candidates page.
 *
 * Demoted from the desktop row to the candidate detail page:
 * - coverage bar (must-haves / nice-to-haves counts)
 * - experience and location as standalone columns (now in the one-line headline)
 * - review timeline strip
 * - per-row CV download
 * - "Open" action link
 *
 * The row/card shows the candidate, fit and current tracking stage.
 * Stage changes are available only in the Kanban board, not from table rows.
 */
export function CompactList({
  rows,
  orgId,
  orgSearch,
  compareIds,
  onToggleCompare,
}: {
  rows: ClientCandidateDTO[];
  orgId?: string | null;
  orgSearch?: string;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
}) {
  // Render exactly one layout for the current breakpoint. Rendering both and
  // hiding one with CSS put every row in the DOM (and the tab order) twice.
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="grid gap-3">
        {rows.map((c) => (
          <CandidateCard
            key={c.match_id}
            candidate={c}
            orgId={orgId}
            compareSelected={compareIds.includes(c.match_id)}
            compareDisabled={compareIds.length >= 4 && !compareIds.includes(c.match_id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-card mb-16">
      {/* taas-stack-table: rows stack into labelled blocks below 640px. */}
      <table className="taas-stack-table w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-10 py-2 px-3"></th>
            <th className="text-left py-2 px-3">Candidate</th>
            <th className="text-left py-2 px-3">Fit</th>
            <th className="text-left py-2 px-3">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.match_id} className="hover:bg-muted/20">
              <td data-label="Compare" className="py-3 px-3 align-middle">
                <input
                  type="checkbox"
                  checked={compareIds.includes(c.match_id)}
                  disabled={compareIds.length >= 4 && !compareIds.includes(c.match_id)}
                  onChange={() => onToggleCompare(c.match_id)}
                  aria-label={`Compare ${c.candidate.display_name}`}
                  className="h-4 w-4 cursor-pointer"
                />
              </td>
              <td data-label="Candidate" className="py-3 px-3 align-middle">
                <Link
                  to="/client/candidates/$id"
                  preload="intent"
                  params={{ id: c.match_id }}
                  search={orgSearch ? { org: orgSearch } : undefined}
                  className="font-medium hover:underline"
                >
                  {c.candidate.display_name}
                  <UnicornMarker unicorn={c.unicorn} className="ml-1" />
                </Link>
                <div className="text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-sm">
                  {candidateHeadline(c)}
                </div>
              </td>
              <td data-label="Fit" className="py-3 px-3 align-middle">
                <CandidateScoreBadge
                  score={c.score}
                  fitLabel={c.fit_label}
                  evidence={c.evidence_support}
                  unicorn={c.unicorn}
                  hideEvidenceChip
                />
              </td>
              <td
                data-label="Stage"
                className="py-3 px-3 text-muted-foreground align-middle whitespace-nowrap"
              >
                {clientStageLabel(c.stage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
