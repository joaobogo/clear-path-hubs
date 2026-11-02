/**
 * Inline notice for a dealbreaker screening question that asks for two
 * requirements at once ("X as well as Y").
 *
 * Shows each one with the suggested split. The questions only change when
 * the person presses a button; nothing is rewritten silently. A new or
 * edited one makes the server refuse the save; one that was already saved is
 * listed so it can be fixed, without blocking other edits.
 *
 * When the role has room, the action is "Split into two questions". When it
 * is at its question limit there is no room for two more, so the action is
 * "Keep as an optional question": the question stays, with its answers, and
 * is weighed without excluding anyone. Never a disabled button with nothing
 * else to press.
 */
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompoundDealbreakerFinding } from "@/lib/positions/compound-dealbreaker";
import { SCREENING_MAX_QUESTIONS } from "@/lib/screening-limits";

export function CompoundDealbreakerNotice({
  findings,
  canApply,
  onApply,
  onKeepOptional,
  className,
}: {
  findings: CompoundDealbreakerFinding[];
  /** False when the split would take the role over its question limit. */
  canApply: (finding: CompoundDealbreakerFinding) => boolean;
  onApply: (finding: CompoundDealbreakerFinding) => void;
  /** Turns the bundled question into an optional, non-dealbreaker one. */
  onKeepOptional: (finding: CompoundDealbreakerFinding) => void;
  className?: string;
}) {
  if (findings.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="compound-dealbreaker-notice"
      className={
        "rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm " + (className ?? "")
      }
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {findings.length === 1
          ? "A dealbreaker asks for two requirements at once"
          : `${findings.length} dealbreakers ask for two requirements at once`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        A candidate with one but not the other can only answer “no” and is excluded. Ask each
        requirement as its own dealbreaker.
      </p>
      <ul className="mt-2 space-y-3">
        {findings.map((f) => {
          const fits = canApply(f);
          return (
            <li key={`${f.index}:${f.text}`} className="space-y-1">
              <p>
                <span className="font-medium">{f.label}:</span>{" "}
                <span className="italic">“{f.text}”</span>
              </p>
              <p className="text-xs">
                Suggested: <span className="font-medium">“{f.questions[0]}”</span> and{" "}
                <span className="font-medium">“{f.questions[1]}”</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {fits ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onApply(f)}
                    data-testid="compound-dealbreaker-apply"
                  >
                    Split into two questions
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onKeepOptional(f)}
                    data-testid="compound-dealbreaker-keep-optional"
                  >
                    Keep as an optional question
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {!fits
                    ? `No room to split it: this role is at its ${SCREENING_MAX_QUESTIONS}-question limit. Kept as an optional question, it is weighed but excludes nobody, and its answers are kept. To split it instead, remove another question first.`
                    : f.id
                      ? "The original stays as an optional question that excludes nobody, so answers already given are kept."
                      : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
