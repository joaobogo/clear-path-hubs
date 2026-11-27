/**
 * The one-page apply form for jobs on the structured screening pilot
 * (src/lib/screening/structured.ts). The apply route renders this only when
 * the public payload carries `structured_screening`; every other job keeps
 * the step-by-step form untouched.
 *
 * Holds no state of its own: the route keeps the values (so they join the
 * draft saved on this device), validates on submit and sends them.
 */
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STRUCTURED_SECTIONS,
  STRUCTURED_SECTION_TITLES,
  STRUCTURED_TEXT_MAX,
  type StructuredQuestion,
  type StructuredSection,
} from "@/lib/screening/structured";
import {
  shownQuestions,
  structuredProgress,
  type PublicStructuredQuestion,
  type StructuredFormFields,
  type StructuredFormValue,
  type StructuredFormValues,
} from "@/components/apply/structured-screening-state";

/** Up to this many options show as tap buttons; more become a dropdown. */
const BUTTON_OPTION_LIMIT = 5;

// ---------------------------------------------------------------------------

interface Props {
  questions: readonly PublicStructuredQuestion[];
  values: StructuredFormValues;
  onChange: (key: string, value: StructuredFormValue) => void;
  /** The page's field errors; pilot questions use `sq:<key>`. */
  errors: Record<string, string>;
  /** The form fields that answer the LinkedIn and location questions. */
  formFields: StructuredFormFields;
  /** The page's existing details fields, shown first under "About you". */
  aboutYou?: ReactNode;
}

export function StructuredScreeningFields({
  questions,
  values,
  onChange,
  errors,
  formFields,
  aboutYou,
}: Props) {
  const { answered, total } = structuredProgress(questions, values, formFields);
  const shown = shownQuestions(questions, values);
  const bySection = (s: StructuredSection) => shown.filter((q) => q.section === s);

  return (
    <div className="min-w-0 space-y-8" data-testid="structured-screening">
      <p
        className="text-sm font-medium text-[color:var(--brand-navy)]"
        aria-live="polite"
        data-testid="structured-progress"
      >
        {answered} of {total} answered
      </p>

      {STRUCTURED_SECTIONS.map((section) => {
        const qs = bySection(section);
        const slot = section === "about_you" ? aboutYou : null;
        if (qs.length === 0 && !slot) return null;
        const headingId = `sq-section-${section}`;
        return (
          <section key={section} aria-labelledby={headingId} className="min-w-0 space-y-5">
            <h2 id={headingId} className="text-lg font-semibold">
              {STRUCTURED_SECTION_TITLES[section]}
            </h2>
            {slot}
            {qs.map((q) => (
              <StructuredQuestionField
                key={q.key}
                question={q}
                value={values[q.key] ?? null}
                error={errors[`sq:${q.key}`]}
                onChange={(v) => onChange(q.key, v)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StructuredQuestionField({
  question: q,
  value,
  error,
  onChange,
}: {
  question: StructuredQuestion;
  value: StructuredFormValue;
  error?: string;
  onChange: (v: StructuredFormValue) => void;
}) {
  const id = `sq-${q.key}`;
  const field = `sq:${q.key}`;
  const labelId = `${id}-label`;
  const helpId = q.help ? `${id}-help` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const aria = {
    "aria-describedby": describedBy,
    ...(error ? { "aria-invalid": true as const } : {}),
  };
  const options = q.options ?? [];
  // A single input carries the label; a group of buttons is named by it.
  const singleInput =
    q.type === "short_text" ||
    q.type === "url" ||
    (q.type === "single_select" && options.length > BUTTON_OPTION_LIMIT);

  let control: ReactNode;
  switch (q.type) {
    case "yes_no":
      control = (
        <ChoiceButtons
          field={field}
          labelId={labelId}
          aria={aria}
          options={[
            { label: "Yes", pressed: value === true, onClick: () => onChange(true) },
            { label: "No", pressed: value === false, onClick: () => onChange(false) },
          ]}
        />
      );
      break;
    case "single_select":
      control =
        options.length > BUTTON_OPTION_LIMIT ? (
          <select
            id={id}
            data-field={field}
            {...aria}
            className="flex h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">Choose one</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <ChoiceButtons
            field={field}
            labelId={labelId}
            aria={aria}
            options={options.map((o) => ({
              label: o,
              pressed: value === o,
              onClick: () => onChange(o),
            }))}
          />
        );
      break;
    case "multi_select": {
      const picked = Array.isArray(value) ? value : [];
      const isNone = (o: string) => /^none\b/i.test(o);
      control = (
        <ChoiceButtons
          field={field}
          labelId={labelId}
          aria={aria}
          options={options.map((o) => ({
            label: o,
            pressed: picked.includes(o),
            onClick: () => {
              if (picked.includes(o)) return onChange(picked.filter((x) => x !== o));
              // "None" is an answer on its own: picking it clears the rest,
              // and picking anything else clears it.
              if (isNone(o)) return onChange([o]);
              onChange([...picked.filter((x) => !isNone(x)), o]);
            },
          }))}
        />
      );
      break;
    }
    case "short_text": {
      const text = typeof value === "string" ? value : "";
      control = (
        <>
          <Input
            id={id}
            data-field={field}
            {...aria}
            aria-describedby={[describedBy, `${id}-count`].filter(Boolean).join(" ")}
            maxLength={STRUCTURED_TEXT_MAX}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
          <p id={`${id}-count`} className="text-xs text-muted-foreground">
            {text.length} of {STRUCTURED_TEXT_MAX} characters
          </p>
        </>
      );
      break;
    }
    case "url":
      control = (
        <Input
          id={id}
          type="url"
          inputMode="url"
          data-field={field}
          {...aria}
          placeholder="https://…"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "number_range": {
      const range =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : { min: null, max: null };
      const toNumber = (s: string) => {
        const digits = s.replace(/\D/g, "");
        return digits ? Number(digits) : null;
      };
      const unitId = q.unit ? `${id}-unit` : null;
      const rangeDescribedBy = [describedBy, unitId].filter(Boolean).join(" ") || undefined;
      control = (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label htmlFor={`${id}-min`} className="text-xs font-normal text-muted-foreground">
                From
              </Label>
              <Input
                id={`${id}-min`}
                data-field={field}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                {...aria}
                aria-describedby={rangeDescribedBy}
                className="mt-1"
                value={range.min == null ? "" : String(range.min)}
                onChange={(e) => onChange({ ...range, min: toNumber(e.target.value) })}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${id}-max`} className="text-xs font-normal text-muted-foreground">
                To
              </Label>
              <Input
                id={`${id}-max`}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                {...aria}
                aria-describedby={rangeDescribedBy}
                className="mt-1"
                value={range.max == null ? "" : String(range.max)}
                onChange={(e) => onChange({ ...range, max: toNumber(e.target.value) })}
              />
            </div>
          </div>
          {q.unit && (
            <p id={unitId ?? undefined} className="text-xs text-muted-foreground">
              {q.unit}. Leave either box empty if you prefer.
            </p>
          )}
        </div>
      );
      break;
    }
  }

  return (
    <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0" aria-labelledby={labelId}>
      <Label id={labelId} htmlFor={singleInput ? id : undefined} className="leading-snug">
        {q.label}
        {q.required && " *"}
      </Label>
      {q.help && (
        <p id={helpId ?? undefined} className="text-xs text-muted-foreground">
          {q.help}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId ?? undefined} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ChoiceButtons({
  field,
  labelId,
  aria,
  options,
}: {
  field: string;
  labelId: string;
  aria: { "aria-describedby"?: string; "aria-invalid"?: true };
  options: Array<{ label: string; pressed: boolean; onClick: () => void }>;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={aria["aria-describedby"]}
      className="flex min-w-0 flex-wrap gap-2"
    >
      {options.map((o, i) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={o.pressed}
          {...(i === 0 ? { "data-field": field } : {})}
          {...(aria["aria-invalid"] && i === 0 ? { "aria-invalid": true } : {})}
          onClick={o.onClick}
          className={`inline-flex min-h-11 max-w-full items-center rounded-md border px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            o.pressed
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background text-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
