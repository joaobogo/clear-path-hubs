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
  return (
    <div className={`rounded-xl border p-3 ${COLUMN_TONE[status]}`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {HIRE_STATUS_LABEL[status]}
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && (
          <li className="rounded-md border border-dashed border-border/60 bg-background/30 p-3 text-[11px] text-muted-foreground">
            Nothing here
          </li>
        )}
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
    </div>
  );
}
