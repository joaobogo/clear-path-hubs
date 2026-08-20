import { Link } from "@tanstack/react-router";
import { OpenThreadButton } from "@/components/comms/open-thread-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PositionLifecycleMenu } from "@/components/positions/position-lifecycle-menu";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { CloseRoleDialog } from "@/components/client/close-role-dialog";
import { RoleLifecycleMenu } from "@/components/client/role-lifecycle-menu";
import { formatEnumLabel } from "@/lib/human-labels";
import { normalizeDealBreakers } from "@/lib/client-deal-breakers";
import { type ClientRoleStatus, clientRoleStatusLabel } from "@/lib/client-role-status";
import { isArchivedStatus } from "@/lib/role-closure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * The stated facts of the role: placement and authorisation, the rules that
 * disqualify someone, and the interview process — all exactly as the client
 * stated them at intake. Demoted out of the first viewport into the
 * "Role details" tab; nothing here changed, only where it renders.
 */
export function PositionFactsBlock({
  position,
  placementLine,
  canEdit,
  supportReadOnly,
}: {
  position: AnyRow;
  placementLine: string;
  canEdit: boolean;
  supportReadOnly: boolean;
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
    typeof intakeCtx["target_days_to_offer"] === "number"
      ? intakeCtx["target_days_to_offer"]
      : null;

  const hasFacts =
    !!placementLine || dealBreakersList.length > 0 || interviewStages.length > 0;

  return (
    <>
      {hasFacts && (
        <section className="rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Placement and process
          </h3>
          {placementLine ? <div className="mt-2">{placementLine}</div> : null}
          {dealBreakersList.length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-foreground">Rules someone out: </span>
              {dealBreakersList.join(" · ")}
            </div>
          )}
          {interviewStages.length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-foreground">Interview process: </span>
              {interviewStages
                .map((s, i) => `${i + 1}. ${String(s["name"] ?? "").trim()}`)
                .filter(Boolean)
                .join(" · ")}
              {targetDaysToOffer ? ` · target ${targetDaysToOffer} days to offer` : ""}
            </div>
          )}
        </section>
      )}
      {canEdit && !supportReadOnly && (
        <JobQualityPanel
          positionId={position.id}
          editTo={{ to: "/client/positions/$id/edit", positionId: position.id }}
        />
      )}
    </>
  );
}

/**
 * Lifecycle controls for the role. Demoted from the header into the
 * "Settings for this role" tab — same components, same behaviour.
 */
export function PositionSettingsBlock({
  position,
  orgId,
  canEdit,
  supportReadOnly,
  hasClosure,
  onRefetch,
}: {
  position: AnyRow;
  orgId: string | undefined;
  canEdit: boolean;
  supportReadOnly: boolean;
  hasClosure: boolean;
  onRefetch: () => void;
}) {
  if (!canEdit || supportReadOnly) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to change this role.
      </p>
    );
  }
  return (
    <section className="rounded-xl border bg-card px-4 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Settings for this role
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/client/positions/$id/edit"
            params={{ id: position.id }}
            search={{ step: undefined }}
            data-qa-action="edit-position-wizard"
          >
            Edit role
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
        {orgId && !hasClosure && (
          <CloseRoleDialog
            orgId={orgId}
            positionId={position.id}
            positionTitle={position.title}
          />
        )}
      </div>
    </section>
  );
}

/**
 * First viewport identity: role title, where and how it is worked, and the
 * client-facing status. Everything else this header used to carry now lives one
 * tap away in the Role details / Settings tabs.
 */
export function PositionHeader({
  position,
  orgId,
  canEdit,
  supportReadOnly,
  clientStatus,
}: {
  position: AnyRow;
  orgId: string | undefined;
  canEdit: boolean;
  supportReadOnly: boolean;
  clientStatus: ClientRoleStatus | null | undefined;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {position.title}
          </h1>
          <Badge variant="secondary">{clientRoleStatusLabel(clientStatus)}</Badge>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {[
            position.department ?? undefined,
            position.location ?? undefined,
            formatEnumLabel(position.work_model) || undefined,
            formatEnumLabel(position.employment_type) || undefined,
            formatEnumLabel(position.seniority) || undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {supportReadOnly ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Kanban movement is disabled while viewing this workspace as a
            TaaSFlow administrator.
          </div>
        ) : !canEdit ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Read-only view — you do not have edit permission for this workspace.
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && !supportReadOnly && (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/client/positions/$id/edit"
              params={{ id: position.id }}
              search={{ step: undefined }}
              data-qa-action="edit-position-wizard"
            >
              Edit role
            </Link>
          </Button>
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
        {canEdit && !supportReadOnly && (
          <RoleLifecycleMenu
            positionId={position.id}
            positionTitle={position.title}
            status={String(position.status ?? "")}
          />
        )}
      </div>
    </header>
  );
}
