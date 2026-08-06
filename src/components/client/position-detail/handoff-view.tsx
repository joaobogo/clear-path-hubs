import { Link } from "@tanstack/react-router";
import { HireHandoffPanel } from "@/components/client/hire-handoff";
import { RoleMessagesPanel } from "@/components/client/role-messages-panel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function PositionHandoffView({
  position,
  orgId,
  positionId,
  canEdit,
}: {
  position: AnyRow;
  orgId: string;
  positionId: string;
  canEdit: boolean;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <Link to="/client/positions" className="text-sm text-muted-foreground hover:underline">
          ← All positions
        </Link>
      </div>
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{position.title}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {[position.department, position.location, position.work_model, position.employment_type]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </header>
      <HireHandoffPanel orgId={orgId} positionId={positionId} canEdit={canEdit} />
      <RoleMessagesPanel
        orgId={orgId}
        positionId={positionId}
        positionTitle={position.title}
        canPost={canEdit}
      />
    </main>
  );
}
