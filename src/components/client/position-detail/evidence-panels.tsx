import { RoleBlueprint } from "@/components/product/role-blueprint";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * The role's blueprint — the only evidence block kept on the simplified client
 * role page. Shortlist, delivery commitment, launch channels and previously
 * considered candidates now live on the candidates surfaces instead.
 */
export function EvidencePanels({
  positionId,
  position,
  activity,
  onConfirmBlueprint,
  confirmingBlueprint,
}: {
  orgId: string | null | undefined;
  positionId: string;
  position: AnyRow;
  activity: AnyRow[];
  onConfirmBlueprint: () => void;
  confirmingBlueprint: boolean;
}) {
  return (
    <>
      <GeneratedBlueprintPanel
        position={position}
        audience="client"
        editTo={{ to: "/client/positions/$id/edit", params: { id: positionId } }}
        onConfirm={onConfirmBlueprint}
        confirming={confirmingBlueprint}
      />

      <RoleBlueprint position={position} activity={activity} />
    </>
  );
}
