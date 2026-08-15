import { Link } from "@tanstack/react-router";
import { clientStageLabel } from "@/lib/client-stage-labels";
import { CandidateCard } from "@/components/client/candidate-card";
import { DownloadCvButton } from "@/components/download-cv-button";
import { ReviewTimelineStrip } from "@/components/client/candidates/review-timeline";
import { UnicornBadge } from "@/components/client/candidate-score-badge";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";


function ScoreCell({ c }: { c: ClientCandidateDTO }) {
  if (c.score == null) {
    return <span className="text-xs text-muted-foreground">Screening</span>;
  }
  const tone =
    c.score >= 95
      ? { text: "text-primary", bar: "bg-primary", track: "bg-primary/15" }
      : c.score >= 85
        ? { text: "text-success", bar: "bg-success", track: "bg-success/15" }
        : c.score >= 70
          ? { text: "text-info", bar: "bg-info", track: "bg-info/15" }
          : c.score >= 50
            ? { text: "text-warning-strong", bar: "bg-warning", track: "bg-warning/20" }
            : { text: "text-muted-foreground", bar: "bg-muted-foreground/50", track: "bg-muted" };
  return (
    <div className="min-w-[104px]" title="Fit score">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className={`text-lg font-semibold leading-none tabular-nums ${tone.text}`}>
          {c.score}
        </span>
        {c.score >= 95 && <UnicornBadge />}
      </div>
      <div className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${tone.track}`}>
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.max(2, Math.min(100, c.score))}%` }}
        />
      </div>
    </div>
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
      <div className="hidden min-w-0 max-w-full md:block overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 py-2 px-3"></th>
              <th className="w-10 text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Candidate</th>
              <th className="text-left py-2 px-3">Score</th>
              <th className="text-left py-2 px-3">Fit</th>
              <th className="text-left py-2 px-3">Must-haves</th>
              <th className="hidden text-left py-2 px-3 lg:table-cell">Experience</th>
              <th className="hidden text-left py-2 px-3 lg:table-cell">Location</th>
              <th className="text-left py-2 px-3">Stage</th>
              <th className="hidden text-left py-2 px-3 lg:table-cell">Review</th>
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
                <td className="hidden py-2 px-3 text-muted-foreground tabular-nums lg:table-cell">
                  {c.candidate.years_experience != null ? `${c.candidate.years_experience} yrs` : "—"}
                </td>
                <td className="hidden py-2 px-3 text-muted-foreground lg:table-cell">{c.candidate.location ?? "—"}</td>
                <td className="py-2 px-3 text-muted-foreground">{clientStageLabel(c.stage)}</td>
                <td className="hidden py-2 px-3 lg:table-cell">
                  <ReviewTimelineStrip timeline={c.review_timeline} />
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <DownloadCvButton matchId={c.match_id} size="sm" variant="ghost" label="CV" mode="download" />
                </td>
                <td className="py-2 px-3 text-right">
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: c.match_id }}
                    search={orgSearch ? { org: orgSearch } : undefined}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Open
                    <span aria-hidden>→</span>
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
