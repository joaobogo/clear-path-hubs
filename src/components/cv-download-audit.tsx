import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCvDownloadAudit, type CvDownloadAuditEntry } from "@/lib/cv-download-audit.functions";

const AUDIENCE_LABEL: Record<CvDownloadAuditEntry["audience"], string> = {
  staff: "TaaSFlow team",
  client: "Your team",
  candidate: "Candidate",
  unknown: "—",
};

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Who opened or saved this candidate's CV, and when. Read-only, newest first.
 * Rows are scoped server-side: client members only ever see their own team's reads.
 */
export function CvDownloadAudit({
  matchId,
  title = "CV access history",
  className,
  limit = 25,
}: {
  matchId: string;
  title?: string;
  className?: string;
  limit?: number;
}) {
  const fetchFn = useServerFn(getCvDownloadAudit);
  const query = useQuery({
    queryKey: ["cv-download-audit", matchId, limit],
    queryFn: () => fetchFn({ data: { matchId, limit } }),
    enabled: !!matchId,
    staleTime: 30_000,
  });

  const rows = (query.data ?? []) as CvDownloadAuditEntry[];

  return (
    <section className={`rounded-lg border bg-card p-4 ${className ?? ""}`} aria-label={title}>
      <header className="mb-3 flex items-center gap-2">
        <FileClock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
        {rows.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-[11px]">
            {rows.length} {rows.length === 1 ? "access" : "accesses"}
          </Badge>
        )}
      </header>

      {query.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      ) : query.isError ? (
        <p className="text-xs text-destructive">Could not load the CV access history.</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No one has opened this CV yet. Every download is recorded here with the person, the time,
          and the candidate.
        </p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
              <span className="font-medium">{r.actor_name}</span>
              <span className="text-muted-foreground">
                {r.action === "previewed" ? "previewed" : "downloaded"}
                {r.candidate_name ? ` ${r.candidate_name}’s CV` : " the CV"}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {AUDIENCE_LABEL[r.audience]}
              </Badge>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                {when(r.at)}
              </span>
              {r.actor_email && (
                <span className="w-full truncate text-[11px] text-muted-foreground">
                  {r.actor_email}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
