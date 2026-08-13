import { Link } from "@tanstack/react-router";
import { clientStageLabel } from "@/lib/client-stage-labels";
import { CandidateCard } from "@/components/client/candidate-card";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

export function CompactList({
  rows,
  orgSearch,
  compareIds,
  onToggleCompare,
}: {
  rows: ClientCandidateDTO[];
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
            compareSelected={compareIds.includes(c.match_id)}
            compareDisabled={compareIds.length >= 4}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 py-2 px-3"></th>
              <th className="text-left py-2 px-3">Candidate</th>
              <th className="text-left py-2 px-3">Role</th>
              <th className="text-left py-2 px-3">Fit</th>
              <th className="text-left py-2 px-3">Must-haves</th>
              <th className="text-left py-2 px-3">Location</th>
              <th className="text-left py-2 px-3">Stage</th>
              <th className="text-right py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => (
              <tr key={c.match_id} className="hover:bg-muted/20">
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(c.match_id)}
                    disabled={compareIds.length >= 4 && !compareIds.includes(c.match_id)}
                    onChange={() => onToggleCompare(c.match_id)}
                    aria-label={`Compare ${c.candidate.display_name}`}
                  />
                </td>
                <td className="py-2 px-3">
                  <div className="font-medium">{c.candidate.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                    {c.candidate.headline ?? ""}
                  </div>
                </td>
                <td className="py-2 px-3 text-muted-foreground truncate max-w-[12rem]">
                  {c.position?.title ?? "—"}
                </td>
                <td className="py-2 px-3">
                  <div className="font-medium">
                    {c.fit.headline}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.fit.recommendation}</div>
                </td>
                <td className="py-2 px-3 tabular-nums">
                  {c.coverage.must_met}/{c.coverage.must_total || "—"}
                </td>
                <td className="py-2 px-3 text-muted-foreground">
                  {c.candidate.location ?? "—"}
                </td>
                <td className="py-2 px-3 text-muted-foreground">
                  {clientStageLabel(c.stage)}
                </td>
                <td className="py-2 px-3 text-right">
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: c.match_id }}
                    search={orgSearch ? { org: orgSearch } : undefined}
                    className="text-primary hover:underline text-sm"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
