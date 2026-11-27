/**
 * The structured screening pilot's one-page apply form: both sections, a live
 * "x of y answered" line, follow-ups that appear only when their condition
 * holds, and no step indicator.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StructuredScreeningFields } from "@/components/apply/structured-screening-fields";
import {
  structuredAnswersPayload,
  structuredIssues,
  structuredProgress,
  type PublicStructuredQuestion,
  type StructuredFormFields,
  type StructuredFormValues,
} from "@/components/apply/structured-screening-state";

const q = (
  over: Partial<PublicStructuredQuestion> &
    Pick<PublicStructuredQuestion, "key" | "label" | "type">,
): PublicStructuredQuestion => ({
  options: null,
  required: true,
  section: "this_role",
  sort_order: 0,
  help: null,
  unit: null,
  show_when: null,
  ...over,
});

const UK: PublicStructuredQuestion[] = [
  q({
    key: "linkedin_url",
    label: "LinkedIn profile",
    type: "url",
    section: "about_you",
    sort_order: 1,
  }),
  q({
    key: "based_in",
    label: "Where are you based?",
    type: "short_text",
    section: "about_you",
    sort_order: 2,
  }),
  q({
    key: "work_auth",
    label: "Do you have the right to work in the UK?",
    type: "yes_no",
    section: "about_you",
    sort_order: 3,
  }),
  q({
    key: "start",
    label: "When could you start?",
    type: "single_select",
    options: ["Immediately", "1 month", "2 months", "3 months or more"],
    section: "about_you",
    sort_order: 4,
  }),
  q({
    key: "pay",
    label: "What base salary are you looking for?",
    type: "number_range",
    unit: "GBP per year",
    required: false,
    section: "about_you",
    sort_order: 5,
  }),
  q({
    key: "largest_deal",
    label: "What is the largest deal you have closed?",
    type: "single_select",
    options: ["Under £250k", "£250k–£1M", "£1M–£5M", "Over £5M"],
    sort_order: 1,
  }),
  q({
    key: "largest_deal_what",
    label: "In one line, what was it?",
    type: "short_text",
    help: "For example: data migration for a UK bank",
    required: false,
    sort_order: 2,
    show_when: { key: "closed_enterprise", equals: true },
  }),
  q({
    key: "closed_enterprise",
    label: "Have you closed an enterprise deal?",
    type: "yes_no",
    sort_order: 0,
  }),
  q({
    key: "crm",
    label: "Which CRMs have you used daily?",
    type: "multi_select",
    options: ["Salesforce", "HubSpot", "Dynamics", "None of these"],
    sort_order: 3,
  }),
];

const NL: PublicStructuredQuestion[] = [
  q({
    key: "linkedin_url",
    label: "LinkedIn-profiel",
    type: "url",
    section: "about_you",
    sort_order: 1,
  }),
  q({
    key: "based_in",
    label: "Where do you live?",
    type: "short_text",
    section: "about_you",
    sort_order: 2,
  }),
  q({
    key: "work_auth",
    label: "Do you have the right to work in the Netherlands?",
    type: "yes_no",
    section: "about_you",
    sort_order: 3,
  }),
  q({
    key: "dutch",
    label: "How well do you speak Dutch?",
    type: "single_select",
    options: [
      "Native",
      "Professional",
      "Conversational",
      "Basic",
      "None",
      "Learning now",
      "Prefer not to say",
    ],
    sort_order: 1,
  }),
  q({ key: "kvk", label: "Are you registered with the KvK?", type: "yes_no", sort_order: 2 }),
  q({
    key: "kvk_number",
    label: "Your KvK number",
    type: "short_text",
    required: false,
    sort_order: 3,
    show_when: { key: "kvk", equals: true },
  }),
];

const EMPTY_FIELDS: StructuredFormFields = { linkedin_url: "", city: "", country: "" };

const render = (
  questions: PublicStructuredQuestion[],
  values: StructuredFormValues,
  fields: StructuredFormFields = EMPTY_FIELDS,
  errors: Record<string, string> = {},
) =>
  renderToStaticMarkup(
    <StructuredScreeningFields
      questions={questions}
      values={values}
      onChange={() => {}}
      errors={errors}
      formFields={fields}
      aboutYou={<div data-testid="details-slot">details</div>}
    />,
  );

describe("structured screening fields (UK-style set)", () => {
  it("shows both section headings, the details slot first, and no step indicator", () => {
    const html = render(UK, {});
    expect(html).toContain("About you");
    expect(html).toContain("About this role");
    expect(html.indexOf("About you")).toBeLessThan(html.indexOf('data-testid="details-slot"'));
    expect(html.indexOf('data-testid="details-slot"')).toBeLessThan(
      html.indexOf("About this role"),
    );
    expect(html).not.toMatch(/Step \d+ of \d+/);
    expect(html).not.toMatch(/Continue|Back/);
  });

  it("never renders its own inputs for the questions the form fields answer", () => {
    const html = render(UK, {});
    expect(html).not.toContain('data-field="sq:linkedin_url"');
    expect(html).not.toContain('data-field="sq:based_in"');
    expect(html).toContain('data-field="sq:work_auth"');
  });

  it("counts answers, including the form fields once filled, and leaves follow-ups out of the total", () => {
    // 9 questions, one of them a follow-up: 8 counted.
    expect(render(UK, {})).toContain("0 of 8 answered");
    const values: StructuredFormValues = {
      work_auth: true,
      crm: ["Salesforce"],
      pay: { min: null, max: null },
    };
    expect(structuredProgress(UK, values, EMPTY_FIELDS)).toEqual({ answered: 2, total: 8 });
    const fields = { linkedin_url: "https://linkedin.com/in/x", city: "Leeds", country: "UK" };
    expect(render(UK, values, fields)).toContain("4 of 8 answered");
    // City without a country is not yet a place.
    expect(structuredProgress(UK, values, { ...fields, country: "" }).answered).toBe(3);
  });

  it("shows the follow-up only when its condition holds", () => {
    expect(render(UK, {})).not.toContain("In one line, what was it?");
    expect(render(UK, { closed_enterprise: false })).not.toContain("In one line, what was it?");
    const shown = render(UK, { closed_enterprise: true });
    expect(shown).toContain("In one line, what was it?");
    expect(shown).toContain("For example: data migration for a UK bank");
    expect(shown).toContain('maxLength="150"');
  });

  it("uses tap buttons for short lists and a range with its unit", () => {
    const html = render(UK, { work_auth: true });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Yes</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>No</);
    expect(html).not.toContain("<select");
    expect(html).toContain("GBP per year");
    expect(html).toContain(">From<");
    expect(html).toContain(">To<");
  });

  it("validates shown questions only and sends their values", () => {
    const values: StructuredFormValues = {
      closed_enterprise: false,
      largest_deal_what: "hidden, never sent",
      work_auth: true,
      start: "1 month",
      largest_deal: "£1M–£5M",
      crm: ["None of these"],
      pay: { min: 70000, max: null },
    };
    expect(structuredIssues(UK, values)).toEqual({});
    expect(structuredAnswersPayload(UK, values)).toEqual([
      { key: "work_auth", value: true },
      { key: "start", value: "1 month" },
      { key: "pay", value: { min: 70000, max: 70000 } },
      { key: "closed_enterprise", value: false },
      { key: "largest_deal", value: "£1M–£5M" },
      { key: "crm", value: ["None of these"] },
    ]);
    const errs = structuredIssues(UK, { closed_enterprise: true });
    expect(Object.keys(errs)).toContain("sq:work_auth");
    expect(Object.keys(errs)).not.toContain("sq:largest_deal_what");
    expect(Object.keys(errs)).not.toContain("sq:linkedin_url");
  });

  it("shows an error beside its field", () => {
    const html = render(UK, {}, EMPTY_FIELDS, { "sq:work_auth": "Please answer" });
    expect(html).toContain('id="sq-work_auth-error"');
    expect(html).toContain("Please answer");
  });
});

describe("structured screening fields (Netherlands-style set)", () => {
  it("shows both section headings and no step indicator", () => {
    const html = render(NL, {});
    expect(html).toContain("About you");
    expect(html).toContain("About this role");
    expect(html).not.toMatch(/Step \d+ of \d+/);
  });

  it("counts correctly and uses a dropdown for a long list", () => {
    const html = render(NL, { dutch: "Professional" });
    // 6 questions, one follow-up: 5 counted; one answered.
    expect(html).toContain("1 of 5 answered");
    expect(html).toContain("<select");
    expect(html).toContain("Choose one");
  });

  it("shows the KvK number only after a yes", () => {
    expect(render(NL, {})).not.toContain("Your KvK number");
    expect(render(NL, { kvk: false })).not.toContain("Your KvK number");
    expect(render(NL, { kvk: true })).toContain("Your KvK number");
  });
});
