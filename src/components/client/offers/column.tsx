import { Badge } from "@/components/ui/badge";
import { HIRE_STATUS_LABEL, type HireRecordDTO, type HireStatus } from "@/lib/hires.functions";
import { COLUMN_ICON, COLUMN_TONE } from "./helpers";
import { HireCard } from "./hire-row";

export function Column({
  status,
  items,
  orgId,
  readOnly,
  onChanged,
}: {
  status: HireStatus;
  items: HireRecordDTO[];
  orgId: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const Icon = COLUMN_ICON[status];
  const isEmpty = items.length === 0;
  return (
    // One row that scrolls sideways: every column keeps a fixed width, and an
    // empty column collapses to its header instead of a tall block of colour.
    <div
      className={`shrink-0 self-start rounded-xl border p-3 sm:w-[200px] ${COLUMN_TONE[status]}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {HIRE_STATUS_LABEL[status]}
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      {!isEmpty && (
        <ul className="mt-3 space-y-2">
          {items.map((h) => (
            <HireCard
              key={h.id}
              hire={h}
              orgId={orgId}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
