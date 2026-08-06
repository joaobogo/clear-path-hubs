import { Info, ShieldCheck, TriangleAlert, User } from "lucide-react";
import type { ScoreProvenance } from "@/lib/scoring/provenance";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function fmt(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

/**
 * Staff-facing fit number with its full provenance. Never render a bare score to
 * staff — this component is the canonical presentation.
 */
export function ScoreProvenanceBadge({
  provenance,
  className,
}: {
  provenance: ScoreProvenance;
  className?: string;
}) {
  const overridden = provenance.override !== null;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium",
              overridden ? "taas-bg-warning-soft taas-tx-warning" : "bg-muted text-foreground",
              className,
            )}
          >
            {overridden ? <User className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            <span>Fit {fmt(provenance.effectiveValue)}</span>
            {overridden && (
              <span className="text-xs font-normal opacity-80">
                (engine {fmt(provenance.engineValue)})
              </span>
            )}
            <Info className="h-3 w-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          <ProvenanceLines provenance={provenance} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProvenanceLines({ provenance }: { provenance: ScoreProvenance }) {
  return (
    <>
      <div>
        <span className="font-semibold">Engine value:</span> {fmt(provenance.engineValue)}
        {provenance.engineVersion ? ` · engine ${provenance.engineVersion}` : ""}
      </div>
      {provenance.override ? (
        <>
          <div>
            <span className="font-semibold">Override:</span> {fmt(provenance.override.value)}
          </div>
          <div>
            <span className="font-semibold">Set by:</span> {provenance.override.actor ?? "Unknown"}
            {provenance.override.at ? ` on ${provenance.override.at.slice(0, 10)}` : ""}
          </div>
          <div>
            <span className="font-semibold">Reason:</span>{" "}
            {provenance.override.reason ?? "No reason recorded"}
          </div>
        </>
      ) : (
        <div>No human override — this is the engine value.</div>
      )}
      <div>
        <span className="font-semibold">Criteria:</span>{" "}
        {provenance.unversioned
          ? "No published criteria version recorded for this score"
          : `${provenance.rubric.label ?? "Rubric"}${
              provenance.rubric.versionNumber ? ` v${provenance.rubric.versionNumber}` : ""
            }`}
      </div>
      {provenance.computedAt && (
        <div className="opacity-80">Computed {provenance.computedAt.slice(0, 10)}</div>
      )}
    </>
  );
}

/** Block form for detail pages, where a tooltip is not enough. */
export function ScoreProvenancePanel({ provenance }: { provenance: ScoreProvenance }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg font-semibold">Fit {fmt(provenance.effectiveValue)}</span>
        {provenance.override ? (
          <Badge variant="outline" className="taas-tx-warning">
            Human override
          </Badge>
        ) : (
          <Badge variant="secondary">Engine value</Badge>
        )}
        {provenance.unversioned && (
          <Badge variant="outline" className="taas-tx-warning">
            <TriangleAlert className="mr-1 h-3 w-3" />
            Unversioned criteria
          </Badge>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <ProvenanceLines provenance={provenance} />
      </div>
    </div>
  );
}
