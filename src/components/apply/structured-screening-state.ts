/**
 * Pure state helpers for the structured screening pilot's one-page apply form
 * (see structured-screening-fields.tsx). Kept apart from the component so the
 * route and tests can use them without React.
 */
import {
  FORM_FIELD_KEYS,
  isShown,
  normaliseAnswer,
  progress,
  sortQuestions,
  type StructuredQuestion,
  type StructuredValue,
} from "@/lib/screening/structured";

/** A question as the public job payload carries it. */
export type PublicStructuredQuestion = Pick<
  StructuredQuestion,
  | "key"
  | "label"
  | "type"
  | "options"
  | "required"
  | "section"
  | "sort_order"
  | "help"
  | "unit"
  | "show_when"
>;

/** What the form holds for one answer while the candidate is typing. */
export type StructuredFormValue =
  | boolean
  | string
  | string[]
  | { min: number | null; max: number | null }
  | null;

export type StructuredFormValues = Record<string, StructuredFormValue>;

/** The existing form fields that answer the FORM_FIELD_KEYS questions. */
export interface StructuredFormFields {
  linkedin_url: string;
  city: string;
  country: string;
}

const isFormField = (key: string) => (FORM_FIELD_KEYS as readonly string[]).includes(key);

/** The public question with the staff-only fields the helpers never read. */
export function toStructuredQuestion(q: PublicStructuredQuestion): StructuredQuestion {
  return {
    ...q,
    maps_to_requirement: null,
    pass_rule: null,
    short_label: null,
    staff_only: false,
  };
}

type HelperValues = Record<string, StructuredValue | null | undefined>;

/** The answers with the two form-field questions filled from the form. */
export function valuesWithFormFields(
  values: StructuredFormValues,
  fields: StructuredFormFields,
): HelperValues {
  const basedIn =
    fields.city.trim() && fields.country.trim()
      ? `${fields.city.trim()}, ${fields.country.trim()}`
      : null;
  return {
    ...(values as HelperValues),
    linkedin_url: fields.linkedin_url.trim() || null,
    based_in: basedIn,
  };
}

/** "7 of 11 answered", counting the form fields once they are filled. */
export function structuredProgress(
  questions: readonly PublicStructuredQuestion[],
  values: StructuredFormValues,
  fields: StructuredFormFields,
): { answered: number; total: number } {
  return progress(questions.map(toStructuredQuestion), valuesWithFormFields(values, fields));
}

/** The pilot questions the candidate answers here, in order, given the answers so far. */
export function shownQuestions(
  questions: readonly PublicStructuredQuestion[],
  values: StructuredFormValues,
): StructuredQuestion[] {
  return sortQuestions(questions.map(toStructuredQuestion)).filter(
    (q) => !isFormField(q.key) && isShown(q, values as HelperValues),
  );
}

/** One error per shown question that fails, keyed `sq:<key>` as the field is. */
export function structuredIssues(
  questions: readonly PublicStructuredQuestion[],
  values: StructuredFormValues,
): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const q of shownQuestions(questions, values)) {
    const r = normaliseAnswer(q, values[q.key]);
    if (!r.ok) errs[`sq:${q.key}`] = r.message;
  }
  return errs;
}

/** The value of every shown question, as `structured_answers` carries it. */
export function structuredAnswersPayload(
  questions: readonly PublicStructuredQuestion[],
  values: StructuredFormValues,
): Array<{ key: string; value: StructuredValue | null }> {
  return shownQuestions(questions, values).map((q) => {
    const r = normaliseAnswer(q, values[q.key]);
    return { key: q.key, value: r.ok ? r.value : null };
  });
}
