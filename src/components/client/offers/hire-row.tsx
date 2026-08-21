import { formatCalendarDate } from "@/lib/calendar-date";
import { memo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { CalendarClock, User2, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import {
  transitionHire,
  HIRE_STATUS_LABEL,
  CLOSE_REASON_LABEL,
  type HireRecordDTO,
  type HireStatus,
} from "@/lib/hires.functions";
import { guaranteeLine } from "@/lib/interview-scorecard";
import { isStalled, stallLabel, stageEnteredAt } from "@/lib/offer-stall";
import { Button } from "@/components/ui/button";
import { NEXT_STEPS, nextStepLabel, formatSalary } from "./helpers";
import { NudgeButton } from "./nudge-button";
import { OfferTermsDialog } from "./offer-terms-dialog";
import { CloseReasonDialog } from "./close-reason-dialog";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";

// Single offer/hire card. Owns its own local UI state (edit + close
// dialogs) so acting on one card doesn't force the whole board to
// re-render — wrapped in React.memo below.
function HireCardImpl({
  hire,
  orgId,
  readOnly,
  onChanged,
}: {
  hire: HireRecordDTO;
  orgId: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState<null | HireStatus>(null);
  const qc = useQueryClient();
  const transitionFn = useServerFn(transitionHire);

  const doTransition = useMutation({
    mutationFn: (to: HireStatus) =>
      transitionFn({ data: { orgId, id: hire.id, to } }),
    onSuccess: (_r, to) => {
      toast.success(`Moved to ${HIRE_STATUS_LABEL[to]}`);
      qc.invalidateQueries({ queryKey: ["hires", orgId] });
      qc.invalidateQueries({ queryKey: ["hires-report", orgId] });
      onChanged();
    },
    onError: (e: Error) => toastError(e),
  });

  const salary = formatSalary(hire);

  return (
    <li className="rounded-lg border bg-background/80 p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{hire.candidate_name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hire.position_title}
          </p>
        </div>
      </div>

      {isStalled(hire) && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-strong">
          <AlertTriangle className="h-3 w-3" /> {stallLabel(hire).replace("owner Alex Rivera (Staff)", "TaaSFlow team")}
        </p>
      )}

      <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <div className="flex justify-between">
          <dt>Comp</dt>
          <dd className={salary ? "text-foreground" : "italic"}>
            {salary ?? "not on record"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>{HIRE_STATUS_LABEL[hire.status]}</dt>
          <dd className="text-foreground">
            {stageEnteredAt(hire)
              ? formatDate((stageEnteredAt(hire)!))
              : "—"}
          </dd>
        </div>
        {hire.start_date && (
          <div className="flex items-center justify-between">
            <dt className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Start
            </dt>
            <dd className="text-foreground">
              {formatCalendarDate(hire.start_date)}
            </dd>
          </div>
        )}
        {hire.owner_name && (
          <div className="flex items-center justify-between">
            <dt className="inline-flex items-center gap-1">
              <User2 className="h-3 w-3" /> Owner
            </dt>
            <dd className="truncate text-foreground">
              {hire.owner_name}
            </dd>
          </div>
        )}
      </dl>

      {guaranteeLine(
        {
          days: hire.guarantee_days,
          startsOn: hire.guarantee_starts_on,
          terms: hire.guarantee_terms,
          visibleToClient: hire.guarantee_visible_to_client,
        },
        hire.start_date,
      ) && (
        <div className="mt-2 rounded border border-dashed border-border/70 bg-muted/40 px-2 py-1 text-[11px]">
          <strong className="text-foreground">Guarantee: </strong>
          {guaranteeLine(
            {
              days: hire.guarantee_days,
              startsOn: hire.guarantee_starts_on,
              terms: hire.guarantee_terms,
              visibleToClient: hire.guarantee_visible_to_client,
            },
            hire.start_date,
          )}
          {hire.guarantee_terms ? ` ${hire.guarantee_terms}` : ""}
        </div>
      )}

      {hire.close_reason && (
        <div className="mt-2 rounded border border-dashed border-border/70 bg-muted/40 px-2 py-1 text-[11px]">
          <strong className="text-foreground">
            {CLOSE_REASON_LABEL[hire.close_reason]}
          </strong>
          {hire.close_reason_notes && (
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">
              {hire.close_reason_notes}
            </p>
          )}
        </div>
      )}

      {!readOnly && isStalled(hire) && (
        <div className="mt-2">
          <NudgeButton orgId={orgId} hire={hire} />
        </div>
      )}

      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setEditOpen(true)}
          >
            Edit terms
          </Button>
          {NEXT_STEPS[hire.status].map((to) => {
            const needsReason = to === "offer_declined" || to === "closed_lost";
            const label = nextStepLabel(to);
            return (
              <Button
                key={to}
                size="sm"
                variant={to === "hire_confirmed" ? "default" : "outline"}
                className="h-6 gap-1 px-2 text-[11px]"
                disabled={doTransition.isPending}
                onClick={() =>
                  needsReason ? setCloseOpen(to) : doTransition.mutate(to)
                }
              >
                {to === "offer_drafted" && hire.status !== "offer_drafted" ? (
                  <RotateCcw className="h-3 w-3" />
                ) : (
                  <ArrowRight className="h-3 w-3" />
                )}
                {label}
              </Button>
            );
          })}
        </div>
      )}

      {editOpen && (
        <OfferTermsDialog
          hire={hire}
          orgId={orgId}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["hires", orgId] });
            onChanged();
          }}
        />
      )}
      {closeOpen && (
        <CloseReasonDialog
          orgId={orgId}
          hireId={hire.id}
          target={closeOpen}
          onClose={() => setCloseOpen(null)}
          onSaved={() => {
            setCloseOpen(null);
            qc.invalidateQueries({ queryKey: ["hires", orgId] });
            qc.invalidateQueries({ queryKey: ["hires-report", orgId] });
            onChanged();
          }}
        />
      )}
    </li>
  );
}

export const HireCard = memo(HireCardImpl);
