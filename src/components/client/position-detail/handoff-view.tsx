import { Link } from "@tanstack/react-router";
import { HireHandoffPanel } from "@/components/client/hire-handoff";
import { RoleMessagesPanel } from "@/components/client/role-messages-panel";
import { RoleStoryPanel } from "@/components/client/position-detail/role-story";
import { WORK_MODEL_LABELS } from "@/lib/express-intake-schema";
import type { RoleStory } from "@/lib/client/role-story";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
};

/** Raw enum values are never shown to a client; unknown values read as words. */
function words(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function PositionHandoffView({
  position,
  orgId,
  positionId,
  canEdit,
  story,
  org,
}: {
  position: AnyRow;
  orgId: string;
  positionId: string;
  canEdit: boolean;
  story?: RoleStory | null;
  org?: string;
}) {
  const subtitle = [
    position.department,
    position.location,
    WORK_MODEL_LABELS[position.work_model as keyof typeof WORK_MODEL_LABELS] ??
      words(position.work_model),
    EMPLOYMENT_TYPE_LABELS[position.employment_type as string] ??
      words(position.employment_type),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <Link to="/client/positions" className="text-sm text-muted-foreground hover:underline">
          ← All roles
        </Link>
      </div>
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance break-words">
          {position.title}
        </h1>
        <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
      </header>
      <HireHandoffPanel orgId={orgId} positionId={positionId} canEdit={canEdit} />
      {/* A genuinely closed role keeps its hire record and search evidence. */}
      {story && <RoleStoryPanel story={story} positionId={positionId} org={org} />}
      <RoleMessagesPanel
        orgId={orgId}
        positionId={positionId}
        positionTitle={position.title}
        canPost={canEdit}
      />
    </div>
  );
}
