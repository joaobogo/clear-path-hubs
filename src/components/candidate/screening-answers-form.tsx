import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PublicScreeningQuestion } from "@/lib/apply-status.functions";
import { SCREENING_ANSWER_MAX } from "@/lib/screening-limits";
import { DIRECT_CONTACT_EMAIL } from "@/config/direct-contact";

type Credentials = { reference: string; email: string };
type Value = string | boolean | number | null;

/**
 * The role's screening questions, answered on an existing application — for a
 * CV that reached the team by email and never went through the apply form.
 * Fields render the way the apply form renders them.
 */
export function ScreeningAnswersForm({
  credentials,
  questions,
  submitFn,
  onAnswered,
}: {
  credentials: Credentials;
  questions: PublicScreeningQuestion[];
  submitFn: (args: {
    data: Credentials & { answers: Array<{ question_id: string; value: Value }> };
  }) => Promise<{ ok: boolean; message: string }>;
  onAnswered: () => Promise<void> | void;
}) {
  const [answers, setAnswers] = useState<Record<string, Value>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = (id: string, v: Value) => setAnswers((p) => ({ ...p, [id]: v }));

  const submit = async () => {
    setError(null);
    setSending(true);
    try {
      const res = await submitFn({
        data: {
          ...credentials,
          answers: questions.map((q) => ({ question_id: q.id, value: answers[q.id] ?? null })),
        },
      });
      if (res.ok) {
        setDone(res.message);
        await onAnswered();
      } else {
        setError(res.message);
      }
    } catch {
      setError(
        `We couldn't send your answers just now. Try again, or email ${DIRECT_CONTACT_EMAIL}.`,
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Alert className="mt-6">
        <AlertDescription>{done}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section
      className="mt-6 rounded-lg border bg-card p-5 sm:p-6"
      aria-labelledby="screening-heading"
    >
      <h2 id="screening-heading" className="text-base font-semibold">
        Answer the role&apos;s screening questions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The role asks these and we do not have your answers yet. They take a couple of minutes and
        go to the review team with your application.
      </p>
      <form
        noValidate
        className="mt-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {questions.map((q) => {
          const val = answers[q.id];
          const describedBy = q.why_asked ? `${q.id}-why` : undefined;
          return (
            <fieldset
              key={q.id}
              className="m-0 space-y-1 border-0 p-0"
              aria-labelledby={`${q.id}-label`}
            >
              <Label id={`${q.id}-label`} htmlFor={q.id}>
                {q.question}
                {q.required && " *"}
              </Label>
              {q.why_asked && (
                <p id={`${q.id}-why`} className="text-xs text-muted-foreground">
                  Why we ask: {q.why_asked}
                </p>
              )}
              {q.answer_type === "boolean" ? (
                <RadioGroup
                  id={q.id}
                  aria-describedby={describedBy}
                  value={val === true ? "yes" : val === false ? "no" : ""}
                  onValueChange={(v) => set(q.id, v === "yes")}
                  className="mt-1 flex gap-4"
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <RadioGroupItem value="yes" id={`${q.id}-y`} /> Yes
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <RadioGroupItem value="no" id={`${q.id}-n`} /> No
                  </label>
                </RadioGroup>
              ) : q.answer_type === "number" ? (
                <Input
                  id={q.id}
                  type="number"
                  inputMode="decimal"
                  aria-describedby={describedBy}
                  value={val == null ? "" : String(val)}
                  onChange={(e) => set(q.id, e.target.value === "" ? null : Number(e.target.value))}
                />
              ) : (
                <Textarea
                  id={q.id}
                  aria-describedby={describedBy}
                  maxLength={SCREENING_ANSWER_MAX}
                  rows={q.answer_type === "long_text" ? 4 : 3}
                  value={typeof val === "string" ? val : ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}
            </fieldset>
          );
        })}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="min-h-11" disabled={sending}>
          {sending ? "Sending…" : "Send my answers"}
        </Button>
      </form>
    </section>
  );
}
