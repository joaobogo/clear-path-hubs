import { Link } from "@tanstack/react-router";
import { clientStageLabel } from "@/lib/client-stage-labels";
import { CandidateCard } from "@/components/client/candidate-card";
import { DownloadCvButton } from "@/components/download-cv-button";
import { UnicornBadge } from "@/components/client/candidate-score-badge";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function ScoreCell({ c }: { c: ClientCandidateDTO }) {
  if (c.score == null) {
    return <span className="text-xs text-muted-foreground">Screening</span>;
  }
  const tone =
    c.score >= 95
      ? "border-primary/30 bg-primary/10 text-primary"
      : c.score >= 85
        ? "border-success/30 bg-success/10 text-success"
        : c.score >= 70
          ? "border-info/30 bg-info/10 text-info"
          : c.score >= 50
            ? "border-warning/30 bg-warning/10 text-warning-strong"
            : "border-border bg-muted text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-baseline gap-0.5 rounded-full border px-2 py-0.5 text-sm font-semibold tabular-nums ${tone}`}
        title="Fit score out of 100"
      >
        {c.score}
        <span className="text-[10px] font-normal opacity-70">/100</span>
      </span>
      {c.score >= 95 && <UnicornBadge />}
    </span>
  );
}

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
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 py-2 px-3"></th>
              <th className="w-10 text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Candidate</th>
              <th className="text-left py-2 px-3">Score</th>
              <th className="text-left py-2 px-3">Fit</th>
              <th className="text-left py-2 px-3">Must-haves</th>
              <th className="text-left py-2 px-3">Experience</th>
              <th className="text-left py-2 px-3">Location</th>
              <th className="text-left py-2 px-3">Stage</th>
              <th className="text-right py-2 px-3">CV</th>
              <th className="text-right py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c, i) => (
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
                <td className="py-2 px-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="py-2 px-3">
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: c.match_id }}
                    search={orgSearch ? { org: orgSearch } : undefined}
                    className="font-medium hover:underline"
                  >
                    {c.candidate.display_name}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                    {c.candidate.headline ??
                      [c.candidate.current_role, c.candidate.current_company]
                        .filter(Boolean)
                        .join(" · ")}
                  </div>
                </td>
                <td className="py-2 px-3">
                  <ScoreCell c={c} />
                </td>
                <td className="py-2 px-3">
                  <div className="font-medium">{c.fit.headline}</div>
                  <div className="text-xs text-muted-foreground">{c.fit.recommendation}</div>
                </td>
                <td className="py-2 px-3 tabular-nums">
                  {c.coverage.must_met}/{c.coverage.must_total || "—"}
                </td>
                <td className="py-2 px-3 text-muted-foreground tabular-nums">
                  {c.candidate.years_experience != null ? `${c.candidate.years_experience} yrs` : "—"}
                </td>
                <td className="py-2 px-3 text-muted-foreground">{c.candidate.location ?? "—"}</td>
                <td className="py-2 px-3 text-muted-foreground">{clientStageLabel(c.stage)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <DownloadCvButton matchId={c.match_id} size="sm" variant="ghost" label="CV" />
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
