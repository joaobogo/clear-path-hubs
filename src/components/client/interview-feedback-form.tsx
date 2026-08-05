import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DECLINE_CONCERN_MIN,
  FEEDBACK_NEXT_STEP_LABEL,
  FEEDBACK_RECOMMENDATION_LABEL,
  FEEDBACK_TEXT_MAX,
  NEXT_STEP_OPTIONS,
  RECOMMENDATION_OPTIONS,
  clearLocalDraft,
  emptyFeedbackDraft,
  readLocalDraft,
  validateFeedback,
  writeLocalDraft,
  type FeedbackNextStep,
  type FeedbackRecommendation,
  type InterviewFeedbackDraft,
} from "@/lib/interview-feedback";
import {
  listInterviewsAwaitingFeedback,
  submitInterviewFeedback,
  type FeedbackQueueItem,
} from "@/lib/interview-feedback.functions";

function whenLabel(iso: string | null): string {
  if (!iso) return "recently";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "recently";
  }
}

/** Segmented choice — plain labels, no colour-only meaning. */
function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  name,
}: {
  label: string;
  options: { value: T; label: string; hint: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | undefined;
  name: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {label} <span className="text-muted-foreground">(required)</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              name={name}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function InterviewFeedbackForm({
  orgId,
  item,
  readOnly = false,
  onSubmitted,
}: {
  orgId: string;
  item: FeedbackQueueItem;
  readOnly?: boolean;
  onSubmitted?: (movedTo: string | null) => void;
}) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitInterviewFeedback);
  const [draft, setDraft] = useState<InterviewFeedbackDraft>(() => emptyFeedbackDraft());
  const [showErrors, setShowErrors] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // A half-written form survives a refresh.
  useEffect(() => {
    const saved = readLocalDraft(item.interview_id);
    setDraft(saved ?? emptyFeedbackDraft());
    setShowErrors(false);
    setSaveFailed(false);
  }, [item.interview_id]);

  const patch = (p: Partial<InterviewFeedbackDraft>) =>
    setDraft((d) => {
      const next = { ...d, ...p };
      writeLocalDraft(item.interview_id, next);
      return next;
    });

  const errors = useMemo(() => validateFeedback(draft), [draft]);

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          orgId,
          interviewId: item.interview_id,
          recommendation: draft.recommendation as FeedbackRecommendation,
          nextStep: draft.next_step as FeedbackNextStep,
          strengths: draft.strengths.trim(),
          concerns: draft.concerns.trim(),
        },
      }),
    onSuccess: (res) => {
      // Only clear the typed text once it is safely stored.
      clearLocalDraft(item.interview_id);
      setSaveFailed(false);
      void qc.invalidateQueries({ queryKey: ["interviews-awaiting-feedback"] });
      void qc.invalidateQueries({ queryKey: ["match-feedback"] });
      void qc.invalidateQueries({ queryKey: ["client-interviews"] });
      void qc.invalidateQueries({ queryKey: ["client-candidates"] });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
      onSubmitted?.((res as { moved_to: string | null }).moved_to ?? null);
    },
    onError: () => setSaveFailed(true),
  });

  const onSubmit = () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setSaveFailed(false);
    submit.mutate();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">
          {item.candidate_name} · {item.position_title}
        </p>
        <p className="text-xs text-muted-foreground">
          Interviewed {whenLabel(item.happened_at)}. Two minutes is enough — a recommendation, a
          line or two, and the next step.
        </p>
      </div>

      <ChoiceRow
        name={`recommendation-${item.interview_id}`}
        label="Recommendation"
        options={RECOMMENDATION_OPTIONS}
        value={draft.recommendation}
        onChange={(v) => patch({ recommendation: v })}
        error={showErrors ? errors.recommendation : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`strengths-${item.interview_id}`}>Strengths</Label>
          <Textarea
            id={`strengths-${item.interview_id}`}
            rows={3}
            maxLength={FEEDBACK_TEXT_MAX}
            placeholder="What stood out?"
            value={draft.strengths}
            onChange={(e) => patch({ strengths: e.target.value })}
          />
          <p className="text-right text-[11px] text-muted-foreground">
            {draft.strengths.length}/{FEEDBACK_TEXT_MAX}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`concerns-${item.interview_id}`}>
            Concerns
            {draft.recommendation === "decline" ? (
              <span className="text-muted-foreground"> (required to decline)</span>
            ) : null}
          </Label>
          <Textarea
            id={`concerns-${item.interview_id}`}
            rows={3}
            maxLength={FEEDBACK_TEXT_MAX}
            placeholder={
              draft.recommendation === "decline"
                ? `At least ${DECLINE_CONCERN_MIN} characters on why this is a no`
                : "Anything to check in the next round?"
            }
            value={draft.concerns}
            onChange={(e) => patch({ concerns: e.target.value })}
            aria-invalid={showErrors && !!errors.concerns}
          />
          <div className="flex items-center justify-between gap-2">
            {showErrors && errors.concerns ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.concerns}
              </p>
            ) : (
              <span />
            )}
            <p className="text-[11px] text-muted-foreground">
              {draft.concerns.length}/{FEEDBACK_TEXT_MAX}
            </p>
          </div>
        </div>
      </div>

      <ChoiceRow
        name={`next-step-${item.interview_id}`}
        label="Next step"
        options={NEXT_STEP_OPTIONS}
        value={draft.next_step}
        onChange={(v) => patch({ next_step: v })}
        error={showErrors ? errors.next_step : undefined}
      />

      {saveFailed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border taas-bd-danger taas-bg-danger-soft px-3 py-2 text-sm taas-fg-danger"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>We could not save your feedback. Your answers are still here.</span>
          <Button size="sm" variant="outline" onClick={onSubmit} disabled={submit.isPending}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {draft.next_step
            ? `Submitting moves ${item.candidate_name} to: ${FEEDBACK_NEXT_STEP_LABEL[draft.next_step]}.`
            : "Your draft is kept on this device until you submit."}
        </p>
        <Button onClick={onSubmit} disabled={readOnly || submit.isPending}>
          {submit.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            "Submit feedback"
          )}
        </Button>
      </div>
    </div>
  );
}

export function InterviewFeedbackDialog({
  orgId,
  item,
  open,
  onOpenChange,
  readOnly = false,
}: {
  orgId: string;
  item: FeedbackQueueItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" aria-hidden /> Interview feedback
          </DialogTitle>
          <DialogDescription>
            Recommendation, a line on strengths and concerns, and the next step.
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <InterviewFeedbackForm
            orgId={orgId}
            item={item}
            readOnly={readOnly}
            onSubmitted={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

/**
 * The review queue: interviews that happened and still need feedback. The
 * prompt lives here, in the work the client already opens.
 */
export function InterviewFeedbackQueue({
  orgId,
  readOnly = false,
}: {
  orgId: string;
  readOnly?: boolean;
}) {
  const listFn = useServerFn(listInterviewsAwaitingFeedback);
  const query = useQuery({
    queryKey: ["interviews-awaiting-feedback", orgId],
    queryFn: () => listFn({ data: { orgId } }),
    enabled: !!orgId,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const items = (query.data as FeedbackQueueItem[] | undefined) ?? [];

  useEffect(() => {
    if (items.length > 0 && openId === null) setOpenId(items[0]!.interview_id);
  }, [items, openId]);

  if (query.isLoading) return <FormSkeleton />;

  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border taas-bd-danger taas-bg-danger-soft p-4 text-sm taas-fg-danger"
      >
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>We could not load interviews to review.</span>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> No interviews to review
        </span>
      </div>
    );
  }

  const active = items.find((i) => i.interview_id === openId) ?? items[0]!;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Interviews to review</h2>
          <p className="text-xs text-muted-foreground">
            {items.length === 1
              ? "One interview is waiting on your feedback."
              : `${items.length} interviews are waiting on your feedback.`}
          </p>
        </div>
        <Badge variant="outline">Two minutes each</Badge>
      </header>

      {items.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <button
              key={i.interview_id}
              type="button"
              aria-pressed={i.interview_id === active.interview_id}
              onClick={() => setOpenId(i.interview_id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                i.interview_id === active.interview_id
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted/60",
              )}
            >
              {i.candidate_name}
            </button>
          ))}
        </div>
      ) : null}

      <InterviewFeedbackForm orgId={orgId} item={active} readOnly={readOnly} />
    </section>
  );
}

/** Read-only view of feedback already given — visible to the whole team. */
export function SubmittedFeedbackList({
  rows,
}: {
  rows: {
    id: string;
    reviewer_name: string | null;
    recommendation: FeedbackRecommendation;
    next_step: FeedbackNextStep | null;
    strengths: string | null;
    concerns: string | null;
    submitted_at: string;
  }[];
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{FEEDBACK_RECOMMENDATION_LABEL[r.recommendation]}</Badge>
            {r.next_step ? (
              <span className="text-xs text-muted-foreground">
                Next: {FEEDBACK_NEXT_STEP_LABEL[r.next_step]}
              </span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {r.reviewer_name ?? "Your team"} · {whenLabel(r.submitted_at)}
            </span>
          </div>
          {r.strengths ? (
            <p className="mt-2 whitespace-pre-wrap">
              <span className="text-xs font-medium text-muted-foreground">Strengths: </span>
              {r.strengths}
            </p>
          ) : null}
          {r.concerns ? (
            <p className="mt-1 whitespace-pre-wrap">
              <span className="text-xs font-medium text-muted-foreground">Concerns: </span>
              {r.concerns}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
