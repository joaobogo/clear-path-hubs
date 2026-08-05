import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Check, Info, Loader2, Plus, Sparkles, X } from "lucide-react";
import {
  MAX_MUST_HAVES,
  MAX_REQUIREMENTS,
  MAX_REQUIREMENT_CHARS,
  REQUIREMENT_TAGS,
  REQUIREMENT_TAG_EFFECTS,
  REQUIREMENT_TAG_LABELS,
  countMustHaves,
  normalizeRequirementKey,
  requirementExamples,
  type RequirementItem,
  type RequirementTag,
} from "@/lib/express-intake-schema";

/**
 * One requirements list where every item carries a tag.
 *
 * The tag is the whole point: must-haves filter the shortlist, nice-to-haves
 * order it, and trainable items are excluded from filtering entirely. That is
 * printed on screen next to the list, because a client who does not know what a
 * tag does cannot use it honestly.
 */

export type SuggestionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; items: RequirementItem[] }
  | { kind: "failed" };

const TAG_STYLES: Record<RequirementTag, string> = {
  must_have:
    "border-[color:var(--brand-navy)]/70 bg-[color:var(--brand-navy)] text-white",
  nice_to_have:
    "border-[color:var(--brand-navy)]/25 bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]",
  trainable:
    "border-[color:var(--brand-navy)]/20 bg-white text-[color:var(--brand-navy)]/80",
};

export function RequirementsList({
  items,
  onChange,
  rowErrors,
  listError,
  needsConfirm,
  manyConfirmed,
  onConfirmMany,
  roleTitle,
  suggestions,
  onRetrySuggestions,
}: {
  items: RequirementItem[];
  onChange: (next: RequirementItem[]) => void;
  rowErrors: Record<number, string>;
  listError: string | null;
  needsConfirm: boolean;
  manyConfirmed: boolean;
  onConfirmMany: (confirmed: boolean) => void;
  roleTitle: string;
  suggestions: SuggestionState;
  onRetrySuggestions?: () => void;
}) {
  const mustHaves = countMustHaves(items);
  const existingKeys = new Set(items.map((i) => normalizeRequirementKey(i.text)));

  const setItem = (index: number, patch: Partial<RequirementItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
  };
  const add = (item?: RequirementItem) => {
    if (items.length >= MAX_REQUIREMENTS) return;
    onChange([...items, item ?? { text: "", tag: "must_have" }]);
  };

  return (
    <div className="space-y-4" data-field="Requirements">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Requirements</p>
        <p className="text-xs text-[color:var(--brand-navy)]/70">
          {mustHaves} must {mustHaves === 1 ? "have" : "haves"} · {items.length} in total
        </p>
      </div>

      {/* What each tag actually does. Not decoration — this is the instruction. */}
      <ul className="space-y-1 rounded-lg border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/3 p-3 text-xs text-[color:var(--brand-navy)]/80">
        {REQUIREMENT_TAGS.map((tag) => (
          <li key={tag}>
            <span className="font-semibold">{REQUIREMENT_TAG_LABELS[tag]}:</span>{" "}
            {REQUIREMENT_TAG_EFFECTS[tag]}
          </li>
        ))}
      </ul>

      {suggestions.kind === "loading" && (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-[color:var(--brand-navy)]/75">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading your job description for suggestions…
          </p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-md bg-[color:var(--brand-navy)]/8"
            />
          ))}
        </div>
      )}

      {suggestions.kind === "failed" && (
        <p
          className="flex items-start gap-2 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3 text-xs text-[color:var(--brand-navy)]/80"
          aria-live="polite"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            We could not read suggestions from your job description. Write your requirements below —
            nothing is lost.{" "}
            {onRetrySuggestions && (
              <button
                type="button"
                onClick={onRetrySuggestions}
                className="font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            )}
          </span>
        </p>
      )}

      {suggestions.kind === "ready" && (
        <SuggestionRows
          items={suggestions.items.filter(
            (s) => !existingKeys.has(normalizeRequirementKey(s.text)),
          )}
          onAccept={(item) => add(item)}
        />
      )}

      {items.length === 0 ? (
        <EmptyExamples
          roleTitle={roleTitle}
          onUse={(examples) => onChange(examples)}
          onStartBlank={() => add()}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const error = rowErrors[index];
            return (
              <li
                key={index}
                className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.text}
                      maxLength={MAX_REQUIREMENT_CHARS}
                      onChange={(e) => setItem(index, { text: e.target.value })}
                      placeholder="Has run a site through a regulatory inspection"
                      aria-label={`Requirement ${index + 1}`}
                      aria-invalid={Boolean(error)}
                    />
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={`Requirement ${index + 1} tag`}
                    >
                      {REQUIREMENT_TAGS.map((tag) => {
                        const active = item.tag === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setItem(index, { tag })}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                              active
                                ? TAG_STYLES[tag]
                                : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/60 hover:border-[color:var(--brand-navy)]/35"
                            }`}
                          >
                            {REQUIREMENT_TAG_LABELS[tag]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Move requirement ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Move requirement ${index + 1} down`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Remove requirement ${index + 1}`}
                      onClick={() => removeItem(index)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {error && (
                  <p
                    data-field-error="true"
                    role="alert"
                    className="mt-2 text-sm text-[color:var(--brand-danger)]"
                  >
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add()}
          disabled={items.length >= MAX_REQUIREMENTS}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add requirement
        </Button>
        {items.length >= MAX_REQUIREMENTS && (
          <span className="text-xs text-[color:var(--brand-navy)]/70">
            That is as long as this list gets. Trim before adding more.
          </span>
        )}
      </div>

      {listError && (
        <p
          data-field-error="true"
          role="alert"
          className="text-sm text-[color:var(--brand-danger)]"
        >
          {listError}
        </p>
      )}

      {mustHaves > MAX_MUST_HAVES && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-navy)]/4 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={manyConfirmed}
            onChange={(e) => onConfirmMany(e.target.checked)}
          />
          <span>
            I want all {mustHaves} of these treated as must-haves, and I accept a smaller shortlist.
            {needsConfirm ? "" : " Confirmed."}
          </span>
        </label>
      )}
    </div>
  );
}

function SuggestionRows({
  items,
  onAccept,
}: {
  items: RequirementItem[];
  onAccept: (item: RequirementItem) => void;
}) {
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const visible = items.filter((i) => !dismissed.includes(normalizeRequirementKey(i.text)));
  if (visible.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-[color:var(--brand-navy)]/25 bg-white p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--brand-navy)]/80">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        From your job description — accept the ones you agree with
      </p>
      <p className="text-xs text-[color:var(--brand-navy)]/70">
        Nothing here counts until you add it. Edit the wording and the tag once it is in your list.
      </p>
      <ul className="space-y-1.5">
        {visible.map((item) => (
          <li
            key={normalizeRequirementKey(item.text)}
            className="flex items-center gap-2 rounded-md bg-[color:var(--brand-navy)]/4 px-2.5 py-1.5"
          >
            <span className="flex-1 text-sm">{item.text}</span>
            <span className="hidden text-xs text-[color:var(--brand-navy)]/65 sm:inline">
              {REQUIREMENT_TAG_LABELS[item.tag]}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => onAccept(item)}
            >
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label={`Dismiss suggestion: ${item.text}`}
              onClick={() =>
                setDismissed((d) => [...d, normalizeRequirementKey(item.text)])
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyExamples({
  roleTitle,
  onUse,
  onStartBlank,
}: {
  roleTitle: string;
  onUse: (items: RequirementItem[]) => void;
  onStartBlank: () => void;
}) {
  const examples = requirementExamples(roleTitle);
  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/3 p-4">
      <p className="text-sm font-medium">
        Three worked examples{roleTitle.trim() ? ` for a ${roleTitle.trim()}` : ""}
      </p>
      <ul className="space-y-1.5 text-sm text-[color:var(--brand-navy)]/80">
        {examples.map((ex) => (
          <li key={ex.text}>
            <span className="font-semibold">{REQUIREMENT_TAG_LABELS[ex.tag]}:</span> {ex.text}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onUse(examples)}>
          Start from these and edit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onStartBlank}>
          Write my own
        </Button>
      </div>
    </div>
  );
}

/** Kept for clients who prefer typing a block of lines; not rendered by default. */
export function requirementsFromTextarea(value: string, tag: RequirementTag): RequirementItem[] {
  return value
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ text, tag }));
}

export { Textarea as _Textarea };
