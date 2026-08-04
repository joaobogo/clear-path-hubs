import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check, Circle, Clock, Loader2, Plus, X } from "lucide-react";
import {
  ONBOARDING_STEPS,
  formatMinutes,
  type OnboardingStep,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import {
  WEIGHT_DIMENSIONS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type EvaluationWeights,
} from "@/lib/requisition-schema";

/**
 * Shared pieces for the first-run sequence.
 *
 * Each step reads the same way: what this decides, what the system does with it,
 * and what happens next. Progress and time remaining are always visible so the
 * sequence never feels open-ended.
 */

export function StepRail({
  steps,
  active,
  complete,
  onSelect,
}: {
  steps: readonly OnboardingStep[];
  active: OnboardingStepId;
  complete: readonly OnboardingStepId[];
  onSelect: (id: OnboardingStepId) => void;
}) {
  return (
    <ol className="space-y-1">
      {steps.map((step) => {
        const done = complete.includes(step.id);
        const isActive = step.id === active;
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-border",
                )}
              >
                {done ? <Check className="size-3" aria-hidden /> : step.index}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{step.title}</span>
                <span className="block text-xs">
                  {done
                    ? step.required
                      ? "Done"
                      : "Reviewed"
                    : `${step.minutes} min${step.required ? "" : " · optional"}`}
                </span>

              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SequenceProgress({
  complete,
  remaining,
  active,
}: {
  complete: readonly OnboardingStepId[];
  remaining: number;
  active?: OnboardingStepId;
}) {
  const pct = Math.round((complete.length / ONBOARDING_STEPS.length) * 100);
  // The header must agree with the step you are actually looking at, otherwise
  // "Step 4 of 10" sits next to a panel labelled "Step 8".
  const activeIndex = active
    ? ONBOARDING_STEPS.find((s) => s.id === active)?.index
    : undefined;
  const shown = activeIndex ?? Math.min(complete.length + 1, ONBOARDING_STEPS.length);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          Step {shown} of {ONBOARDING_STEPS.length}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {formatMinutes(remaining)} left
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Setup progress"
      >
        <div className="motion-progress h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StepHeader({ step }: { step: OnboardingStep }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Step {step.index}</Badge>
        {!step.required && <Badge variant="secondary">Optional</Badge>}
        <span className="text-xs text-muted-foreground">{step.minutes} min</span>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground">{step.purpose}</p>
      </div>
      <p className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
        {step.systemWork}
      </p>
    </header>
  );
}

export function StepFooter({
  step,
  onBack,
  onSave,
  onContinue,
  saving,
  continueLabel,
  continueDisabled,
  skipLabel,
  onSkip,
}: {
  step: OnboardingStep;
  onBack?: () => void;
  onSave?: () => void;
  onContinue: () => void;
  saving?: boolean;
  continueLabel?: string;
  continueDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <p className="text-sm text-muted-foreground">{step.whatNext}</p>
      <div className="flex flex-wrap items-center gap-2">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
            Back
          </Button>
        )}
        <Button type="button" onClick={onContinue} disabled={saving || continueDisabled}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {continueLabel ?? "Save and continue"}
        </Button>
        {onSkip && (
          <Button type="button" variant="outline" onClick={onSkip} disabled={saving}>
            {skipLabel ?? "Skip for now"}
          </Button>
        )}
        {onSave && (
          <Button type="button" variant="ghost" onClick={onSave} disabled={saving}>
            Save and finish later
          </Button>
        )}
      </div>
    </div>
  );
}

/** A plain add/remove list. Used for must-haves, nice-to-haves, dealbreakers. */
export function TagListEditor({
  label,
  help,
  items,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  help: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, value].slice(0, 40));
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          aria-label={label}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">Add {label}</span>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm">
                {item}
                <button
                  type="button"
                  onClick={() => onChange(items.filter((i) => i !== item))}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${item}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Weight sliders that always add up to 100. */
export function WeightEditor({
  weights,
  onChange,
  disabled,
}: {
  weights: EvaluationWeights;
  onChange: (next: EvaluationWeights) => void;
  disabled?: boolean;
}) {
  const total = WEIGHT_DIMENSIONS.reduce((sum, d) => sum + (weights[d.key] ?? 0), 0);
  return (
    <div className="space-y-5">
      {WEIGHT_DIMENSIONS.map((dim) => (
        <div key={dim.key} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`weight-${dim.key}`} className="text-sm font-medium">
              {dim.label}
            </label>
            <span className="text-sm tabular-nums text-muted-foreground">
              {weights[dim.key] ?? 0}%
            </span>
          </div>
          <Slider
            id={`weight-${dim.key}`}
            value={[weights[dim.key] ?? 0]}
            min={WEIGHT_MIN}
            max={WEIGHT_MAX}
            step={1}
            disabled={disabled}
            onValueChange={(v) => onChange({ ...weights, [dim.key]: v[0] ?? 0 })}
          />
        </div>
      ))}
      <p
        className={cn(
          "text-sm",
          total === 100 ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {total === 100
          ? "Weights add up to 100%. Every score run records these exact numbers."
          : `Weights add up to ${total}%. They will be balanced to 100% when you save.`}
      </p>
    </div>
  );
}

export function ReviewRow({
  label,
  value,
  onEdit,
  done,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  done: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          {done ? (
            <Check className="size-3.5 text-primary" aria-hidden />
          ) : (
            <Circle className="size-3.5 text-muted-foreground" aria-hidden />
          )}
          {label}
        </p>
        <p className="truncate text-sm text-muted-foreground">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}
