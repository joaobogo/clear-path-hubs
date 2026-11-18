import type { DealbreakerWarning } from "@/lib/client/dealbreaker-publication";

export function DealbreakerWarnings({ warnings, score }: { warnings?: DealbreakerWarning[]; score?: number | null }) {
  if (!warnings?.length) return null;
  return (
    <div className="w-full min-w-0 space-y-1 text-xs text-warning-strong" role="note" aria-label="Recruiter deal-breaker exception">
      {warnings.map((warning) => (
        <div key={warning.label} className="rounded border border-warning/40 bg-warning/10 p-2 break-words">
          <p className="font-semibold">⚠ Deal-breaker: {warning.label}</p>
          {score != null && <p className="mt-1">Score {Math.round(score)} (capped){warning.uncapped_score != null ? ` · ${Math.round(warning.uncapped_score)} before deal-breaker` : ""}</p>}
        </div>
      ))}
    </div>
  );
}