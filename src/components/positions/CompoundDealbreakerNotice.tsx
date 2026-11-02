/**
 * Inline notice for a dealbreaker screening question that asks for two
 * requirements at once ("X as well as Y").
 *
 * Shows each one with the suggested split. The questions only change when
 * the person presses "Split into two questions"; nothing is rewritten
 * silently. A new or edited one makes the server refuse the save; one that
 * was already saved is listed so it can be split, without blocking other
 * edits.
 */
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompoundDealbreakerFinding } from "@/lib/positions/compound-dealbreaker";

export function CompoundDealbreakerNotice({
  findings,
  canApply,
  onApply,
  className,
}: {
  findings: CompoundDealbreakerFinding[];
  /** False when the split would take the role over its question limit. */
  canApply: (finding: CompoundDealbreakerFinding) => boolean;
  onApply: (finding: CompoundDealbreakerFinding) => void;
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!fits}
                  onClick={() => onApply(f)}
                  data-testid="compound-dealbreaker-apply"
                >
                  Split into two questions
                </Button>
                <p className="text-xs text-muted-foreground">
                  {!fits
                    ? "No room for two more questions: this role is at its question limit."
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
