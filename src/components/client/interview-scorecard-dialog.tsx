import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getScorecardContext, submitScorecard } from "@/lib/scorecards.functions";
import {
  RATING_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  completeness,
  type Recommendation,
  type Scorecard,
  type ScorecardRating,
} from "@/lib/interview-scorecard";

export function InterviewScorecardDialog({
  orgId,
  interviewId,
  open,
  onOpenChange,
}: {
  orgId: string;
  interviewId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getScorecardContext);
  const submitFn = useServerFn(submitScorecard);
  const [draft, setDraft] = useState<Scorecard | null>(null);

  const { data: ctx, isPending } = useQuery({
    queryKey: ["interview-scorecard", orgId, interviewId],
    queryFn: () => ctxFn({ data: { orgId, interviewId: interviewId! } }),
    enabled: open && !!interviewId,
  });

  useEffect(() => {
    if (ctx?.scorecard) setDraft(ctx.scorecard);
  }, [ctx]);

  const save = useMutation({
    mutationFn: () =>
      submitFn({ data: { orgId, interviewId: interviewId!, scorecard: draft!, complete: true } }),
    onSuccess: () => {
      toast.success("Feedback recorded.", {
        description: "We'll fold it into the shortlist and the hire record.",
      });
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toastError(e),
  });

  const c = draft ? completeness(draft.criteria) : null;

  const setCriterion = (key: string, patch: { rating?: ScorecardRating; note?: string }) =>
    setDraft((d) =>
      d
        ? { ...d, criteria: d.criteria.map((x) => (x.key === key ? { ...x, ...patch } : x)) }
        : d,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Interview feedback
          </DialogTitle>
          <DialogDescription>
            {ctx
              ? `${ctx.candidate_name} · ${ctx.position_title}. Rate each criterion you set at intake — it keeps feedback comparable across interviewers.`
              : "Rate the candidate against the criteria set at intake."}
          </DialogDescription>
        </DialogHeader>

        {isPending || !draft ? (
          <p className="py-6 text-sm text-muted-foreground">Loading criteria…</p>
        ) : (
          <div className="space-y-5">
            {draft.criteria.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No criteria captured for this role yet — use the summary below, then add
                requirements to the role so future feedback is structured.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Role criteria
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {c!.rated} of {c!.total} rated
                  </span>
                </div>
                {draft.criteria.map((crit) => (
                  <div key={crit.key} className="rounded-md border bg-background/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{crit.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {crit.kind === "must" ? "Required" : "Preferred"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {([1, 2, 3, 4] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={crit.rating === r}
                          onClick={() =>
                            setCriterion(crit.key, { rating: crit.rating === r ? null : r })
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            crit.rating === r
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          {RATING_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={crit.note}
                      onChange={(e) => setCriterion(crit.key, { note: e.target.value })}
                      placeholder="What did you see? (example, answer, or concern)"
                      className="mt-2 min-h-[52px] text-sm"
                      maxLength={1000}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Recommendation
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {RECOMMENDATIONS.map((r: Recommendation) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={draft.recommendation === r}
                    onClick={() => setDraft({ ...draft, recommendation: r })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      draft.recommendation === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    {RECOMMENDATION_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sc-strengths" className="text-xs text-muted-foreground">
                  Strengths
                </Label>
                <Textarea
                  id="sc-strengths"
                  value={draft.strengths}
                  onChange={(e) => setDraft({ ...draft, strengths: e.target.value })}
                  className="mt-1 min-h-[70px]"
                  maxLength={2000}
                />
              </div>
              <div>
                <Label htmlFor="sc-concerns" className="text-xs text-muted-foreground">
                  Concerns
                </Label>
                <Textarea
                  id="sc-concerns"
                  value={draft.concerns}
                  onChange={(e) => setDraft({ ...draft, concerns: e.target.value })}
                  className="mt-1 min-h-[70px]"
                  maxLength={2000}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sc-summary" className="text-xs text-muted-foreground">
                Summary for the record
              </Label>
              <Textarea
                id="sc-summary"
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                className="mt-1 min-h-[70px]"
                maxLength={4000}
              />
            </div>

            {c && !c.complete && c.requiredTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                {c.requiredTotal - c.requiredRated} required criteri
                {c.requiredTotal - c.requiredRated === 1 ? "on" : "a"} still unrated — you can
                save now and finish later.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!draft || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
