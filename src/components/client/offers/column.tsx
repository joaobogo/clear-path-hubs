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
    // One row that scrolls sideways: populated columns keep a fixed width, and
    // empty columns collapse to a narrow labelled strip instead of a tall block.
    <div
      className={`shrink-0 self-start rounded-xl border ${
        isEmpty
          ? "w-fit min-w-[80px] max-w-[130px] border-dashed border-muted bg-transparent p-2"
          : `w-[260px] p-3 ${COLUMN_TONE[status]}`
      }`}
    >
      <div
        className={`flex items-center ${
          isEmpty ? "flex-col gap-1 text-center" : "justify-between gap-2"
        }`}
      >
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className={isEmpty ? "leading-tight" : ""}>
            {HIRE_STATUS_LABEL[status]}
          </span>
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
