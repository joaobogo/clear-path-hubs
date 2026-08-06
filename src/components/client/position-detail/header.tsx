import { Link } from "@tanstack/react-router";
import { OpenThreadButton } from "@/components/comms/open-thread-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PositionLifecycleMenu } from "@/components/positions/position-lifecycle-menu";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { CloseRoleDialog } from "@/components/client/close-role-dialog";
import { normalizeDealBreakers } from "@/lib/client-deal-breakers";
import { clientRoleStatusLabel } from "@/lib/client-role-status";
import { isArchivedStatus } from "@/lib/role-closure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function PositionHeader({
  position,
  orgId,
  canEdit,
  supportReadOnly,
  hasClosure,
  clientStatus,
  placementLine,
  onRefetch,
}: {
  position: AnyRow;
  orgId: string | undefined;
  canEdit: boolean;
  supportReadOnly: boolean;
  hasClosure: boolean;
  clientStatus: string | undefined;
  placementLine: string;
  onRefetch: () => void;
}) {
  const dealBreakersRaw = (position.dealbreakers ?? []) as unknown;
  const dealBreakersList = normalizeDealBreakers(
    Array.isArray(dealBreakersRaw)
      ? dealBreakersRaw.map((r) =>
          typeof r === "string" ? r : String((r as { label?: unknown })?.label ?? ""),
        )
      : [],
  );

  const intakeCtx = (position.intake_context ?? {}) as Record<string, unknown>;
  const interviewStages = Array.isArray(intakeCtx["interview_stages"])
    ? (intakeCtx["interview_stages"] as Array<Record<string, unknown>>)
    : [];
  const targetDaysToOffer =
    typeof intakeCtx["target_days_to_offer"] === "number" ? intakeCtx["target_days_to_offer"] : null;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {position.title}
          </h1>
          <Badge variant="secondary">
            {clientRoleStatusLabel(clientStatus)}
          </Badge>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {[
            position.department,
            position.location,
            position.work_model,
            position.employment_type,
            position.seniority,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {/* Placement and authorisation answers, exactly as the client stated them. */}
        {placementLine ? (
          <div className="mt-1 text-sm text-muted-foreground">{placementLine}</div>
        ) : null}
        {/* The deal-breakers the client stated, in their own words. */}
        {dealBreakersList.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Rules someone out: </span>
            {dealBreakersList.join(" · ")}
          </div>
        )}
        {/* The interview process the client stated at intake, unchanged. */}
        {interviewStages.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Interview process: </span>
            {interviewStages
              .map((s, i) => `${i + 1}. ${String(s["name"] ?? "").trim()}`)
              .filter(Boolean)
              .join(" · ")}
            {targetDaysToOffer ? ` · target ${targetDaysToOffer} days to offer` : ""}
          </div>
        )}

        {supportReadOnly ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Kanban movement is disabled while viewing this workspace as a
            TaaSFlow administrator.
          </div>
        ) : !canEdit ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Read-only view — you do not have edit permission for this
            workspace.
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && !supportReadOnly && (
          <>
            <Button asChild variant="outline" size="sm">
              <Link
                to="/client/positions/$id/edit"
                params={{ id: position.id }}
                search={{ step: undefined }}
                data-qa-action="edit-position-wizard"
              >
                Edit position
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                to="/intake"
                search={{ duplicate: position.id }}
                data-qa-action="duplicate-position"
              >
                Duplicate this role
              </Link>
            </Button>

            <PositionLifecycleMenu
              positionId={position.id}
              status={position.status}
              title={position.title}
              onChanged={() => void onRefetch()}
            />
            {/* A role is closed with a recorded reason, never by message. */}
            {orgId && !hasClosure && !isArchivedStatus(position.status) && (
              <CloseRoleDialog
                orgId={orgId}
                positionId={position.id}
                positionTitle={position.title}
              />
            )}
          </>
        )}
        {orgId && (
          <OpenThreadButton
            orgId={orgId}
            scope="position"
            positionId={position.id}
            subject={position.title}
            label="Conversation"
          />
        )}
      </div>
      {canEdit && !supportReadOnly && (
        <div className="mt-4">
          <JobQualityPanel
            positionId={position.id}
            editTo={{ to: "/client/positions/$id/edit", positionId: position.id }}
          />
        </div>
      )}
    </header>
  );
}
