import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/datetime";
import { formatEnumLabel } from "@/lib/human-labels";
import type { InterviewDTO } from "@/lib/interviews.functions";
import type { FeedbackQueueItem } from "@/lib/interview-feedback.functions";

/**
 * Read-only record of interviews already on file (booked before scheduling was
 * removed, or created when feedback was recorded). No scheduling actions: the
 * only control is "Feedback" on a completed interview.
 */
export function InterviewHistoryList({
  interviews,
  readOnly,
  onFeedback,
}: {
  interviews: InterviewDTO[];
  readOnly: boolean;
  onFeedback: (item: FeedbackQueueItem) => void;
}) {
  return (
    <ul className="space-y-2">
      {interviews.map((iv) => (
        <li
          key={iv.id}
          id={`interview-${iv.id}`}
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{iv.candidate?.name ?? "Candidate"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {iv.position?.title ?? "Your role"}
              {iv.scheduled_at || iv.completed_at
                ? ` · ${formatDateTime((iv.scheduled_at ?? iv.completed_at) as string)}`
                : ""}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {formatEnumLabel(iv.status)}
          </Badge>
          {iv.status === "completed" && !readOnly ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onFeedback({
                  interview_id: iv.id,
                  candidate_match_id: iv.candidate_match_id,
                  candidate_name: iv.candidate?.name ?? "Candidate",
                  position_id: iv.position_id ?? null,
                  position_title: iv.position?.title ?? "Your role",
                  interview_type: iv.interview_type ?? null,
                  happened_at: iv.completed_at ?? iv.scheduled_at ?? null,
                  prompt_from: null,
                  status: iv.status,
                })
              }
            >
              Feedback
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
