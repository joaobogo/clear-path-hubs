// Wizard-style position editor UI, shared by admin and client edit routes.
// Mirrors the public /intake wizard 1:1 (Role Definition → Candidate Profile
// → Compensation → Search Criteria → Review) so admins and clients edit
// positions with the same questions asked at intake.
import { useEffect, useMemo, useState } from "react";
import {
  SCREENING_MAX_QUESTIONS,
  screeningTopicIssue,
  SCREENING_MAX_REQUIRED,
  countRequired,
} from "@/lib/screening-limits";
import { toast } from "sonner";
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
  savePositionEdit,
  type PositionEditInitial,
  type ScreeningInput,
} from "@/lib/position-edit.functions";
import { checkRequisitionDuplicate } from "@/lib/requisition.functions";
import { RequisitionEditor } from "@/components/positions/RequisitionEditor";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { JobPostStep } from "@/components/positions/JobPostStep";


const STEPS = [
  { id: 1, label: "Role Definition" },
  { id: 2, label: "Candidate Profile" },
  { id: 3, label: "Compensation" },
  { id: 4, label: "Search Criteria" },
  { id: 5, label: "Locations & Priorities" },
  { id: 6, label: "Job Post & Preview" },
  { id: 7, label: "Review & Save" },
];
const LAST_STEP = STEPS.length;


const DISQUALIFIER_OPTIONS = [
  "Compensation above budget",
  "No degree or certification",
  "No distributed/remote experience",
  "No relevant industry experience",
  "No work authorization",
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

function validateStep(step: number, s: State): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    // Mirrors the server schema exactly (title: min 3 chars, max 200).
    if (s.title.trim().length < 3) e.title = "Role title must be at least 3 characters";
    if (s.title.trim().length > 200) e.title = "Role title must be 200 characters or fewer";
    if (!s.work_model) e.work_model = "Select a work arrangement";
    if (!s.employment_type) e.employment_type = "Select an employment type";
    if (!s.seniority) e.seniority = "Select a seniority level";
    if (!s.headcount || (typeof s.headcount === "number" && s.headcount < 1))
      e.headcount = "At least 1 position";
    if (!s.open_worldwide && s.target_countries.length === 0)
      e.target_countries = "Add at least one target country, or mark as open worldwide";
  }
  if (step === 2) {
    if (s.must_have_skills.length < 3 && s.description.trim().length < 40) {
      e.must_have_skills =
        "Add at least 3 must-have skills or a job description of 40+ characters on Step 1";
    }
  }
  if (step === 3) {
    const min = Number(String(s.budget_min).replace(/[^0-9.]/g, ""));
    const max = Number(String(s.budget_max).replace(/[^0-9.]/g, ""));
    if (min && max && min > max) e.budget_max = "Maximum budget must be at least the minimum";
  }
  if (step === 4) {
    if (s.target_titles.length === 0) e.target_titles = "Add at least one target job title";
  }
  return e;
}

export function PositionEditWizard({
  initial,
  returnTo,
  invalidateKeys,
  audience,
  initialStep,
}: {
  initial: PositionEditInitial;
  returnTo: string;
  invalidateKeys: string[][];
  audience: "admin" | "client";
  initialStep?: number;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(savePositionEdit);

  const [step, setStep] = useState(() =>
    initialStep && initialStep >= 1 && initialStep <= LAST_STEP ? initialStep : 1,
  );
  const [state, setState] = useState<State>(() => initialState(initial));


  const [errors, setErrors] = useState<Record<string, string>>({});
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
    if (Object.keys(e).length === 0) setStep((n) => Math.min(LAST_STEP, n + 1));
  };
  const back = () => setStep((n) => Math.max(1, n - 1));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const all = {
        ...validateStep(1, state),
        ...validateStep(2, state),
        ...validateStep(3, state),
        ...validateStep(4, state),
      };
      if (Object.keys(all).length > 0) {
        setErrors(all);
        if (all.title || all.work_model || all.employment_type || all.seniority || all.headcount || all.target_countries)
          setStep(1);
        else if (all.must_have_skills) setStep(2);
        else if (all.target_titles) setStep(4);
        throw new Error("Please fix the highlighted fields");
      }
      return save({
        data: {
          id: state.id,
          title: state.title.trim(),
          department: state.department.trim(),
          location: state.location.trim(),
          work_model: state.work_model as "remote" | "hybrid" | "onsite",
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
        },
      });
    },
    onSuccess: async () => {
      toast.success("Position saved");
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      setSavedAt(null);
      setState((cur) => ({ ...cur }));
      await Promise.all(invalidateKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      navigate({ to: returnTo });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const progress = useMemo(() => Math.round(((step - 1) / (STEPS.length - 1)) * 100), [step]);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const key = Object.keys(errors)[0];
    document.querySelector<HTMLElement>(`[data-field="${key}"]`)?.focus();
  }, [errors]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {audience === "admin" ? "Admin · Edit position" : "Client · Edit position"}
          </p>
          <h1 className="truncate text-xl font-semibold sm:text-2xl">
            {initial.title || "Untitled role"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {initial.organization_name} · Status: {initial.status}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: returnTo })}>
          Cancel
        </Button>
      </header>

      {draftFound && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3">
          <p className="text-sm">
            An unsaved draft of this job was found
            {savedAt ? ` from ${new Date(savedAt).toLocaleString()}` : ""}.
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

      <div aria-label="Progress">
        <Progress value={progress} />
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className={s.id === step ? "font-medium text-foreground" : ""}
              aria-current={s.id === step ? "step" : undefined}
            >
              {s.id}. {s.label}
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
          {/* STEP 1 — Role Definition */}
          {step === 1 && (
            <div className="space-y-6">
              {dupWarning.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium">Possible duplicate requisition</p>
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
                <Field label="Role Title" error={errors.title} required className="sm:col-span-2">
                  <Input
                    data-field="title"
                    value={state.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                  />
                </Field>
                <Field label="Department">
                  <Input
                    value={state.department}
                    onChange={(e) => set("department", e.target.value)}
                  />
                </Field>
                <Field label="Location">
                  <Input value={state.location} onChange={(e) => set("location", e.target.value)} />
                </Field>
                <Field label="Employment Type" error={errors.employment_type} required>
                  <Select
                    value={state.employment_type}
                    onValueChange={(v) => set("employment_type", v as State["employment_type"])}
                  >
                    <SelectTrigger data-field="employment_type">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full time</SelectItem>
                      <SelectItem value="part_time">Part time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Work Arrangement" error={errors.work_model} required>
                  <Select
                    value={state.work_model}
                    onValueChange={(v) => set("work_model", v as State["work_model"])}
                  >
                    <SelectTrigger data-field="work_model">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Seniority Level" error={errors.seniority} required>
                  <Select value={state.seniority} onValueChange={(v) => set("seniority", v)}>
                    <SelectTrigger data-field="seniority">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intern">Intern</SelectItem>
                      <SelectItem value="Junior">Junior</SelectItem>
                      <SelectItem value="Mid">Mid</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Staff">Staff</SelectItem>
                      <SelectItem value="Principal">Principal</SelectItem>
                      <SelectItem value="Director">Director</SelectItem>
                      <SelectItem value="VP">VP</SelectItem>
                      <SelectItem value="C-Level">C-Level</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Positions to Fill" error={errors.headcount} required>
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
                label="Job Description"
                hint="Paste the JD or write it here. We use this to enrich matching."
              >
                <Textarea
                  rows={6}
                  value={state.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Paste the full job description or describe the role, responsibilities, and success criteria."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.description.trim().length} characters
                </p>
              </Field>

              <SectionHeader
                title="Geographic Requirements"
                subtitle="Where the role can be based."
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.open_worldwide}
                  onCheckedChange={(v) => set("open_worldwide", Boolean(v))}
                />
                <span>Open worldwide (fully remote — anywhere)</span>
              </label>
              {!state.open_worldwide && (
                <div className="space-y-4">
                  <ChipInput
                    label="Target Countries"
                    hint="Countries where the role can be based."
                    error={errors.target_countries}
                    values={state.target_countries}
                    onChange={(v) => set("target_countries", v)}
                    placeholder="e.g. United States, Portugal, Germany"
                    dataField="target_countries"
                  />
                  <ChipInput
                    label="States / Regions"
                    values={state.states_regions}
                    onChange={(v) => set("states_regions", v)}
                    placeholder="e.g. California, Bavaria, Ontario"
                  />
                  <ChipInput
                    label="Metro Areas"
                    values={state.metro_areas}
                    onChange={(v) => set("metro_areas", v)}
                    placeholder="e.g. San Francisco Bay Area, Berlin, Lisbon"
                  />
                  <Field label="Search Radius" hint="Optional. e.g. 25 miles, 50 km">
                    <Input
                      value={state.search_radius}
                      onChange={(e) => set("search_radius", e.target.value)}
                      placeholder="25 miles"
                    />
                  </Field>
                </div>
              )}

              <SectionHeader title="Timeline & Availability" subtitle="Optional." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Hiring Timeline">
                  <Select
                    value={state.hiring_urgency}
                    onValueChange={(v) => set("hiring_urgency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Indicate your hiring timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="30_days">Within 30 days</SelectItem>
                      <SelectItem value="60_days">Within 60 days</SelectItem>
                      <SelectItem value="90_days">Within 90 days</SelectItem>
                      <SelectItem value="exploratory">Exploratory</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Target Start Date">
                  <Input
                    type="date"
                    value={state.target_start_date}
                    onChange={(e) => set("target_start_date", e.target.value)}
                  />
                </Field>
                <Field label="Time to Hire" hint="How fast do you need to close?">
                  <Input
                    value={state.time_to_hire}
                    onChange={(e) => set("time_to_hire", e.target.value)}
                    placeholder="e.g. 4 weeks"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 — Candidate Profile */}
          {step === 2 && (
            <div className="space-y-6">
              <ChipInput
                label="Must-have skills"
                hint="Add at least 3 or provide a job description of at least 40 characters on Step 1."
                error={errors.must_have_skills}
                values={state.must_have_skills}
                onChange={(v) => set("must_have_skills", v)}
                placeholder="Type a skill and press Enter"
                dataField="must_have_skills"
              />
              <ChipInput
                label="Nice-to-have skills"
                hint="Bonus skills that strengthen a candidate."
                values={state.nice_to_have_skills}
                onChange={(v) => set("nice_to_have_skills", v)}
                placeholder="e.g. GraphQL, Terraform"
              />
              <ChipInput
                label="Required Certifications"
                values={state.certifications_list}
                onChange={(v) => set("certifications_list", v)}
                placeholder="e.g. AWS SA, PMP, CFA"
              />
              <ChipInput
                label="Required Tools & Platforms"
                values={state.tools_platforms}
                onChange={(v) => set("tools_platforms", v)}
                placeholder="e.g. Salesforce, Snowflake, Figma"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Minimum Experience" hint="Years of relevant experience.">
                  <Input
                    value={state.experience}
                    onChange={(e) => set("experience", e.target.value)}
                    placeholder="e.g. 5+ years"
                  />
                </Field>
                <Field label="Education Requirement">
                  <Input
                    value={state.education}
                    onChange={(e) => set("education", e.target.value)}
                    placeholder="e.g. BSc CS or equivalent"
                  />
                </Field>
                <Field label="Required Timezone Coverage" className="sm:col-span-2">
                  <Input
                    value={state.timezone_requirements}
                    onChange={(e) => set("timezone_requirements", e.target.value)}
                    placeholder="e.g. Must overlap CET 10:00–14:00"
                  />
                </Field>
              </div>
              <Field label="Core Responsibilities" hint="Top outcomes and day-to-day scope.">
                <Textarea
                  rows={4}
                  value={state.responsibilities}
                  onChange={(e) => set("responsibilities", e.target.value)}
                  placeholder="Own X. Lead Y. Deliver Z."
                />
              </Field>
              <Field
                label="Additional Requirements"
                hint="Anything else the candidate must have."
              >
                <Textarea
                  rows={3}
                  value={state.additional_requirements}
                  onChange={(e) => set("additional_requirements", e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* STEP 3 — Compensation */}
          {step === 3 && (
            <div className="space-y-6">
              <SectionHeader
                title="Budget range"
                subtitle="Give us a realistic band. We use this to filter candidates."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Currency">
                  <Select value={state.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="BRL">BRL</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Minimum" hint="Base salary or contract rate.">
                  <Input
                    type="number"
                    min={0}
                    value={state.budget_min}
                    onChange={(e) => set("budget_min", e.target.value)}
                    placeholder="80000"
                  />
                </Field>
                <Field label="Maximum">
                  <Input
                    type="number"
                    min={0}
                    value={state.budget_max}
                    onChange={(e) => set("budget_max", e.target.value)}
                    placeholder="120000"
                  />
                </Field>
              </div>
              <Field label="Notes" hint="Bonus, equity, benefits, structure — anything relevant.">
                <Textarea
                  rows={3}
                  value={state.compensation}
                  onChange={(e) => set("compensation", e.target.value)}
                  placeholder="e.g. Base + 20% bonus + equity. Fully remote stipend."
                />
              </Field>
            </div>
          )}

          {/* STEP 4 — Search Criteria */}
          {step === 4 && (
            <div className="space-y-6">
              <ChipInput
                label="Target Job Titles"
                hint="Titles to source from (current or previous roles)."
                error={errors.target_titles}
                values={state.target_titles}
                onChange={(v) => set("target_titles", v)}
                placeholder="e.g. Senior Software Engineer, Staff Engineer"
                required
                dataField="target_titles"
              />
              <Field
                label="Title Match Timing"
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
                    <SelectItem value="current">Current role only</SelectItem>
                    <SelectItem value="previous">Previous role only</SelectItem>
                    <SelectItem value="either">Either — current or previous</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div>
                <Label className="mb-2 block text-sm">Target Company Types</Label>
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
                label="Include Keywords"
                hint="Boost candidates whose profiles contain these terms."
                values={state.include_keywords}
                onChange={(v) => set("include_keywords", v)}
                placeholder="e.g. Kubernetes, distributed systems"
              />
              <ChipInput
                label="Exclude Keywords"
                hint="Filter out candidates whose profiles contain these terms."
                values={state.exclude_keywords}
                onChange={(v) => set("exclude_keywords", v)}
                placeholder="e.g. bootcamp only, agency"
              />

              {/* Free-text deal-breakers, in the client's own words, as captured
                  at intake — editable here so a rule learned later can be added. */}
              <ChipInput
                label="Your deal-breakers"
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

              <div>
                <Label className="mb-2 block text-sm">Immediate disqualification criteria</Label>
                <p className="mb-3 text-xs text-muted-foreground">
                  Select conditions that automatically disqualify a candidate.
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
              </div>

              <Field label="Interview Process" hint="Number of rounds, format, panel.">
                <Textarea
                  rows={3}
                  value={state.interview_process}
                  onChange={(e) => set("interview_process", e.target.value)}
                  placeholder="Screen → Technical → Panel → Offer"
                />
              </Field>
              <Field label="Additional Context" hint="Anything else we should know?">
                <Textarea
                  rows={3}
                  value={state.additional_context}
                  onChange={(e) => set("additional_context", e.target.value)}
                />
              </Field>

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
            </div>

          )}

          {/* STEP 5 — Locations, ownership, evaluation priorities */}
          {step === 5 && (
            <RequisitionEditor positionId={state.id} onDirtyChange={setReqDirty} />
          )}

          {/* STEP 6 — Job post personalisation + candidate preview */}
          {step === 6 && (
            <JobPostStep
              value={{
                title: state.title,
                department: state.department,
                location: state.location,
                work_model: state.work_model,
                employment_type: state.employment_type,
                seniority: state.seniority,
                description: state.description,
                responsibilities: state.responsibilities,
                must_have_skills: state.must_have_skills,
                nice_to_have_skills: state.nice_to_have_skills,
                education: state.education,
                experience: state.experience,
                currency: state.currency,
                budget_min: state.budget_min,
                budget_max: state.budget_max,
                company_intro: state.company_intro,
                benefits: state.benefits,
                languages: state.languages,
                travel: state.travel,
                work_authorization_note: state.work_authorization_note,
                accessibility_note: state.accessibility_note,
                eeo_statement: state.eeo_statement,
                brand_tone: state.brand_tone,
                application_deadline: state.application_deadline,
                confidentiality: state.confidentiality,
                screening_questions: state.screening_questions.map((q) => ({
                  question: q.question,
                  required: q.required,
                  answer_type: q.answer_type,
                })),
              }}
              onChange={(k, v) => set(k as keyof State, v as never)}
            />
          )}

          {/* STEP 7 — Review */}
          {step === 7 && (
            <div className="space-y-3 text-sm">
              <JobQualityPanel positionId={state.id} onJumpToStep={setStep} />

              <ReviewBlock title="Role">
                <div>
                  {state.title || "—"} · {state.work_model || "—"} · {state.employment_type || "—"}
                </div>
                <div className="text-muted-foreground">
                  {state.seniority || "—"} · Positions: {state.headcount || "—"}
                  {state.location ? ` · ${state.location}` : ""}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Geography">
                <div>
                  {state.open_worldwide
                    ? "Open worldwide"
                    : state.target_countries.join(", ") || "—"}
                </div>
                {state.metro_areas.length > 0 && (
                  <div className="text-muted-foreground">
                    Metros: {state.metro_areas.join(", ")}
                  </div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Candidate profile">
                <div>Must-have: {state.must_have_skills.join(", ") || "—"}</div>
                <div>Nice-to-have: {state.nice_to_have_skills.join(", ") || "—"}</div>
                <div className="text-muted-foreground">
                  Experience: {state.experience || "—"} · Education: {state.education || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Compensation">
                <div>
                  {state.budget_min || "—"}
                  {state.budget_max ? ` – ${state.budget_max}` : ""} {state.currency}
                </div>
                {state.compensation && (
                  <div className="text-muted-foreground">{state.compensation}</div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Search criteria">
                <div>Titles: {state.target_titles.join(", ") || "—"}</div>
                {state.disqualifier_tags.length > 0 && (
                  <div className="text-muted-foreground">
                    Disqualifiers: {state.disqualifier_tags.join(", ")}
                  </div>
                )}
                <div className="text-muted-foreground">
                  Screening questions: {state.screening_questions.length}
                </div>
              </ReviewBlock>
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
        {step < LAST_STEP ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        )}
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
  return (
    <div className={className}>
      {label && (
        <Label className="mb-1 block text-sm">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
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

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
