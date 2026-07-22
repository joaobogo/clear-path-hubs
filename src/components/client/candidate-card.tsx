import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

const FIT_COLOR: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  strong: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  moderate: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  weak: "bg-muted text-muted-foreground",
};

export function CandidateCard({ candidate }: { candidate: ClientCandidateDTO }) {
  const c = candidate;
  return (
    <div className="rounded-lg border bg-card p-4 hover:border-primary transition">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium">{c.candidate.display_name}</div>
            {c.fit_label && (
              <span
                className={`text-xs rounded px-2 py-0.5 capitalize ${
                  FIT_COLOR[c.fit_label] ?? "bg-muted"
                }`}
              >
                {c.fit_label}
              </span>
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {String(c.stage).replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {c.position?.title ?? "—"} · {c.candidate.location ?? "—"}
          </div>
          <div className="text-xs mt-2 space-y-0.5">
            {c.strengths[0] && (
              <div>
                <span className="text-muted-foreground">Strongest match: </span>
                {c.strengths[0]}
              </div>
            )}
            {c.main_consideration && (
              <div>
                <span className="text-muted-foreground">
                  Main consideration:{" "}
                </span>
                {c.main_consideration}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Score
            </div>
            <div className="text-xl font-semibold tabular-nums">
              {c.score == null ? "—" : c.score.toFixed(0)}
            </div>
          </div>
          <Link
            to="/client/candidates/$id"
            params={{ id: c.match_id }}
            className="text-sm text-primary hover:underline"
          >
            Review →
          </Link>
        </div>
      </div>
    </div>
  );
}
