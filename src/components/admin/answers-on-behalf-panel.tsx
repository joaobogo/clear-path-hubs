// Staff entry of screening answers on a candidate's behalf, and the confirm
// step before publishing a candidate whose answers are recruiter-entered.
//
// The candidate's own answers are never editable here. An answer entered from
// this panel is stored as recruiter-entered with its source note, labelled as
// such for staff and for the client, and replaced by the candidate's own
// answer when they answer from their status page.
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  acknowledgeRecruiterAnswers,
  recordAnswersOnBehalf,
} from "@/lib/candidate/answers-on-behalf.functions";
import {
  SOURCE_NOTE_MAX,
  pendingCandidateConfirmation,
  sourceNoteProblem,
} from "@/lib/candidate/answer-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type Question = {
  id: string;
  question: string;
  answer_type: string | null;
  required: boolean | null;
  dealbreaker: boolean | null;
};

type StoredAnswer = {
  question_id: string;
  answer: unknown;
  answered_by: string | null;
  candidate_confirmed_at: string | null;
};

export type RecruiterAnswerState = {
  pending: number;
  needs_acknowledgement: boolean;
  acknowledged_at: string | null;
};

function storedValue(answer: unknown): string {
  const v =
    answer && typeof answer === "object" && !Array.isArray(answer) && "value" in answer
      ? (answer as { value: unknown }).value
      : answer;
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function AnswersOnBehalfPanel({
  matchId,
  questions,
  answers,
  state,
  hasApplication,
  onChanged,
}: {
  matchId: string;
  questions: Question[];
  answers: StoredAnswer[];
  state: RecruiterAnswerState | null;
  hasApplication: boolean;
  onChanged: () => void;
}) {
  const recordFn = useServerFn(recordAnswersOnBehalf);
  const acknowledgeFn = useServerFn(acknowledgeRecruiterAnswers);
  const [open, setOpen] = useState(false);
  const [sourceNote, setSourceNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const byQuestion = useMemo(() => new Map(answers.map((a) => [a.question_id, a])), [answers]);
  // Questions the recruiter may fill: unanswered, or answered only by a recruiter.
  const enterable = useMemo(
    () =>
      questions.filter((q) => {
        const a = byQuestion.get(q.id);
        return !a || pendingCandidateConfirmation(a);
      }),
    [questions, byQuestion],
  );

  const record = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          match_id: matchId,
          source_note: sourceNote,
          answers: enterable
            .map((q) => ({ question_id: q.id, value: (values[q.id] ?? "").trim() }))
            .filter((a) => a.value !== ""),
        },
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      setValues({});
      setSourceNote("");
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toastError(e),
  });

  const acknowledge = useMutation({
    mutationFn: () => acknowledgeFn({ data: { match_id: matchId } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      onChanged();
    },
    onError: (e: Error) => toastError(e),
  });

  const noteProblem = sourceNoteProblem(sourceNote);
  const filled = enterable.some((q) => (values[q.id] ?? "").trim() !== "");

  return (
    <div className="mt-3 space-y-3">
      {state && state.pending > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {state.pending === 1
              ? "1 answer was entered by a recruiter"
              : `${state.pending} answers were entered by a recruiter`}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              The candidate has not confirmed {state.pending === 1 ? "it" : "them"} yet.{" "}
              {state.pending === 1 ? "It counts" : "They count"} in the score, and the client sees{" "}
              {state.pending === 1 ? "it" : "them"} labelled as recruiter-entered. When the
              candidate answers from their status page, their own answers take over.
            </p>
            {state.needs_acknowledgement ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Publishing this candidate needs your confirmation first.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acknowledge.isPending}
                  onClick={() => acknowledge.mutate()}
                >
                  {acknowledge.isPending
                    ? "Confirming…"
                    : "Confirm: publish with recruiter-entered answers"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Confirmed for publishing with recruiter-entered answers.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {hasApplication && enterable.length > 0 && !open && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Enter answers on the candidate's behalf
        </Button>
      )}

      {open && (
        <div className="space-y-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Enter answers on the candidate's behalf</p>
            <p className="text-xs text-muted-foreground">
              For answers the candidate gave you on another channel. Leave blank what you do not
              know. Each answer is stored as recruiter-entered until the candidate confirms it.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="answers-source-note">Where these answers came from (required)</Label>
            <Input
              id="answers-source-note"
              value={sourceNote}
              maxLength={SOURCE_NOTE_MAX}
              placeholder="For example: phone call with the candidate, 26 Nov"
              onChange={(e) => setSourceNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Staff only. The client never sees this note.
            </p>
          </div>
          {enterable.map((q) => {
            const existing = byQuestion.get(q.id);
            const type = q.answer_type ?? "text";
            const value = values[q.id] ?? "";
            const set = (v: string) => setValues((s) => ({ ...s, [q.id]: v }));
            return (
              <div key={q.id} className="space-y-1">
                <Label htmlFor={`on-behalf-${q.id}`}>
                  {q.question}
                  {q.dealbreaker ? " (critical)" : ""}
                </Label>
                {existing && (
                  <p className="text-xs text-muted-foreground">
                    Recruiter-entered answer on file: {storedValue(existing.answer) || "empty"}.
                    Entering a new one replaces it; the earlier entry is kept as history.
                  </p>
                )}
                {type === "boolean" ? (
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={value === opt ? "default" : "outline"}
                        onClick={() => set(value === opt ? "" : opt)}
                      >
                        {opt === "yes" ? "Yes" : "No"}
                      </Button>
                    ))}
                  </div>
                ) : type === "number" ? (
                  <Input
                    id={`on-behalf-${q.id}`}
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                ) : type === "long_text" ? (
                  <Textarea
                    id={`on-behalf-${q.id}`}
                    rows={4}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                ) : (
                  <Input
                    id={`on-behalf-${q.id}`}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={record.isPending || !!noteProblem || !filled}
              onClick={() => record.mutate()}
            >
              {record.isPending ? "Saving…" : "Save as recruiter-entered"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {noteProblem && filled && (
              <span className="text-xs text-muted-foreground">{noteProblem}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
