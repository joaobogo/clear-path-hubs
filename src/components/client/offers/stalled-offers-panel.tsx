import { AlertTriangle } from "lucide-react";
import { HIRE_STATUS_LABEL, type HireRecordDTO } from "@/lib/hires.functions";
import { stallLabel, STALL_HOURS } from "@/lib/offer-stall";
import { formatAge } from "@/lib/time-age";
import { NudgeButton } from "./nudge-button";

export function StalledOffersPanel({
  stalled,
  orgId,
  readOnly,
}: {
  stalled: HireRecordDTO[];
  orgId: string;
  readOnly: boolean;
}) {
  if (stalled.length === 0) return null;
  return (
    <section className="mt-6 rounded-xl border border-warning/70 bg-warning/60 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-warning-strong" aria-hidden />
        {stalled.length} offer{stalled.length === 1 ? "" : "s"} stalled over{" "}
        {STALL_HOURS}h
      </h2>
      <ul className="mt-3 space-y-2">
        {stalled.map((h) => (
          <li
            key={h.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/80 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {h.candidate_name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {h.position_title}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {HIRE_STATUS_LABEL[h.status]} · {stallLabel(h)} · owner{" "}
                {h.owner_name ?? "unassigned"}
                {h.nudge_count > 0 &&
                  ` · nudged ${h.nudge_count}× (last ${formatAge(h.last_nudged_at)} ago)`}
              </p>
            </div>
            {!readOnly && <NudgeButton orgId={orgId} hire={h} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
