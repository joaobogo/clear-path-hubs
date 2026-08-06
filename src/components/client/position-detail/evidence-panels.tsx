import { RoleBlueprint } from "@/components/product/role-blueprint";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { RoleLaunchPanel } from "@/components/positions/role-launch-panel";
import { PreviouslyConsidered } from "@/components/client/previously-considered";
import { RoleShortlist } from "@/components/client/role-shortlist";
import { DeliveryCommitmentBlock } from "@/components/client/delivery-commitment";
import { buildDeliveryCommitment } from "@/lib/delivery-commitment";
import type { RoleLaunchState } from "@/lib/role-launch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function EvidencePanels({
  orgId,
  positionId,
  firstShortlistExpectedAt,
  commitment,
  commitmentContactName,
  launch,
  position,
  activity,
  onConfirmBlueprint,
  confirmingBlueprint,
}: {
  orgId: string | undefined;
  positionId: string;
  firstShortlistExpectedAt: AnyRow;
  commitment: AnyRow;
  commitmentContactName: AnyRow;
  launch: RoleLaunchState | undefined;
  position: AnyRow;
  activity: AnyRow[];
  onConfirmBlueprint: () => void;
  confirmingBlueprint: boolean;
}) {
  return (
    <>
      {/* 5. Shortlist — standard evidence card per candidate */}
      <RoleShortlist
        orgId={orgId}
        positionId={positionId}
        firstShortlistExpectedAt={firstShortlistExpectedAt}
      />

      {/* Same stored delivery commitment the client saw on confirmation */}
      <DeliveryCommitmentBlock
        commitment={buildDeliveryCommitment({
          commitment,
          positionId,
          contactName: commitmentContactName,
        })}
      />

      {/* 5b. Role setup timeline + search channels — evidence-backed */}
      {launch && <RoleLaunchPanel launch={launch} />}

      {/* 5c. Generated role blueprint from express onboarding */}
      <GeneratedBlueprintPanel
        position={position}
        audience="client"
        editTo={{ to: "/client/positions/$id/edit", params: { id: positionId } }}
        onConfirm={onConfirmBlueprint}
        confirming={confirmingBlueprint}
      />

      {/* 6. Role blueprint — ATS-grade source of truth */}
      <RoleBlueprint position={position} activity={activity} />

      {/* 6b. Previously considered — earlier candidates matched to this brief */}
      {orgId && <PreviouslyConsidered orgId={orgId} positionId={positionId} />}
    </>
  );
}
