/**
 * Inline notice for hiring criteria that state a protected attribute.
 *
 * Shows each finding with why it can't be used and the suggested wording.
 * The text only changes when the person presses "Use suggested wording" (or
 * "Remove it" when the right fix is removal); nothing is rewritten silently.
 * The same findings make the server refuse the save, so this is the place
 * the person fixes it rather than a warning they can click past.
 */
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CriteriaFieldFinding } from "@/lib/scoring/protected-attributes";

export function ProtectedCriteriaNotice({
  findings,
  onApply,
  className,
}: {
  findings: CriteriaFieldFinding[];
  onApply: (finding: CriteriaFieldFinding) => void;
  className?: string;
}) {
  if (findings.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="protected-criteria-notice"
      className={
        "rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm " + (className ?? "")
      }
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {findings.length === 1
          ? "One criterion can't be used as written"
          : `${findings.length} criteria can't be used as written`}
      </p>
      <ul className="mt-2 space-y-3">
        {findings.map((f) => {
          const reasons = [...new Set(f.findings.map((x) => x.message))];
          return (
            <li key={`${f.field}:${f.index ?? f.label}`} className="space-y-1">
              <p>
                <span className="font-medium">{f.label}:</span>{" "}
                <span className="italic">“{f.text}”</span>
              </p>
              {reasons.map((r) => (
                <p key={r} className="text-xs text-muted-foreground">
                  {r}
                </p>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs">
                  {f.replacement ? (
                    <>
                      Suggested: <span className="font-medium">“{f.replacement}”</span>
                    </>
                  ) : (
                    "Suggested: remove it."
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onApply(f)}
                  data-testid="protected-criteria-apply"
                >
                  {f.replacement ? "Use suggested wording" : "Remove it"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
