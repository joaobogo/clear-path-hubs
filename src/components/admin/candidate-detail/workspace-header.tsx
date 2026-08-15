// Extracted from the candidate detail route so first paint ships less code.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { AdminScoreNumber } from "@/components/admin/admin-score-number";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanText } from "lucide-react";
import { DownloadCvButton } from "@/components/download-cv-button";
import { ScoreStalenessChip, freshnessFromRow } from "@/components/admin/score-staleness-chip";
import { ProcessState } from "@/components/ds/process-state";
import { candidateProcessStatus } from "@/lib/loading/process-catalogue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const STATE_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  parsing: "bg-info/15 text-info dark:text-info",
  enriching: "bg-info/15 text-info dark:text-info",
  ready_to_score: "bg-info/15 text-info dark:text-info",
  scored: "bg-success/15 text-success dark:text-success",
  manual_review_required: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  ocr_required: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  failed: "bg-destructive/15 text-destructive",
  provider_blocked: "bg-destructive/15 text-destructive",
};

export // ── Header ─────────────────────────────────────────────────────────────────
function WorkspaceHeader({
  m,
  cp,
  pos,
  currentRun,
}: {
  m: Any;
  cp: Any;
  pos: Any;
  currentRun?: Any;
}) {
  const stateTone =
    STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground";
  return (
    <header className="space-y-3">
      <Link
        to="/admin/publish"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Publish desk
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {cp?.full_name ?? "Unknown candidate"}
            </h1>
            {currentRun?.score != null && (
              <ScoreStalenessChip
                freshness={freshnessFromRow({
                  scored_at: currentRun.completed_at ?? null,
                  scored_input_hash: currentRun.input_hash ?? null,
                  scored_engine_version: currentRun.engine_version ?? null,
                  profile_updated_at: cp?.updated_at ?? null,
                  brief_updated_at: pos?.updated_at ?? null,
                  // Recorded invalidations from the database triggers.
                  score_stale: m.score_stale ?? null,
                  score_stale_reasons: m.score_stale_reasons ?? null,
                  score_stale_at: m.score_stale_at ?? null,
                  rescore_queued_at: m.rescore_queued_at ?? null,
                })}
              />

            )}
            {currentRun?.score != null && <AdminScoreNumber run={currentRun} />}
            <Badge className={stateTone}>
              {m.processing_state.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">admin: {m.admin_status}</Badge>
            <Badge variant="outline">visibility: {m.client_visibility}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {cp?.email && <span>{cp.email}</span>}
            {cp?.email && pos?.title && <span>·</span>}
            <Link
              to="/admin/positions/$id"
              params={{ id: pos?.id ?? "" }}
              className="hover:underline"
            >
              {pos?.title ?? "—"}
            </Link>
            {pos?.organizations?.name && (
              <>
                <span>·</span>
                <Link
                  to="/admin/clients/$id"
                  params={{ id: pos?.organizations?.id ?? "" }}
                  className="hover:underline"
                >
                  {pos.organizations.name}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/candidates/$id/evidence" params={{ id: m.id }}>
              <ScanText className="mr-2 h-4 w-4" /> Evidence record
            </Link>
          </Button>
          <DownloadCvButton matchId={m.id} mode="download" />
        </div>
      </div>
      {m.processing_error_message && (
        <Alert variant="destructive">
          <AlertTitle>
            {m.processing_error_code === "engine_error" 
              ? "Hiring Intelligence" 
              : (m.processing_error_code ?? "Processing error")}
          </AlertTitle>
          <AlertDescription>
            {m.processing_error_message.includes("unique constraint") || m.processing_error_message === "engine_error"
              ? `The assessment engine encountered a technical collision while analyzing this profile. Reference: ${m.last_processing_trace_id || 'no-trace'}`
              : m.processing_error_message}
          </AlertDescription>
        </Alert>
      )}
          {(() => {
        const status = candidateProcessStatus(String(m.processing_state));
        return status && status.phase !== "done" ? (
          <ProcessState compact status={status} />
        ) : null;
      })()}
    </header>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────
