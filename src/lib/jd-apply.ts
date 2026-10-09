/**
 * How a job-description read lands in the intake form — and what it may never
 * touch.
 *
 * Two readers fill the same fields: the instant read (`quickReadJd`, in the
 * browser, every change) and the model read (the API, a second or two later).
 * The rules, in order:
 *
 *  1. A field the client typed in (`edited`) is never written. Ever.
 *  2. An EMPTY field may be filled.
 *  3. A field holding a value a reader put there (`auto`), unchanged since,
 *     may be replaced by a newer read — that is how the model's better reading
 *     replaces the instant one, and how a replaced description replaces the old
 *     one's values. A value equal to what is there is not rewritten (no
 *     flicker).
 *  4. Anything else — a restored draft, a carried answer — is left alone.
 *  5. `currency` and `compensationPeriod` ship with defaults nobody chose
 *     (USD, year); those defaults count as empty.
 *
 * Pure, so the rules are tested directly rather than through the page.
 */
import type { JdBlueprint } from "@/lib/jd-blueprint";
import { normalizeRequirementKey, type RequirementItem } from "@/lib/express-intake-schema";

/** The form fields a blueprint can fill, and the blank each one returns to. */
export const JD_FORM_DEFAULTS = {
  roleTitle: "",
  team: "",
  location: "",
  workModel: "",
  seniority: "",
  employmentType: "",
  salaryMin: "",
  salaryMax: "",
  currency: "USD",
  compensationPeriod: "year",
  targetStartDate: "",
  sponsorshipAvailable: "",
} as const;
export type JdFormKey = keyof typeof JD_FORM_DEFAULTS;
export type JdFormValues = Record<JdFormKey, string>;

/** Blueprint → the form's own field names and string values. */
export function blueprintToForm(bp: JdBlueprint): Partial<JdFormValues> {
  const out: Partial<JdFormValues> = {};
  if (bp.title) out.roleTitle = bp.title.value;
  if (bp.team) out.team = bp.team.value;
  if (bp.location) out.location = bp.location.value;
  if (bp.workModel) out.workModel = bp.workModel.value;
  if (bp.seniority) out.seniority = bp.seniority.value;
  if (bp.employmentType) out.employmentType = bp.employmentType.value;
  // The form needs both ends of a range or neither: a lone "up to $120k"
  // filled into one box would block Continue with "enter the bottom of the
  // range" for a number the description never gave.
  if (bp.salaryMin && bp.salaryMax) {
    out.salaryMin = String(bp.salaryMin.value);
    out.salaryMax = String(bp.salaryMax.value);
  }
  if (bp.currency) out.currency = bp.currency.value;
  if (bp.compensationPeriod) out.compensationPeriod = bp.compensationPeriod.value;
  if (bp.targetStartDate) out.targetStartDate = bp.targetStartDate.value;
  // A description that states the employer will not sponsor answers the visa
  // question, so the client is not asked it twice (INT-015).
  if (bp.requiresExistingWorkAuth?.value === true) out.sponsorshipAvailable = "no";
  return out;
}

export function isEmpty(key: JdFormKey, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s === "" || s === JD_FORM_DEFAULTS[key];
}

export type ApplyPlan = {
  patch: Partial<JdFormValues>;
  /** What readers have put in each field, after this read. */
  auto: Partial<JdFormValues>;
  /** Fields this read wrote (for the "read from your description" marker). */
  filled: JdFormKey[];
  /** Fields returned to blank because a newer read no longer states them. */
  cleared: JdFormKey[];
};

/**
 * Plans one read's changes. `clearMissing` is set when the read is the full
 * reading of a NEW description: auto-filled values it no longer states go back
 * to blank instead of lingering from the old text.
 */
export function planBlueprintApply(
  current: Partial<Record<JdFormKey, unknown>>,
  bp: JdBlueprint,
  opts: { edited: ReadonlySet<string>; auto: Partial<JdFormValues>; clearMissing?: boolean },
): ApplyPlan {
  const values = blueprintToForm(bp);
  const auto: Partial<JdFormValues> = { ...opts.auto };
  const patch: Partial<JdFormValues> = {};
  const filled: JdFormKey[] = [];
  const cleared: JdFormKey[] = [];
  for (const key of Object.keys(JD_FORM_DEFAULTS) as JdFormKey[]) {
    if (opts.edited.has(key)) {
      delete auto[key];
      continue;
    }
    const cur = current[key] === undefined || current[key] === null ? "" : String(current[key]);
    const ownedByReader = auto[key] !== undefined && auto[key] === cur;
    const next = values[key];
    if (next !== undefined) {
      if (cur === next) {
        if (ownedByReader || isEmpty(key, cur)) auto[key] = next;
        continue;
      }
      if (isEmpty(key, cur) || ownedByReader) {
        patch[key] = next;
        auto[key] = next;
        filled.push(key);
      }
      continue;
    }
    if (opts.clearMissing && ownedByReader && !isEmpty(key, cur)) {
      patch[key] = JD_FORM_DEFAULTS[key];
      delete auto[key];
      cleared.push(key);
    }
  }
  return { patch, auto, filled, cleared };
}

/** A list as the form should hold it: never more must-haves than the product advises. */
/**
 * De-duplicates a read's requirements. Every item keeps the tag the text
 * stated: a seventh must-have used to be re-tagged "nice to have" here while
 * the form still said "Read from your job description", which misrepresented
 * the description. The form itself asks the client to confirm more than
 * MAX_MUST_HAVES must-haves (express-intake-schema), so the cap is theirs to
 * accept or relax, never a silent re-tag.
 */
export function capMustHaves(items: RequirementItem[]): RequirementItem[] {
  const seen = new Set<string>();
  const out: RequirementItem[] = [];
  for (const it of items) {
    const key = normalizeRequirementKey(it.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ text: it.text, tag: it.tag });
  }
  return out;
}

export function requirementsSignature(items: RequirementItem[]): string {
  return JSON.stringify(items.map((i) => [normalizeRequirementKey(i.text), i.tag]));
}

/**
 * Whether a read's requirements may become the client's list: only while the
 * list is untouched — empty, or exactly what the last read put there.
 */
export function mayReplaceRequirements(
  current: RequirementItem[],
  opts: { edited: boolean; autoSignature: string },
): boolean {
  if (opts.edited) return false;
  const live = current.filter((i) => i.text.trim().length > 0);
  if (live.length === 0) return true;
  return opts.autoSignature !== "" && requirementsSignature(current) === opts.autoSignature;
}
