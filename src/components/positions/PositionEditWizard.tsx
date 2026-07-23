// Wizard-style position editor UI, shared by admin and client edit routes.
// Mirrors the 4 role-related steps of the public intake wizard so users
// edit positions with the same form they use to create them.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
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

const STEPS = [
  { id: 1, label: "Role overview" },
  { id: 2, label: "Requirements & profile" },
  { id: 3, label: "Compensation" },
  { id: 4, label: "Search criteria" },
  { id: 5, label: "Review & save" },
];
const LAST_STEP = STEPS.length;


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

function validateStep(step: number, s: State): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!s.title.trim()) e.title = "Role title is required";
    if (!s.work_model) e.work_model = "Select a work model";
  }
  if (step === 2) {
    const skills = unique(s.must_have_skills);
    if (skills.length < 3 && s.description.trim().length < 40) {
      e.must_have_skills =
        "Provide at least 3 must-have skills or a description of at least 40 characters";
    }
  }
  return e;
}

export function PositionEditWizard({
  initial,
  returnTo,
  invalidateKeys,
  audience,
}: {
  initial: PositionEditInitial;
  returnTo: string;
  invalidateKeys: string[][];
  audience: "admin" | "client";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(savePositionEdit);

  const [step, setStep] = useState(1);
  const [state, setState] = useState<State>({
    id: initial.id,
    title: initial.title,
    department: initial.department,
    location: initial.location,
    work_model: initial.work_model,
    employment_type: initial.employment_type,
    seniority: initial.seniority,
    headcount: initial.headcount,
    description: initial.description,
    must_have_skills: initial.must_have_skills,
    preferred_requirements: initial.preferred_requirements,
    dealbreakers: initial.dealbreakers,
    compensation: initial.compensation,
    hiring_urgency: initial.hiring_urgency,
    target_countries: initial.target_countries,
    work_authorization: initial.work_authorization,
    target_titles: initial.target_titles,
    screening_questions: initial.screening_questions,
    responsibilities: initial.responsibilities,
    experience: initial.experience,
    education: initial.education,
    certifications: initial.certifications,
    languages: initial.languages,
    industry_experience: initial.industry_experience,
    hiring_timeline: initial.hiring_timeline,
    timezone_requirements: initial.timezone_requirements,
    reason_for_hiring: initial.reason_for_hiring,
    hiring_challenges: initial.hiring_challenges,
    interview_process: initial.interview_process,
    decision_makers: initial.decision_makers,
    additional_context: initial.additional_context,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skillDraft, setSkillDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [qDraft, setQDraft] = useState("");

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const next = () => {
    const e = validateStep(step, state);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((n) => Math.min(4, n + 1));
  };
  const back = () => setStep((n) => Math.max(1, n - 1));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const all = { ...validateStep(1, state), ...validateStep(2, state) };
      if (Object.keys(all).length > 0) {
        setErrors(all);
        if (all.title || all.work_model) setStep(1);
        else if (all.must_have_skills) setStep(2);
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
          must_have_skills: unique(state.must_have_skills),
          preferred_requirements: state.preferred_requirements,
          dealbreakers: state.dealbreakers,
          compensation: state.compensation.trim(),
          hiring_urgency: state.hiring_urgency.trim(),
          target_countries: unique(state.target_countries),
          work_authorization: state.work_authorization.trim(),
          target_titles: unique(state.target_titles),
          screening_questions: state.screening_questions.filter(
            (q) => q.question.trim().length >= 3,
          ),
        },
      });
    },
    onSuccess: async () => {
      toast.success("Position saved");
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
        <CardContent className="space-y-5">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role title" error={errors.title} required className="sm:col-span-2">
                <Input
                  data-field="title"
                  value={state.title}
                  onChange={(e) => set("title", e.target.value)}
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
              <Field label="Work model" error={errors.work_model} required>
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
              <Field label="Employment type">
                <Select
                  value={state.employment_type}
                  onValueChange={(v) => set("employment_type", v as State["employment_type"])}
                >
                  <SelectTrigger>
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
              <Field label="Seniority">
                <Input
                  value={state.seniority}
                  onChange={(e) => set("seniority", e.target.value)}
                  placeholder="Senior, Lead, Principal…"
                />
              </Field>
              <Field label="Openings">
                <Input
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
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Must-have skills"
                hint="Add at least 3 or write a description of 40+ characters."
                error={errors.must_have_skills}
              >
                <div className="flex gap-2">
                  <Input
                    data-field="must_have_skills"
                    value={skillDraft}
                    onChange={(e) => setSkillDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const v = skillDraft.trim().replace(/,$/, "");
                        if (v) set("must_have_skills", unique([...state.must_have_skills, v]));
                        setSkillDraft("");
                      }
                    }}
                    placeholder="Type a skill and press Enter"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = skillDraft.trim();
                      if (v) set("must_have_skills", unique([...state.must_have_skills, v]));
                      setSkillDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.must_have_skills}
                  onRemove={(i) =>
                    set(
                      "must_have_skills",
                      state.must_have_skills.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </Field>
              <Field label="Description">
                <Textarea
                  data-field="description"
                  rows={6}
                  value={state.description}
                  onChange={(e) => set("description", e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.description.trim().length} / 40 minimum characters
                </p>
              </Field>
              <Field label="Preferred skills" hint="One per line.">
                <Textarea
                  rows={3}
                  value={state.preferred_requirements}
                  onChange={(e) => set("preferred_requirements", e.target.value)}
                />
              </Field>
              <Field label="Dealbreakers" hint="One per line.">
                <Textarea
                  rows={3}
                  value={state.dealbreakers}
                  onChange={(e) => set("dealbreakers", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Compensation">
                <Input
                  value={state.compensation}
                  onChange={(e) => set("compensation", e.target.value)}
                  placeholder="e.g. €80k–€110k + equity"
                />
              </Field>
              <Field label="Hiring urgency">
                <Select
                  value={state.hiring_urgency}
                  onValueChange={(v) => set("hiring_urgency", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
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
              <Field label="Work authorization">
                <Input
                  value={state.work_authorization}
                  onChange={(e) => set("work_authorization", e.target.value)}
                  placeholder="EU, US, sponsor…"
                />
              </Field>
              <Field label="Target countries" hint="Enter to add." className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input
                    value={countryDraft}
                    onChange={(e) => setCountryDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = countryDraft.trim();
                        if (v) set("target_countries", unique([...state.target_countries, v]));
                        setCountryDraft("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = countryDraft.trim();
                      if (v) set("target_countries", unique([...state.target_countries, v]));
                      setCountryDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.target_countries}
                  onRemove={(i) =>
                    set(
                      "target_countries",
                      state.target_countries.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </Field>
              <Field label="Target titles" hint="Similar titles to consider." className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = titleDraft.trim();
                        if (v) set("target_titles", unique([...state.target_titles, v]));
                        setTitleDraft("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = titleDraft.trim();
                      if (v) set("target_titles", unique([...state.target_titles, v]));
                      setTitleDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.target_titles}
                  onRemove={(i) =>
                    set(
                      "target_titles",
                      state.target_titles.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </Field>
              <Field label="Screening questions" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = qDraft.trim();
                        if (v.length >= 3) {
                          set("screening_questions", [
                            ...state.screening_questions,
                            {
                              question: v,
                              answer_type: "text",
                              required: false,
                              dealbreaker: false,
                            },
                          ]);
                          setQDraft("");
                        }
                      }
                    }}
                    placeholder="Add a question and press Enter"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = qDraft.trim();
                      if (v.length >= 3) {
                        set("screening_questions", [
                          ...state.screening_questions,
                          {
                            question: v,
                            answer_type: "text",
                            required: false,
                            dealbreaker: false,
                          },
                        ]);
                        setQDraft("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {state.screening_questions.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {state.screening_questions.map((q, i) => (
                      <li
                        key={q.id ?? `new-${i}`}
                        className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm"
                      >
                        <span className="flex-1">{q.question}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          aria-label={`Remove ${q.question}`}
                          onClick={() =>
                            set(
                              "screening_questions",
                              state.screening_questions.filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <ReviewBlock title="Role">
                <div>
                  {state.title || "—"} · {state.work_model || "—"}
                  {state.location ? ` · ${state.location}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {state.seniority || "—"} · {state.employment_type || "—"} · Openings{" "}
                  {state.headcount || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Requirements">
                <div>Must-have: {unique(state.must_have_skills).join(", ") || "—"}</div>
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {state.description || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Hiring context">
                <div>Compensation: {state.compensation || "—"}</div>
                <div>Urgency: {state.hiring_urgency || "—"}</div>
                <div>Countries: {state.target_countries.join(", ") || "—"}</div>
                <div>Screening questions: {state.screening_questions.length}</div>
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
        {step < 4 ? (
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

function ChipList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((v, i) => (
        <li
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
        >
          <span>{v}</span>
          <button
            type="button"
            aria-label={`Remove ${v}`}
            className="text-muted-foreground"
            onClick={() => onRemove(i)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
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

// Unused import guard for tsc
void Checkbox;
