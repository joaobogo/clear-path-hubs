// Wizard-style position editor UI, shared by admin and client edit routes.
// Three steps: Requisition → Candidate profile & gates → Locations.
// Job-post personalisation lives on the publish flow, not here.
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SCREENING_MAX_QUESTIONS,
  screeningTopicIssue,
  SCREENING_MAX_REQUIRED,
  countRequired,
} from "@/lib/screening-limits";
import { toast } from "sonner";
import { useClearResolvedErrors } from "@/lib/use-live-errors";
import { toastError } from "@/lib/toast-error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  savePositionEdit,
  type PositionEditInitial,
  type ScreeningInput,
} from "@/lib/position-edit.functions";
import { checkRequisitionDuplicate } from "@/lib/requisition.functions";
import { setPositionLifecycle } from "@/lib/position-lifecycle.functions";

import { RequisitionEditor } from "@/components/positions/RequisitionEditor";
import { RoleEditorLifecycleActions } from "@/components/positions/RoleEditorLifecycleActions";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDateTime } from "@/lib/format/datetime";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import type { QualityInput } from "@/lib/requisition-schema";
import {
  editableFieldNames,
  fieldHint,
  fieldLabel,
  fieldOptions,
} from "@/lib/positions/field-registry";
import { RichTextInput } from "@/components/ui/rich-text-input";
import { ROLE_FIELD_STEP, roleRequiredness } from "@/lib/positions/role-form";
import {
  COMPENSATION_HONEST_LINE,
  COMP_EQUITY,
  COMP_EQUITY_LABELS,
  COMP_PERIOD_LABELS,
  COMP_PERIODS,
  DEFAULT_INTERVIEW_STAGE_TEMPLATE,
  INTERVIEW_PROCESS_WHY_IT_MATTERS,
  INTERVIEW_STAGE_FORMATS,
  INTERVIEW_STAGE_FORMAT_LABELS,
  MAX_INTERVIEW_STAGES,
  REQUIREMENT_TAG_EFFECTS,
  REQUIREMENT_TAG_LABELS,
  SPONSORSHIP_OPTIONS,
  SPONSORSHIP_WHY_IT_MATTERS,
  TIMEZONE_BANDS,
  WORK_MODELS,
  WORK_MODEL_LABELS,
  type InterviewStageFormat,
} from "@/lib/express-intake-schema";
import { DEAL_BREAKER_WHY_IT_MATTERS } from "@/lib/client-deal-breakers";
import { stripInlineMarkup } from "@/lib/marketing/inline-format";

/**
 * The intake's own sections, in its own order and words: the edit screen is
 * the saved intake, reopened. Step 4 ends with the optional structured
 * locations and scoring priorities.
 */
const STEPS = [
  { id: 1, label: "The role" },
  { id: 2, label: "Who you need" },
  { id: 3, label: "Practicalities" },
  { id: 4, label: "Process and confirm" },
];
const LAST_STEP = STEPS.length;

const DISQUALIFIER_OPTIONS = [
  "Compensation above budget",
  "No degree or certification",
  "No distributed/remote experience",
  "No relevant industry experience",
  "No work authorisation",
  "Overqualified for the level",
  "Weak communication skills",
  "Currently at a competitor",
] as const;

const COMPANY_TYPE_OPTIONS = [
  "Startups (Seed - Series B)",
  "Growth-stage (Series C+)",
  "Public / Enterprise",
  "Big Tech (FAANG)",
  "Consulting firms",
  "Agencies",
  "Non-profit",
  "Government",
] as const;

type State = Omit<PositionEditInitial, "organization_id" | "organization_name" | "status">;

function unique(arr: string[]) {
  const map = new Map<string, string>();
  for (const s of arr) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!map.has(k)) map.set(k, t);
  }
  return Array.from(map.values());
}

function initialState(initial: PositionEditInitial): State {
  const { organization_id: _o, organization_name: _n, status: _s, ...rest } = initial;
  return { ...rest };
}

/**
 * The blocking errors for one step. The rules are roleRequiredness() — the
 * same function the save handler runs — so the screen and the server can
 * never disagree. Time zone, city, work model, seniority, employment type and
 * headcount are never required to save.
 */
function validateStep(step: number, s: State): Record<string, string> {
  const { errors } = roleRequiredness({ ...s, description: stripInlineMarkup(s.description) });
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(errors)) {
    if ((ROLE_FIELD_STEP[field] ?? 1) === step) out[field] = message;
  }
  return out;
}

function allErrors(s: State): Record<string, string> {
  return roleRequiredness({ ...s, description: stripInlineMarkup(s.description) }).errors;
}

export function PositionEditWizard({
  initial,
  returnTo,
  invalidateKeys,
  audience,
  initialStep,
  mode = "edit",
}: {
  initial: PositionEditInitial;
  returnTo: string;
  invalidateKeys: readonly (readonly unknown[])[];
  audience: "admin" | "client";
  initialStep?: number;
  /** "create" when the client has just started this role, so the screen is titled "New role". */
  mode?: "create" | "edit";
}) {

  const navigate = useNavigate();
  const qc = useQueryClient();
  // Which fields this role may edit is a schema fact, not a form decision.
  const editable = useMemo(() => new Set(editableFieldNames(audience)), [audience]);
  const shows = (name: string) => editable.has(name);
  const save = useServerFn(savePositionEdit);

  const [step, setStep] = useState(() =>
    initialStep && initialStep >= 1 && initialStep <= LAST_STEP ? initialStep : 1,
  );
  const [state, setState] = useState<State>(() => initialState(initial));

  // Publish the role title so the workspace breadcrumb resolves from the record
  // instead of falling back to an entity-type literal while loading.
  useDetailCrumb(initial.title ?? null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  // Bumped on every submit attempt so focus only jumps then, never while typing.
  const [focusToken, setFocusToken] = useState(0);
  const [qDraft, setQDraft] = useState("");
  const [qTopicError, setQTopicError] = useState<string | null>(null);
  const [reqDirty, setReqDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const draftKey = `taasflow.position-draft.${initial.id}`;
  const baseline = useMemo(() => JSON.stringify(initialState(initial)), [initial]);
  const contentDirty = JSON.stringify(state) !== baseline;
  const dirty = contentDirty || reqDirty;

  // --- Draft saving: local, per position, restored on return ---------------
  const [draftFound, setDraftFound] = useState<State | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number; state: State };
      if (parsed?.state && JSON.stringify(parsed.state) !== baseline) {
        setDraftFound(parsed.state);
        setSavedAt(parsed.savedAt);
      }
    } catch {
      /* ignore malformed drafts */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !contentDirty) return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), state }));
      setSavedAt(Date.now());
    }, 800);
    return () => window.clearTimeout(t);
  }, [state, contentDirty, draftKey]);

  // --- Warn before leaving unsaved work ------------------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // --- Duplicate requisition detection (debounced) -------------------------
  const checkDup = useServerFn(checkRequisitionDuplicate);
  const [dupWarning, setDupWarning] = useState<
    { id: string; title: string; department: string; status: string; reference_code: string }[]
  >([]);
  useEffect(() => {
    if (!state.title.trim()) {
      setDupWarning([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await checkDup({
          data: {
            organization_id: initial.organization_id,
            title: state.title,
            department: state.department ?? "",
            reference_code: "",
            exclude_id: initial.id,
          },
        });
        setDupWarning(res.duplicate ? res.matches : []);
      } catch {
        setDupWarning([]);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [state.title, state.department, initial.organization_id, initial.id, checkDup]);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("You have unsaved changes to this job. Leave without saving?"),
    enableBeforeUnload: dirty,
  });

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const toggleIn = (key: keyof State, opt: string) => {
    const arr = state[key] as string[];
    const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
    set(key, next as State[typeof key]);
  };

  const next = () => {
    const e = validateStep(step, state);
    setErrors(e);
    setFocusToken((n) => n + 1);
    if (Object.keys(e).length === 0) setStep((n) => Math.min(LAST_STEP, n + 1));
  };
  const back = () => setStep((n) => Math.max(1, n - 1));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const all = allErrors(state);
      if (Object.keys(all).length > 0) {
        setErrors(all);
        setFocusToken((n) => n + 1);
        const first = Object.keys(all)[0];
        setStep(ROLE_FIELD_STEP[first] ?? 1);
        throw new Error(Object.values(all)[0] ?? "Please fix the highlighted fields");
      }
      return save({
        data: {
          id: state.id,
          title: state.title.trim(),
          department: state.department.trim(),
          location: state.location.trim(),
          // Tells the server the client answered the location here, so it is
          // written as typed rather than kept from the structured rows.
          location_changed: state.location.trim() !== (initial.location ?? "").trim(),
          work_model: state.work_model,
          employment_type: state.employment_type,
          seniority: state.seniority.trim(),
          headcount: typeof state.headcount === "number" ? state.headcount : null,
          description: state.description.trim(),
          open_worldwide: state.open_worldwide,
          target_countries: unique(state.target_countries),
          states_regions: unique(state.states_regions),
          metro_areas: unique(state.metro_areas),
          search_radius: state.search_radius.trim(),
          hiring_urgency: state.hiring_urgency.trim(),
          target_start_date: state.target_start_date.trim(),
          time_to_hire: state.time_to_hire.trim(),
          must_have_skills: unique(state.must_have_skills),
          nice_to_have_skills: unique(state.nice_to_have_skills),
          certifications_list: unique(state.certifications_list),
          tools_platforms: unique(state.tools_platforms),
          experience: state.experience.trim(),
          education: state.education.trim(),
          timezone_requirements: state.timezone_requirements.trim(),
          responsibilities: state.responsibilities,
          additional_requirements: state.additional_requirements,
          currency: state.currency.trim() || "USD",
          budget_period: (state.budget_period || "year") as "year" | "month" | "hour",
          budget_min: state.budget_min.trim(),
          budget_max: state.budget_max.trim(),
          compensation: state.compensation.trim(),
          target_titles: unique(state.target_titles),
          title_match_timing: state.title_match_timing,
          target_company_types: unique(state.target_company_types),
          include_keywords: unique(state.include_keywords),
          exclude_keywords: unique(state.exclude_keywords),
          disqualifier_tags: unique(state.disqualifier_tags),
          interview_process: state.interview_process,
          additional_context: state.additional_context,
          company_intro: state.company_intro,
          benefits: state.benefits,
          languages: state.languages,
          travel: state.travel,
          work_authorization_note: state.work_authorization_note,
          accessibility_note: state.accessibility_note,
          eeo_statement: state.eeo_statement,
          brand_tone: state.brand_tone,
          application_deadline: state.application_deadline,
          confidentiality: (state.confidentiality || "public") as "public" | "confidential",
          screening_questions: state.screening_questions.filter(
            (q) => q.question.trim().length >= 3,
          ),
          // The intake's own answers, saved back where the intake keeps them.
          remote_timezones: state.work_model === "remote" && !state.remote_anywhere_in_country ? state.remote_timezones : [],
          remote_anywhere_in_country: state.work_model === "remote" && state.remote_anywhere_in_country,
          onsite_days: state.work_model === "hybrid" ? state.onsite_days : "",
          sponsorship_available: state.sponsorship_available,
          work_authorization_rule: state.work_authorization_rule,
          work_authorization_rule_note: state.work_authorization_rule_note,
          compensation_undecided: state.compensation_undecided,
          compensation_flexible: state.compensation_flexible,
          bonus_structure: state.bonus_structure,
          equity: state.equity,
          trainable_skills: unique(state.trainable_skills),
          interview_stages: state.interview_stages.filter((st) => st.name.trim().length > 0),
          decision_maker: state.decision_maker.trim(),
          decision_maker_email: state.decision_maker_email.trim(),
        } as never,
      });
    },
    onSuccess: async (res: { analysis?: string } | undefined) => {
      toast.success(
        res?.analysis === "queued" ? "Role saved. Analysing your changes now." : "Role saved",
      );
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      setSavedAt(null);
      setState((cur) => ({ ...cur }));
      await Promise.all(invalidateKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      navigate({ to: returnTo });
    },
    onError: (e) => toastError(e, { fallback: "Save failed" }),
  });

  // Step 3 used to show two adjacent primary saves with overlapping scope
  // ("Save locations and priorities" in the card footer, "Save role brief" in
  // the page footer). The brief save writes the position row without touching
  // the structured locations, so a user who added a location and then clicked
  // the page-footer button lost it, and clicking both in quick succession raced
  // two mutations against the same row. RequisitionEditor now hands its save up
  // here, so step 3 has one control that runs both, in order, never concurrently.
  const reqSaveRef = useRef<(() => Promise<unknown>) | null>(null);
  const stepSaveMutation = useMutation({
    mutationFn: async () => {
      // Locations first: saveRequisitionMeta mirrors the primary location onto
      // the position row, so the brief save must not run before it.
      if (reqDirty && reqSaveRef.current) await reqSaveRef.current();
      if (contentDirty) await saveMutation.mutateAsync();
    },
    // Both inner mutations already surface their own failure toast; an onError
    // here would show the same error twice.
  });

  // "Brief incomplete" — the intake's own list, shown as a hint and never as
  // a reason a save fails.
  const briefHints = useMemo(
    () => roleRequiredness({ ...state, description: stripInlineMarkup(state.description) }).missing,
    [state],
  );

  const progress = useMemo(() => Math.round(((step - 1) / (STEPS.length - 1)) * 100), [step]);

  // Focus the first offending field, but only right after a submit attempt —
  // not every time a message clears while the user is still typing.
  useEffect(() => {
    if (focusToken === 0) return;
    const key = Object.keys(errors)[0];
    if (!key) return;
    const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  // Live re-validation: as soon as a field is corrected its message disappears,
  // without waiting for another Continue / Save.
  useClearResolvedErrors(
    errors,
    setErrors,
    () => allErrors(state),
    [JSON.stringify(state)],
  );

  const qualityDraft: Partial<QualityInput> = useMemo(
    () => ({
      title: state.title,
      description: state.description,
      seniority: state.seniority,
      employment_type: state.employment_type,
      department: state.department ?? "",
      must_have_skills: state.must_have_skills,
      nice_to_have_skills: state.nice_to_have_skills,
      disqualifier_tags: state.disqualifier_tags,
      responsibilities: state.responsibilities,
      experience: state.experience,
      interview_process: state.interview_process,
      screening_questions: state.screening_questions,
      target_start_date: state.target_start_date,
      headcount: typeof state.headcount === "number" ? state.headcount : null,
      work_model: state.work_model,
      location_text: state.location,
      remote_timezones: state.remote_timezones,
      remote_anywhere_in_country: state.remote_anywhere_in_country,
      open_worldwide: state.open_worldwide,
    }),
    [state],
  );
  // Reported by the checklist so "Submit for review" is gated on exactly the
  // items it marks "Required to submit" — never on ranking suggestions.
  const [blockingGaps, setBlockingGaps] = useState<{ label: string; step?: number }[]>([]);
  const creating = mode === "create";
  const canSubmit =
    audience === "client" && ["draft", "needs_clarification"].includes(String(initial.status));

  const lifecycleFn = useServerFn(setPositionLifecycle);
  const submitMutation = useMutation({
    mutationFn: async () => {
      // reqDirty used to trigger a brief save, which does not write locations at
      // all — unsaved location edits were silently dropped on submit.
      if (reqDirty && reqSaveRef.current) await reqSaveRef.current();
      if (contentDirty) await saveMutation.mutateAsync();
      return lifecycleFn({ data: { positionId: state.id, action: "submit" } });
    },
    onSuccess: async () => {
      toast.success("Role submitted for review. We'll come back with questions or a shortlist.");
      await Promise.all(invalidateKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      navigate({ to: returnTo });
    },
    onError: (e) => toastError(e, { fallback: "We couldn't submit this role. Nothing was lost." }),
  });



  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {audience === "admin"
              ? "Admin · Edit role"
              : creating
                ? "New role"
                : "Edit role"}
          </p>
          <h1 className="truncate text-xl font-semibold sm:text-2xl">
            {creating && !initial.title ? "New role" : initial.title || "Untitled role"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {initial.organization_name} · Status: {initial.status}
          </p>

        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: returnTo })}>
            Cancel
          </Button>
          {audience === "client" && (
            <RoleEditorLifecycleActions
              orgId={initial.organization_id}
              positionId={initial.id}
              title={state.title || initial.title}
              status={String(initial.status)}
            />
          )}
        </div>
      </header>

      {draftFound && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3">
          <p className="text-sm">
            An unsaved draft of this job was found
            {savedAt ? ` from ${formatDateTime(savedAt)}` : ""}.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setState(draftFound);
                setDraftFound(null);
              }}
            >
              Restore draft
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                window.localStorage.removeItem(draftKey);
                setDraftFound(null);
                setSavedAt(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div aria-label="Progress">
            <Progress value={progress} />
            <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {STEPS.map((s) => (
                <li key={s.id} aria-current={s.id === step ? "step" : undefined}>
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={
                      s.id === step
                        ? "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4"
                        : "hover:text-foreground hover:underline"
                    }
                  >
                    {s.id}. {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Step {step}: {STEPS[step - 1].label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* STEP 1 — Requisition (role definition + compensation fieldset) */}
              {step === 1 && (
                <div className="space-y-6">
                  {dupWarning.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                      <p className="font-medium">Possible duplicate role</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {dupWarning.map((m) => (
                          <li key={m.id}>
                            {m.title}
                            {m.department ? ` · ${m.department}` : ""} · {m.status}
                            {m.reference_code ? ` · ${m.reference_code}` : ""}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Check this isn't the same role before saving — duplicates split candidates
                        across two pipelines.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={fieldLabel("title")} error={errors.title} required className="sm:col-span-2">
                      <Input
                        data-field="title"
                        value={state.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder="e.g. Senior Backend Engineer"
                      />
                    </Field>
                    <Field label={fieldLabel("department")}>
                      <Input
                        value={state.department}
                        onChange={(e) => set("department", e.target.value)}
                      />
                    </Field>
                    {/* Location and work model are asked once, on Practicalities,
                        exactly as the intake asks them. */}

                    <Field label={fieldLabel("employment_type")} error={errors.employment_type}>
                      <Select
                        value={state.employment_type}
                        onValueChange={(v) => set("employment_type", v as State["employment_type"])}
                      >
                        <SelectTrigger data-field="employment_type">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions("employment_type").map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={fieldLabel("seniority")} error={errors.seniority}>
                      <Select value={state.seniority} onValueChange={(v) => set("seniority", v)}>
                        <SelectTrigger data-field="seniority">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions("seniority").map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={fieldLabel("headcount")} error={errors.headcount}>
                      <Input
                        data-field="headcount"
                        type="number"
                        min={1}
                        max={999}
                        value={state.headcount}
                        onChange={(e) =>
                          set("headcount", e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>

                  <Field
                    label={fieldLabel("description")}
                    hint={fieldHint("description")}
                  >
                    <RichTextInput
                      rows={6}
                      ariaLabel="Job description"
                      value={state.description}
                      onChange={(v) => set("description", v)}
                      placeholder="Paste the full job description or describe the role, responsibilities, and success criteria."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stripInlineMarkup(state.description).trim().length} characters
                    </p>
                  </Field>


                </div>
              )}

              {/* STEP 2 — Candidate profile and gates */}
              {step === 2 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    One list per tag, as on the intake. Each additional must-have narrows the search.
                  </p>
                  <ChipInput
                    label={REQUIREMENT_TAG_LABELS.must_have}
                    hint={`${REQUIREMENT_TAG_EFFECTS.must_have} At least one, or a job description on step 1.`}
                    error={errors.must_have_skills}
                    values={state.must_have_skills}
                    onChange={(v) => set("must_have_skills", v)}
                    placeholder="Type a requirement and press Enter"
                    dataField="must_have_skills"
                    required
                  />
                  <ChipInput
                    label={REQUIREMENT_TAG_LABELS.nice_to_have}
                    hint={REQUIREMENT_TAG_EFFECTS.nice_to_have}
                    values={state.nice_to_have_skills}
                    onChange={(v) => set("nice_to_have_skills", v)}
                    placeholder="e.g. GraphQL, Terraform"
                    dataField="nice_to_have_skills"
                  />
                  <ChipInput
                    label={REQUIREMENT_TAG_LABELS.trainable}
                    hint={REQUIREMENT_TAG_EFFECTS.trainable}
                    values={state.trainable_skills}
                    onChange={(v) => set("trainable_skills", v)}
                    placeholder="e.g. Our internal tooling"
                    dataField="trainable_skills"
                  />
                  <AdvancedSection label="More about the ideal candidate">
                  <ChipInput
                    label={fieldLabel("certifications_list")}
                    values={state.certifications_list}
                    onChange={(v) => set("certifications_list", v)}
                    placeholder="e.g. AWS SA, PMP, CFA"
                  />
                  <ChipInput
                    label={fieldLabel("tools_platforms")}
                    values={state.tools_platforms}
                    onChange={(v) => set("tools_platforms", v)}
                    placeholder="e.g. Salesforce, Snowflake, Figma"
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={fieldLabel("experience")} hint={fieldHint("experience")}>
                      <Input
                        value={state.experience}
                        onChange={(e) => set("experience", e.target.value)}
                        placeholder="e.g. 5+ years"
                      />
                    </Field>
                    <Field label={fieldLabel("education")}>
                      <Input
                        value={state.education}
                        onChange={(e) => set("education", e.target.value)}
                        placeholder="e.g. BSc CS or equivalent"
                      />
                    </Field>
                    <Field label={fieldLabel("timezone_requirements")} className="sm:col-span-2">
                      <Input
                        value={state.timezone_requirements}
                        onChange={(e) => set("timezone_requirements", e.target.value)}
                        placeholder="e.g. Must overlap CET 10:00–14:00"
                      />
                    </Field>
                  </div>
                  </AdvancedSection>
                  <Field label={fieldLabel("responsibilities")} hint={fieldHint("responsibilities")}>
                    <Textarea
                      rows={4}
                      value={state.responsibilities}
                      onChange={(e) => set("responsibilities", e.target.value)}
                      placeholder="Own X. Lead Y. Deliver Z."
                    />
                  </Field>
                  <AdvancedSection label="Sourcing rules">
                  <Field
                    label={fieldLabel("additional_requirements")}
                    hint="Anything else the candidate must have."
                  >
                    <Textarea
                      rows={3}
                      value={state.additional_requirements}
                      onChange={(e) => set("additional_requirements", e.target.value)}
                    />
                  </Field>

{shows("target_titles") && (
                  <>
                  <SectionHeader
                    title="Search criteria"
                    subtitle="Titles, keywords, and the rules that keep bad fits out."
                  />
                  <ChipInput
                    label={fieldLabel("target_titles")}
                    hint="Optional. Titles to source from (current or previous roles)."
                    values={state.target_titles}
                    onChange={(v) => set("target_titles", v)}
                    placeholder="e.g. Senior Software Engineer, Staff Engineer"
                    dataField="target_titles"
                  />
                  <Field
                    label={fieldLabel("title_match_timing")}
                    hint="Should the target title be their current, previous, or either role?"
                  >
                    <Select
                      value={state.title_match_timing}
                      onValueChange={(v) =>
                        set("title_match_timing", v as State["title_match_timing"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions("title_match_timing").map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div>
                    <Label className="mb-2 block text-sm">{fieldLabel("target_company_types")}</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {COMPANY_TYPE_OPTIONS.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={state.target_company_types.includes(opt)}
                            onCheckedChange={() => toggleIn("target_company_types", opt)}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <ChipInput
                    label={fieldLabel("include_keywords")}
                    hint="Boost candidates whose profiles contain these terms."
                    values={state.include_keywords}
                    onChange={(v) => set("include_keywords", v)}
                    placeholder="e.g. Kubernetes, distributed systems"
                  />
                  <ChipInput
                    label={fieldLabel("exclude_keywords")}
                    hint="Filter out candidates whose profiles contain these terms."
                    values={state.exclude_keywords}
                    onChange={(v) => set("exclude_keywords", v)}
                    placeholder="e.g. bootcamp only, agency"
                  />
                  </>
                  )}

                  </AdvancedSection>

                  <AdvancedSection label="Screening questions">
                  <SectionHeader
                    title="Screening Questions"
                    subtitle={`Ask only what changes the outcome: up to ${SCREENING_MAX_QUESTIONS} questions, max ${SCREENING_MAX_REQUIRED} mandatory. Each one must map to a must-have and carry a one-line reason the candidate reads.`}
                  />
                  {(() => {
                    const qs = state.screening_questions;
                    const requiredCount = countRequired(qs);
                    const atMax = qs.length >= SCREENING_MAX_QUESTIONS;
                    const setQ = (i: number, patch: Partial<ScreeningInput>) =>
                      set(
                        "screening_questions",
                        qs.map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
                      );
                    const addQuestion = () => {
                      const v = qDraft.trim();
                      if (v.length < 3 || atMax) return;
                      const topic = screeningTopicIssue(v);
                      if (topic) {
                        setQTopicError(topic);
                        return;
                      }
                      setQTopicError(null);
                      set("screening_questions", [
                        ...qs,
                        {
                          question: v,
                          answer_type: "text",
                          required: false,
                          dealbreaker: false,
                          must_have: "",
                          why_asked: "",
                        } satisfies ScreeningInput,
                      ]);
                      setQDraft("");
                    };
                    const unmapped = qs.filter(
                      (q) => !q.must_have.trim() || !q.why_asked.trim(),
                    ).length;
                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {qs.length}/{SCREENING_MAX_QUESTIONS} questions
                          </span>
                          <span aria-hidden>·</span>
                          <span>
                            {requiredCount}/{SCREENING_MAX_REQUIRED} mandatory
                          </span>
                        </div>
                        {unmapped > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-500">
                            {unmapped} question{unmapped === 1 ? "" : "s"} still need a must-have
                            and a reason. The role cannot be published until they do.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Input
                            value={qDraft}
                            onChange={(e) => {
                              setQDraft(e.target.value);
                              if (qTopicError) setQTopicError(null);
                            }}
                            disabled={atMax}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addQuestion();
                              }
                            }}
                            placeholder={
                              atMax
                                ? `Limit reached (${SCREENING_MAX_QUESTIONS} questions)`
                                : "Add a question and press Enter"
                            }
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={atMax}
                            onClick={addQuestion}
                          >
                            Add
                          </Button>
                        </div>
                        {qTopicError && (
                          <p className="text-xs text-destructive">{qTopicError}</p>
                        )}
                        {qs.length > 0 && (
                          <ul className="mt-1 space-y-2">
                            {qs.map((q, i) => {
                              const lockRequired = !q.required && requiredCount >= SCREENING_MAX_REQUIRED;
                              return (
                                <li
                                  key={q.id ?? `new-${i}`}
                                  className="space-y-2 rounded-md border p-3 text-sm"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <span className="flex-1 min-w-[12rem]">{q.question}</span>
                                    <label className="flex items-center gap-2 text-xs">
                                      <Checkbox
                                        checked={!!q.required}
                                        disabled={lockRequired}
                                        onCheckedChange={(v) => setQ(i, { required: !!v })}
                                      />
                                      <span>{q.required ? "Mandatory" : "Optional"}</span>
                                    </label>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground underline"
                                      aria-label={`Remove ${q.question}`}
                                      onClick={() =>
                                        set(
                                          "screening_questions",
                                          qs.filter((_, idx) => idx !== i),
                                        )
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    <label className="text-xs">
                                      <span className="text-muted-foreground">
                                        Must-have it tests
                                      </span>
                                      <Input
                                        className="mt-1"
                                        list={`must-haves-${i}`}
                                        value={q.must_have}
                                        onChange={(e) => setQ(i, { must_have: e.target.value })}
                                        placeholder="e.g. 5+ years Postgres"
                                      />
                                      <datalist id={`must-haves-${i}`}>
                                        {state.must_have_skills.map((m) => (
                                          <option key={m} value={m} />
                                        ))}
                                      </datalist>
                                    </label>
                                    <label className="text-xs">
                                      <span className="text-muted-foreground">
                                        Why we ask (shown to candidates)
                                      </span>
                                      <Input
                                        className="mt-1"
                                        maxLength={200}
                                        value={q.why_asked}
                                        onChange={(e) => setQ(i, { why_asked: e.target.value })}
                                        placeholder="Confirms the depth this role needs on day one."
                                      />
                                    </label>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                  </AdvancedSection>
                </div>
              )}

              {/* STEP 3 — Locations, ownership, evaluation priorities */}
              {/* STEP 3 — Practicalities: the intake's own questions, prefilled
                  from what the client answered there. Nothing here is required. */}
              {step === 3 && (
                <div className="space-y-6" data-testid="edit-practicalities">
                  <p className="text-sm text-muted-foreground">
                    Money, place, authorisation, timing. If you do not have an answer yet, leave it —
                    the role is simply marked <span className="font-medium">Brief incomplete</span>{" "}
                    until you do. Nothing on this step is required to save.
                  </p>

                  <SectionHeader title="Location and working model" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label={fieldLabel("location")}
                      hint={
                        state.work_model === "remote"
                          ? "Optional for a remote role."
                          : "City and country, or the region candidates must live in."
                      }
                    >
                      <Input
                        data-field="location"
                        value={state.location}
                        onChange={(e) => set("location", e.target.value)}
                        placeholder="Manchester, United Kingdom"
                      />
                    </Field>
                    <Field label={fieldLabel("work_model")} error={errors.work_model}>
                      <Select
                        value={state.work_model || "unset"}
                        onValueChange={(v) =>
                          set("work_model", (v === "unset" ? "" : v) as State["work_model"])
                        }
                      >
                        <SelectTrigger data-field="work_model">
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Choose one</SelectItem>
                          {WORK_MODELS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {WORK_MODEL_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {state.work_model === "hybrid" && (
                    <Field
                      label="Days on site each week"
                      hint="Optional. Between 1 and 5 — candidates ask this first."
                    >
                      <Input
                        data-field="onsite_days"
                        inputMode="numeric"
                        className="max-w-[8rem]"
                        value={state.onsite_days}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 1);
                          set("onsite_days", digits === "" ? "" : Math.min(7, Number(digits)));
                        }}
                        placeholder="3"
                      />
                    </Field>
                  )}

                  {state.work_model === "remote" && (
                    <fieldset className="space-y-3 rounded-lg border p-4" data-field="remote_timezones">
                      <legend className="px-1 text-sm font-medium">
                        Acceptable timezones
                        <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                      </legend>
                      <p className="text-sm text-muted-foreground">
                        Pick the working-hours bands you can live with, or say anywhere in the country.
                      </p>
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <Checkbox
                          checked={state.remote_anywhere_in_country}
                          onCheckedChange={(c) =>
                            setState((cur) => ({
                              ...cur,
                              remote_anywhere_in_country: c === true,
                              remote_timezones: c === true ? [] : cur.remote_timezones,
                            }))
                          }
                          aria-label="Anywhere in the country — timezone does not matter"
                        />
                        <span>Anywhere in the country — timezone does not matter</span>
                      </label>
                      {!state.remote_anywhere_in_country && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {TIMEZONE_BANDS.map((tz) => (
                            <label key={tz.value} className="flex cursor-pointer items-start gap-3 text-sm">
                              <Checkbox
                                checked={state.remote_timezones.includes(tz.value)}
                                onCheckedChange={() => toggleIn("remote_timezones", tz.value)}
                                aria-label={tz.label}
                                data-timezone={tz.value}
                              />
                              <span>{tz.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  )}

                  <SectionHeader title="Visa sponsorship" subtitle={SPONSORSHIP_WHY_IT_MATTERS} />
                  <div className="space-y-2" role="radiogroup" aria-label="Can you sponsor a visa?">
                    {SPONSORSHIP_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="edit-sponsorship-available"
                          value={opt.value}
                          checked={state.sponsorship_available === opt.value}
                          onChange={() =>
                            setState((cur) => ({
                              ...cur,
                              sponsorship_available: opt.value,
                              // Same derivation as the intake: one answer, not two.
                              work_authorization_rule:
                                opt.value === "yes" ? "will_sponsor" : "already_authorized",
                            }))
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">{opt.label}</span>
                          <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <SectionHeader title="Compensation" subtitle={COMPENSATION_HONEST_LINE} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label={fieldLabel("currency")}>
                      <Select value={state.currency} onValueChange={(v) => set("currency", v)}>
                        <SelectTrigger aria-label="Currency" data-field="currency">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions("currency").map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={fieldLabel("budget_min")} hint={fieldHint("budget_min")}>
                      <Input
                        inputMode="numeric"
                        disabled={state.compensation_undecided}
                        value={state.budget_min}
                        onChange={(e) => set("budget_min", e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="70000"
                        aria-label="Minimum compensation"
                        data-field="budget_min"
                      />
                    </Field>
                    <Field label={fieldLabel("budget_max")} error={errors.budget_max}>
                      <Input
                        inputMode="numeric"
                        disabled={state.compensation_undecided}
                        value={state.budget_max}
                        onChange={(e) => set("budget_max", e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="85000"
                        aria-label="Maximum compensation"
                        data-field="budget_max"
                      />
                    </Field>
                    <Field label={fieldLabel("budget_period")}>
                      <Select
                        value={state.budget_period || "year"}
                        onValueChange={(v) => set("budget_period", v)}
                      >
                        <SelectTrigger aria-label="Period" data-field="budget_period">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMP_PERIODS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {COMP_PERIOD_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      checked={state.compensation_undecided}
                      onCheckedChange={(c) =>
                        setState((cur) => ({
                          ...cur,
                          compensation_undecided: c === true,
                          budget_min: c === true ? "" : cur.budget_min,
                          budget_max: c === true ? "" : cur.budget_max,
                        }))
                      }
                      aria-label="Not decided yet"
                    />
                    <span>
                      Not decided yet
                      <span className="block text-xs text-muted-foreground">
                        Recorded as undecided, never as zero.
                      </span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Equity">
                      <Select
                        value={state.equity || "unset"}
                        onValueChange={(v) => set("equity", (v === "unset" ? "" : v) as State["equity"])}
                      >
                        <SelectTrigger aria-label="Equity">
                          <SelectValue placeholder="Not stated" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Not stated</SelectItem>
                          {COMP_EQUITY.map((k) => (
                            <SelectItem key={k} value={k}>
                              {COMP_EQUITY_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Bonus">
                      <Input
                        value={state.bonus_structure}
                        onChange={(e) => set("bonus_structure", e.target.value)}
                        placeholder="10% annual bonus"
                      />
                    </Field>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      checked={state.compensation_flexible}
                      onCheckedChange={(c) => set("compensation_flexible", c === true)}
                      aria-label="Flexible for the right person"
                    />
                    <span>Flexible for the right person</span>
                  </label>
                  <Field label={fieldLabel("compensation")} hint="Bonus, relocation, shift premium, or where exactly you have room.">
                    <Textarea
                      rows={2}
                      value={state.compensation}
                      onChange={(e) => set("compensation", e.target.value)}
                      placeholder="Can stretch to 90k for someone exceptional"
                    />
                  </Field>

                  <SectionHeader title={fieldLabel("target_start_date")} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="When would you like them to start?">
                      <Input
                        type="date"
                        data-field="target_start_date"
                        value={state.target_start_date}
                        onChange={(e) => set("target_start_date", e.target.value)}
                      />
                    </Field>
                    <Field label={fieldLabel("hiring_urgency")}>
                      <Select
                        value={state.hiring_urgency || "unset"}
                        onValueChange={(v) => set("hiring_urgency", v === "unset" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Indicate your hiring timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Not stated</SelectItem>
                          <SelectItem value="asap">ASAP</SelectItem>
                          <SelectItem value="30_days">Within 30 days</SelectItem>
                          <SelectItem value="60_days">Within 60 days</SelectItem>
                          <SelectItem value="90_days">Within 90 days</SelectItem>
                          <SelectItem value="exploratory">Exploratory</SelectItem>
                          {state.hiring_urgency &&
                            !["asap", "30_days", "60_days", "90_days", "exploratory"].includes(state.hiring_urgency) && (
                              <SelectItem value={state.hiring_urgency}>{state.hiring_urgency}</SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              )}

              {/* STEP 4 — Process and confirm, as on the intake. */}
              {step === 4 && (
                <div className="space-y-6" data-testid="edit-process">
                  <SectionHeader title="What rules someone out?" subtitle={DEAL_BREAKER_WHY_IT_MATTERS} />
                  {/* Free-text deal-breakers, in the client's own words, as captured
                      at intake — editable here so a rule learned later can be added. */}
                  <ChipInput
                    label={fieldLabel("disqualifier_tags")}
                    hint="Short rules that rule someone out, e.g. no hands-on Postgres experience."
                    values={state.disqualifier_tags.filter(
                      (t) => !(DISQUALIFIER_OPTIONS as readonly string[]).includes(t),
                    )}
                    onChange={(v) =>
                      set("disqualifier_tags", [
                        ...state.disqualifier_tags.filter((t) =>
                          (DISQUALIFIER_OPTIONS as readonly string[]).includes(t),
                        ),
                        ...v.map((t) => t.slice(0, 120)),
                      ])
                    }
                    placeholder="e.g. no restaurant-scale experience"
                  />

                  {/* Auto-rejection is opt-in: nobody is filtered out by a rule the
                      client did not deliberately open and choose. */}
                  <Collapsible className="rounded-xl border bg-card/50">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <span className="text-sm font-medium">Add automatic disqualifiers</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          Optional
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t px-4 pb-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                      <p className="mb-3 mt-3 text-xs text-muted-foreground">
                        Anything you tick here rejects candidates automatically — that
                        decision, and its consequences, stay yours.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {DISQUALIFIER_OPTIONS.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={state.disqualifier_tags.includes(opt)}
                              onCheckedChange={() => toggleIn("disqualifier_tags", opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Field label={fieldLabel("interview_process")} hint={fieldHint("interview_process")}>
                    <Textarea
                      rows={3}
                      value={state.interview_process}
                      onChange={(e) => set("interview_process", e.target.value)}
                      placeholder="Screen → Technical → Panel → Offer"
                    />
                  </Field>
                  <Field label={fieldLabel("additional_context")} hint={fieldHint("additional_context")}>
                    <Textarea
                      rows={3}
                      value={state.additional_context}
                      onChange={(e) => set("additional_context", e.target.value)}
                    />
                  </Field>
                  <SectionHeader title="Your interview process" subtitle={INTERVIEW_PROCESS_WHY_IT_MATTERS} />
                  {state.interview_stages.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm">
                      <p className="font-medium">Most clients run three stages</p>
                      <p className="mt-1 text-muted-foreground">
                        {DEFAULT_INTERVIEW_STAGE_TEMPLATE.map((st) => st.name).join(" → ")}.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            set(
                              "interview_stages",
                              DEFAULT_INTERVIEW_STAGE_TEMPLATE.map((st) => ({
                                name: st.name,
                                format: st.format,
                                ownerName: "",
                                ownerEmail: "",
                              })),
                            )
                          }
                        >
                          Use this as a starting point
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            set("interview_stages", [
                              { name: "", format: "video_call", ownerName: "", ownerEmail: "" },
                            ])
                          }
                        >
                          Build my own
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3" data-field="interview_stages">
                      {state.interview_stages.map((stage, index) => {
                        const update = (patch: Partial<State["interview_stages"][number]>) =>
                          set(
                            "interview_stages",
                            state.interview_stages.map((st, i) => (i === index ? { ...st, ...patch } : st)),
                          );
                        return (
                          <div key={index} className="rounded-lg border p-3" data-testid="interview-stage">
                            <div className="flex items-center justify-between border-b pb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Stage {index + 1}
                              </span>
                              <button
                                type="button"
                                className="text-xs underline text-muted-foreground"
                                onClick={() =>
                                  set(
                                    "interview_stages",
                                    state.interview_stages.filter((_, i) => i !== index),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <Field label="What is this stage?">
                                <Input
                                  value={stage.name}
                                  maxLength={60}
                                  onChange={(e) => update({ name: e.target.value })}
                                  placeholder="Hiring manager interview"
                                />
                              </Field>
                              <Field label="Format">
                                <Select
                                  value={stage.format}
                                  onValueChange={(v) => update({ format: v as InterviewStageFormat })}
                                >
                                  <SelectTrigger aria-label={`Stage ${index + 1} format`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INTERVIEW_STAGE_FORMATS.map((f) => (
                                      <SelectItem key={f} value={f}>
                                        {INTERVIEW_STAGE_FORMAT_LABELS[f]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field label="Who runs it?">
                                <Input
                                  value={stage.ownerName}
                                  onChange={(e) => update({ ownerName: e.target.value })}
                                  placeholder="Dana Okoro"
                                />
                              </Field>
                              <Field label="Their email">
                                <Input
                                  type="email"
                                  value={stage.ownerEmail}
                                  onChange={(e) => update({ ownerEmail: e.target.value })}
                                  placeholder="dana@company.com"
                                />
                              </Field>
                            </div>
                          </div>
                        );
                      })}
                      {state.interview_stages.length < MAX_INTERVIEW_STAGES && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            set("interview_stages", [
                              ...state.interview_stages,
                              { name: "", format: "video_call", ownerName: "", ownerEmail: "" },
                            ])
                          }
                        >
                          Add a stage
                        </Button>
                      )}
                      {errors.interview_stages && (
                        <p role="alert" className="text-xs text-destructive">{errors.interview_stages}</p>
                      )}
                    </div>
                  )}

                  <SectionHeader title="Timeline" />
                  <Field label={fieldLabel("time_to_hire")} hint="Days, e.g. 21. Optional.">
                    <Input
                      className="max-w-[12rem]"
                      value={state.time_to_hire}
                      onChange={(e) => set("time_to_hire", e.target.value)}
                      placeholder="21"
                      data-field="time_to_hire"
                    />
                  </Field>

                  <SectionHeader title="Decision maker" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Who makes the final decision?" hint="Name and role.">
                      <Input
                        data-field="decision_maker"
                        value={state.decision_maker}
                        onChange={(e) => set("decision_maker", e.target.value)}
                        placeholder="Dana Okoro, Operations Director"
                      />
                    </Field>
                    <Field label="Their email" error={errors.decision_maker_email}>
                      <Input
                        type="email"
                        data-field="decision_maker_email"
                        value={state.decision_maker_email}
                        onChange={(e) => set("decision_maker_email", e.target.value)}
                        placeholder="dana@company.com"
                      />
                    </Field>
                  </div>

                  {/* Structured locations and scoring priorities: an optional
                      refinement. A client never has to open it. */}
                  {audience === "admin" ? (
                    <RequisitionEditor
                      positionId={state.id}
                      onDirtyChange={setReqDirty}
                      saveRef={reqSaveRef}
                      audience={audience}
                      openWorldwide={state.open_worldwide}
                      workModel={state.work_model}
                      location={state.location}
                      currency={state.currency}
                      budgetMin={state.budget_min}
                      budgetMax={state.budget_max}
                      budgetPeriod={state.budget_period}
                    />
                  ) : (
                    <AdvancedSection label="Several locations, travel and scoring priorities">
                      <RequisitionEditor
                        positionId={state.id}
                        onDirtyChange={setReqDirty}
                        saveRef={reqSaveRef}
                        audience={audience}
                        openWorldwide={state.open_worldwide}
                        workModel={state.work_model}
                        location={state.location}
                        currency={state.currency}
                        budgetMin={state.budget_min}
                        budgetMax={state.budget_max}
                        budgetPeriod={state.budget_period}
                      />
                    </AdvancedSection>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={step === 1 || saveMutation.isPending}
            >
              Back
            </Button>
            {/* Save is offered on every step: the edit screen is the saved
                intake, and a client fixing one answer should not have to walk
                to the last step to keep it. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={step < LAST_STEP || canSubmit ? "outline" : "default"}
                onClick={() => stepSaveMutation.mutate()}
                disabled={stepSaveMutation.isPending || saveMutation.isPending || !dirty}
                data-testid="save-role"
              >
                {stepSaveMutation.isPending || saveMutation.isPending ? "Saving…" : "Save this role"}
              </Button>
              {step < LAST_STEP ? (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              ) : (
                canSubmit && (
                  <Button
                    type="button"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || blockingGaps.length > 0}
                    title={
                      blockingGaps.length > 0
                        ? `Still required: ${blockingGaps.map((g) => g.label).join(", ")}`
                        : undefined
                    }
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit for review"}
                  </Button>
                )
              )}
            </div>
          </div>
          {briefHints.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="brief-incomplete-hint">
              Brief incomplete — you can save now and add these later: {briefHints.join(", ")}.
            </p>
          )}
          {step === LAST_STEP && canSubmit && blockingGaps.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Before you can submit, answer: {blockingGaps.map((g) => g.label).join(", ")}. Everything
              else on the checklist only improves ranking.
            </p>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <JobQualityPanel
            positionId={state.id}
            onJumpToStep={setStep}
            draft={qualityDraft}
            onReadiness={({ blocking }) =>
              setBlockingGaps(blocking.map((g) => ({ label: g.label, step: g.step })))
            }
          />

          <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Draft saved locally</p>
            <p className="mt-1">
              Unsaved changes are stored in this browser until you save or cancel. Use the
              checklist to see what still needs attention before the role can be published.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const labelId = React.useId();
  // Associate the visible label with the control so screen readers announce a name.
  const labelled =
    label && React.isValidElement(children) &&
    !(children.props as Record<string, unknown>)["aria-label"] &&
    !(children.props as Record<string, unknown>)["aria-labelledby"]
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-labelledby": labelId,
        })
      : children;
  return (
    <div className={className}>
      {label && (
        <Label id={labelId} className="mb-1 block text-sm">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {labelled}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b pb-2">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

/**
 * Optional detail, folded away by default. Keeps each step to the handful of
 * answers we actually need, the way the client intake form does.
 */
function AdvancedSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible className="rounded-xl border bg-card/50">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="text-sm font-medium">{label}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Optional
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-6 border-t px-4 pb-4 pt-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChipInput({
  label,
  hint,
  error,
  values,
  onChange,
  placeholder,
  required,
  dataField,
}: {
  label: string;
  hint?: string;
  error?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  required?: boolean;
  dataField?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim().replace(/,$/, "");
    if (!v) return;
    const map = new Map<string, string>();
    for (const x of [...values, v]) {
      const t = x.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (!map.has(k)) map.set(k, t);
    }
    onChange(Array.from(map.values()));
    setDraft("");
  };
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <div className="flex gap-2">
        <Input
          data-field={dataField}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <li
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              <span>{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                className="text-muted-foreground"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

