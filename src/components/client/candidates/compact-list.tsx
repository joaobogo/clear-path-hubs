import { Link } from "@tanstack/react-router";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { CandidateCard } from "@/components/client/candidate-card";
import { CandidatePrimaryAction } from "@/components/client/candidate-primary-action";
import { clientStageLabel } from "@/lib/client-stage-labels";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function candidateHeadline(c: ClientCandidateDTO): string {
  const title =
    c.candidate.headline ??
    [c.candidate.current_role, c.candidate.current_company].filter(Boolean).join(" · ");
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
 * Decision-first list for the client candidates page.
 *
 * Demoted from the desktop row to the candidate detail page:
 * - coverage bar (must-haves / nice-to-haves counts)
 * - experience and location as standalone columns (now in the one-line headline)
 * - review timeline strip
 * - per-row CV download
 * - "Open" action link
 *
 * The row/card now shows exactly: name, score band chip, one-line headline,
 * stage, and one primary action. The checkbox used for "Compare side by side"
 * stays exactly where it is.
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
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="grid gap-3 md:hidden">
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

      {/* Desktop: decision-first table */}
      <div className="hidden min-w-0 max-w-full overflow-hidden rounded-xl border bg-card md:block mb-16">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 py-2 px-3"></th>
              <th className="text-left py-2 px-3">Candidate</th>
              <th className="text-left py-2 px-3">Fit</th>
              <th className="text-left py-2 px-3">Stage</th>
              <th className="text-right py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => (
              <tr key={c.match_id} className="hover:bg-muted/20">
                <td className="py-3 px-3 align-middle">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(c.match_id)}
                    disabled={compareIds.length >= 4 && !compareIds.includes(c.match_id)}
                    onChange={() => onToggleCompare(c.match_id)}
                    aria-label={`Compare ${c.candidate.display_name}`}
                    className="h-4 w-4 cursor-pointer"
                  />
                </td>
                <td className="py-3 px-3 align-middle">
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: c.match_id }}
                    search={orgSearch ? { org: orgSearch } : undefined}
                    className="font-medium hover:underline"
                  >
                    {c.candidate.display_name}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-sm">
                    {candidateHeadline(c)}
                  </div>
                </td>
                <td className="py-3 px-3 align-middle">
                  <CandidateScoreBadge
                    score={c.score}
                    fitLabel={c.fit_label}
                    evidence={c.evidence_support}
                    unicorn={c.unicorn}
                  />
                </td>
                <td className="py-3 px-3 text-muted-foreground align-middle whitespace-nowrap">
                  {clientStageLabel(c.stage)}
                </td>
                <td className="py-3 px-3 text-right align-middle">
                  {orgId ? (
                    <CandidatePrimaryAction
                      orgId={orgId}
                      matchId={c.match_id}
                      stage={c.stage}
                      candidateName={c.candidate.display_name}
                      size="sm"
                    />
                  ) : (
                    <Link
                      to="/client/candidates/$id"
                      params={{ id: c.match_id }}
                      search={orgSearch ? { org: orgSearch } : undefined}
                      className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      Review
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
