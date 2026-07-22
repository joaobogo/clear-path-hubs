import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FormShell } from "@/components/marketing/form-shell";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start a hiring engagement — TaaSFlow" },
      {
        name: "description",
        content:
          "Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — usually within 48 hours.",
      },
      { property: "og:title", content: "Start a hiring engagement — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — usually within 48 hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

const DRAFT_KEY = "taasflow.intake.draft.v2";
const IDEM_KEY = "taasflow.intake.idem.v2";

type ScreeningQ = {
  question: string;
  answer_type: "text" | "boolean" | "number";
  required: boolean;
  dealbreaker: boolean;
};

type FormState = {
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;
  companyName: string;
  companyWebsite: string;
  industry: string;
  companySize: string;
  headquarters: string;
  roleTitle: string;
  department: string;
  location: string;
  workModel: "" | "remote" | "hybrid" | "onsite";
  employmentType: "" | "full_time" | "part_time" | "contract" | "temporary" | "internship";
  seniority: string;
  headcount: string;
  jobDescription: string;
  responsibilities: string;
  mustHaveSkills: string[];
  preferredRequirements: string;
  experience: string;
  education: string;
  certifications: string;
  languages: string;
  industryExperience: string;
  dealbreakers: string;
  compensation: string;
  hiringUrgency: string;
  hiringTimeline: string;
  targetCountries: string[];
  workAuthorization: string;
  targetTitles: string[];
  timezoneRequirements: string;
  reasonForHiring: "" | "replacement" | "growth" | "backfill" | "new_team";
  hiringChallenges: string;
  interviewProcess: string;
  decisionMakers: string;
  additionalContext: string;
  screeningQuestions: ScreeningQ[];
  consent: boolean;
};

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  workEmail: "",
  phone: "",
  companyName: "",
  companyWebsite: "",
  industry: "",
  companySize: "",
  headquarters: "",
  roleTitle: "",
  department: "",
  location: "",
  workModel: "",
  employmentType: "",
  seniority: "",
  headcount: "",
  jobDescription: "",
  responsibilities: "",
  mustHaveSkills: [],
  preferredRequirements: "",
  experience: "",
  education: "",
  certifications: "",
  languages: "",
  industryExperience: "",
  dealbreakers: "",
  compensation: "",
  hiringUrgency: "",
  hiringTimeline: "",
  targetCountries: [],
  workAuthorization: "",
  targetTitles: [],
  timezoneRequirements: "",
  reasonForHiring: "",
  hiringChallenges: "",
  interviewProcess: "",
  decisionMakers: "",
  additionalContext: "",
  screeningQuestions: [],
  consent: false,
};

const STEPS = [
  { id: 1, label: "Contact & company" },
  { id: 2, label: "Role overview" },
  { id: 3, label: "Requirements" },
  { id: 4, label: "Hiring context" },
  { id: 5, label: "Review & submit" },
];

function emailIsValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function uniqueLower(arr: string[]) {
  const map = new Map<string, string>();
  for (const s of arr) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!map.has(k)) map.set(k, t);
  }
  return Array.from(map.values());
}

function validateStep(step: number, s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!s.firstName.trim()) e.firstName = "First name is required";
    if (!s.lastName.trim()) e.lastName = "Last name is required";
    if (!emailIsValid(s.workEmail)) e.workEmail = "Enter a valid work email";
    if (!s.companyName.trim()) e.companyName = "Company name is required";
  }
  if (step === 2) {
    if (!s.roleTitle.trim()) e.roleTitle = "Role title is required";
    if (!s.workModel) e.workModel = "Select a work model";
  }
  if (step === 3) {
    const skills = uniqueLower(s.mustHaveSkills);
    const desc = s.jobDescription.trim();
    if (skills.length < 3 && desc.length < 40) {
      e.mustHaveSkills =
        "Provide at least 3 must-have skills or a job description of at least 40 characters";
    }
  }
  if (step === 5) {
    if (!s.consent) e.consent = "You must accept the terms to submit";
  }
  return e;
}

function IntakePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [qDraft, setQDraft] = useState("");
  const idemRef = useRef<string>("");
  const firstErrRef = useRef<HTMLElement | null>(null);

  // Load draft + idempotency key from storage (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...EMPTY, ...parsed });
      }
      let idem = localStorage.getItem(IDEM_KEY);
      if (!idem) {
        idem = crypto.randomUUID();
        localStorage.setItem(IDEM_KEY, idem);
      }
      idemRef.current = idem;
    } catch {
      idemRef.current = crypto.randomUUID();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* noop */
    }
  }, [state]);

  // Focus first invalid field when errors change
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const first = Object.keys(errors)[0];
    const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    if (el) {
      el.focus();
      firstErrRef.current = el;
    }
  }, [errors]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const next = () => {
    const stepErrs = validateStep(step, state);
    setErrors(stepErrs);
    if (Object.keys(stepErrs).length === 0) setStep((n) => Math.min(5, n + 1));
  };
  const back = () => setStep((n) => Math.max(1, n - 1));

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      toast.success("Draft saved on this device");
    } catch {
      toast.error("Could not save draft");
    }
  };

  const submit = async () => {
    // Cross-step validation
    const allErrs = {
      ...validateStep(1, state),
      ...validateStep(2, state),
      ...validateStep(3, state),
      ...validateStep(5, state),
    };
    setErrors(allErrs);
    if (Object.keys(allErrs).length > 0) {
      // jump back to first step containing an error
      const firstKey = Object.keys(allErrs)[0];
      if (["firstName", "lastName", "workEmail", "companyName"].includes(firstKey)) setStep(1);
      else if (["roleTitle", "workModel"].includes(firstKey)) setStep(2);
      else if (["mustHaveSkills", "jobDescription"].includes(firstKey)) setStep(3);
      else if (firstKey === "consent") setStep(5);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        idempotencyKey: idemRef.current || crypto.randomUUID(),
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        workEmail: state.workEmail.trim().toLowerCase(),
        companyName: state.companyName.trim(),
        companyWebsite: state.companyWebsite.trim(),
        industry: state.industry.trim(),
        headquarters: state.headquarters.trim(),
        roleTitle: state.roleTitle.trim(),
        department: state.department.trim(),
        location: state.location.trim(),
        workModel: state.workModel,
        employmentType: state.employmentType || "",
        seniority: state.seniority.trim(),
        headcount: state.headcount ? Number(state.headcount) : null,
        jobDescription: state.jobDescription.trim(),
        mustHaveSkills: uniqueLower(state.mustHaveSkills),
        preferredRequirements: state.preferredRequirements.trim(),
        dealbreakers: state.dealbreakers.trim(),
        compensation: state.compensation.trim(),
        hiringUrgency: state.hiringUrgency.trim(),
        targetCountries: uniqueLower(state.targetCountries),
        workAuthorization: state.workAuthorization.trim(),
        targetTitles: uniqueLower(state.targetTitles),
        timezoneRequirements: state.timezoneRequirements.trim(),
        screeningQuestions: state.screeningQuestions.filter((q) => q.question.trim().length >= 3),
        consent: state.consent,
        source: "public_form",
        submittedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/public/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error(body?.message || body?.error || "Submission failed. Please retry.");
        return;
      }
      // clear draft on success (keep idem in case of navigation retry not needed)
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(IDEM_KEY);
      } catch {
        /* noop */
      }
      navigate({
        to: "/intake/confirmation",
        search: { intake_id: body.intakeId },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => Math.round(((step - 1) / (STEPS.length - 1)) * 100), [step]);

  return (
    <FormShell
      exitTo="/"
      exitLabel="Exit"
      progress={{ step, total: STEPS.length, label: `Step ${step} of ${STEPS.length}` }}
      width="lg"
      eyebrow="Employer intake"
      title="Start a hiring engagement"
      description="Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — usually within 48 hours. No account required. Your progress is saved as you go."
    >

      <div className="mb-6" aria-label="Progress">
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
          <CardTitle className="text-xl">
            Step {step}: {STEPS[step - 1].label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName} required>
                <Input
                  data-field="firstName"
                  value={state.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name" error={errors.lastName} required>
                <Input
                  data-field="lastName"
                  value={state.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  autoComplete="family-name"
                />
              </Field>
              <Field label="Work email" error={errors.workEmail} required className="sm:col-span-2">
                <Input
                  data-field="workEmail"
                  type="email"
                  value={state.workEmail}
                  onChange={(e) => set("workEmail", e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Company name" error={errors.companyName} required>
                <Input
                  data-field="companyName"
                  value={state.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  autoComplete="organization"
                />
              </Field>
              <Field label="Phone" hint="Optional. Best number to reach you.">
                <Input
                  type="tel"
                  value={state.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  autoComplete="tel"
                  placeholder="+1 555 123 4567"
                />
              </Field>
              <Field label="Company website">
                <Input
                  value={state.companyWebsite}
                  onChange={(e) => set("companyWebsite", e.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Industry">
                <Input
                  value={state.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  placeholder="SaaS, Fintech, Healthcare…"
                />
              </Field>
              <Field label="Company size">
                <Select
                  value={state.companySize}
                  onValueChange={(v) => set("companySize", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1–10</SelectItem>
                    <SelectItem value="11-50">11–50</SelectItem>
                    <SelectItem value="51-200">51–200</SelectItem>
                    <SelectItem value="201-500">201–500</SelectItem>
                    <SelectItem value="501-1000">501–1000</SelectItem>
                    <SelectItem value="1000+">1000+</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Headquarters" className="sm:col-span-2">
                <Input
                  value={state.headquarters}
                  onChange={(e) => set("headquarters", e.target.value)}
                  placeholder="City, Country"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role title" error={errors.roleTitle} required className="sm:col-span-2">
                <Input
                  data-field="roleTitle"
                  value={state.roleTitle}
                  onChange={(e) => set("roleTitle", e.target.value)}
                />
              </Field>
              <Field label="Department">
                <Input
                  value={state.department}
                  onChange={(e) => set("department", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={state.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </Field>
              <Field label="Work model" error={errors.workModel} required>
                <Select
                  value={state.workModel}
                  onValueChange={(v) => set("workModel", v as FormState["workModel"])}
                >
                  <SelectTrigger data-field="workModel">
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
                  value={state.employmentType}
                  onValueChange={(v) => set("employmentType", v as FormState["employmentType"])}
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
              <Field label="Headcount">
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={state.headcount}
                  onChange={(e) => set("headcount", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field
                label="Must-have skills"
                hint="Add at least 3 or provide a job description of at least 40 characters."
                error={errors.mustHaveSkills}
              >
                <div className="flex gap-2">
                  <Input
                    data-field="mustHaveSkills"
                    value={skillDraft}
                    onChange={(e) => setSkillDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const v = skillDraft.trim().replace(/,$/, "");
                        if (v) set("mustHaveSkills", uniqueLower([...state.mustHaveSkills, v]));
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
                      if (v) set("mustHaveSkills", uniqueLower([...state.mustHaveSkills, v]));
                      setSkillDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.mustHaveSkills}
                  onRemove={(i) =>
                    set(
                      "mustHaveSkills",
                      state.mustHaveSkills.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </Field>
              <Field label="Job description">
                <Textarea
                  data-field="jobDescription"
                  rows={6}
                  value={state.jobDescription}
                  onChange={(e) => set("jobDescription", e.target.value)}
                  placeholder="Describe the role, responsibilities, and success criteria."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.jobDescription.trim().length} / 40 minimum characters
                </p>
              </Field>
              <Field label="Key responsibilities" hint="Top outcomes and day-to-day scope.">
                <Textarea
                  rows={3}
                  value={state.responsibilities}
                  onChange={(e) => set("responsibilities", e.target.value)}
                  placeholder="Own X. Lead Y. Deliver Z."
                />
              </Field>
              <Field label="Preferred skills" hint="One per line.">
                <Textarea
                  rows={3}
                  value={state.preferredRequirements}
                  onChange={(e) => set("preferredRequirements", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Experience">
                  <Input
                    value={state.experience}
                    onChange={(e) => set("experience", e.target.value)}
                    placeholder="e.g. 5+ years"
                  />
                </Field>
                <Field label="Education">
                  <Input
                    value={state.education}
                    onChange={(e) => set("education", e.target.value)}
                    placeholder="e.g. BSc CS or equivalent"
                  />
                </Field>
                <Field label="Certifications">
                  <Input
                    value={state.certifications}
                    onChange={(e) => set("certifications", e.target.value)}
                    placeholder="AWS SA, PMP…"
                  />
                </Field>
                <Field label="Languages">
                  <Input
                    value={state.languages}
                    onChange={(e) => set("languages", e.target.value)}
                    placeholder="English (fluent), German (B2)…"
                  />
                </Field>
                <Field label="Industry experience" className="sm:col-span-2">
                  <Input
                    value={state.industryExperience}
                    onChange={(e) => set("industryExperience", e.target.value)}
                    placeholder="Fintech, healthcare, gaming…"
                  />
                </Field>
              </div>
              <Field label="Dealbreakers" hint="One per line.">
                <Textarea
                  rows={3}
                  value={state.dealbreakers}
                  onChange={(e) => set("dealbreakers", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 4 && (
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
                  value={state.hiringUrgency}
                  onValueChange={(v) => set("hiringUrgency", v)}
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
              <Field label="Hiring timeline" hint="Target start date or key milestones.">
                <Input
                  value={state.hiringTimeline}
                  onChange={(e) => set("hiringTimeline", e.target.value)}
                  placeholder="Start by Q3, onboarding by Sept…"
                />
              </Field>
              <Field label="Reason for hiring" className="sm:col-span-2">
                <Select
                  value={state.reasonForHiring}
                  onValueChange={(v) => set("reasonForHiring", v as FormState["reasonForHiring"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="growth">Growth — new headcount</SelectItem>
                    <SelectItem value="replacement">Replacement</SelectItem>
                    <SelectItem value="backfill">Backfill</SelectItem>
                    <SelectItem value="new_team">New team / function</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Work authorization">
                <Input
                  value={state.workAuthorization}
                  onChange={(e) => set("workAuthorization", e.target.value)}
                  placeholder="EU, US, sponsor…"
                />
              </Field>
              <Field label="Timezone requirements">
                <Input
                  value={state.timezoneRequirements}
                  onChange={(e) => set("timezoneRequirements", e.target.value)}
                  placeholder="CET ±3h"
                />
              </Field>
              <Field label="Target countries" hint="Add and press Enter." className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input
                    value={countryDraft}
                    onChange={(e) => setCountryDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = countryDraft.trim();
                        if (v) set("targetCountries", uniqueLower([...state.targetCountries, v]));
                        setCountryDraft("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = countryDraft.trim();
                      if (v) set("targetCountries", uniqueLower([...state.targetCountries, v]));
                      setCountryDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.targetCountries}
                  onRemove={(i) =>
                    set(
                      "targetCountries",
                      state.targetCountries.filter((_, idx) => idx !== i),
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
                        if (v) set("targetTitles", uniqueLower([...state.targetTitles, v]));
                        setTitleDraft("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = titleDraft.trim();
                      if (v) set("targetTitles", uniqueLower([...state.targetTitles, v]));
                      setTitleDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ChipList
                  items={state.targetTitles}
                  onRemove={(i) =>
                    set("targetTitles", state.targetTitles.filter((_, idx) => idx !== i))
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
                          set("screeningQuestions", [
                            ...state.screeningQuestions,
                            { question: v, answer_type: "text", required: false, dealbreaker: false },
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
                        set("screeningQuestions", [
                          ...state.screeningQuestions,
                          { question: v, answer_type: "text", required: false, dealbreaker: false },
                        ]);
                        setQDraft("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {state.screeningQuestions.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {state.screeningQuestions.map((q, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm"
                      >
                        <span className="flex-1">{q.question}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() =>
                            set(
                              "screeningQuestions",
                              state.screeningQuestions.filter((_, idx) => idx !== i),
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
              <Field label="Current hiring challenges" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={state.hiringChallenges}
                  onChange={(e) => set("hiringChallenges", e.target.value)}
                  placeholder="What has made this role hard to fill?"
                />
              </Field>
              <Field label="Interview process" hint="Number of rounds, format, panel." className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={state.interviewProcess}
                  onChange={(e) => set("interviewProcess", e.target.value)}
                  placeholder="Screen → Technical → Panel → Offer"
                />
              </Field>
              <Field label="Decision makers" hint="Who signs off on the hire?" className="sm:col-span-2">
                <Input
                  value={state.decisionMakers}
                  onChange={(e) => set("decisionMakers", e.target.value)}
                  placeholder="Hiring manager, VP Eng, CEO…"
                />
              </Field>
              <Field label="Additional context" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={state.additionalContext}
                  onChange={(e) => set("additionalContext", e.target.value)}
                  placeholder="Anything else we should know?"
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm">
              <ReviewBlock title="Contact">
                <div>
                  {state.firstName} {state.lastName} · {state.workEmail}
                </div>
                <div className="text-muted-foreground">
                  {state.companyName}
                  {state.companyWebsite ? ` · ${state.companyWebsite}` : ""}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Role">
                <div>
                  {state.roleTitle} · {state.workModel || "—"}
                  {state.location ? ` · ${state.location}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {state.seniority || "—"} · {state.employmentType || "—"} · Headcount {state.headcount || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Requirements">
                <div>Must-have: {uniqueLower(state.mustHaveSkills).join(", ") || "—"}</div>
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {state.jobDescription || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Hiring context">
                <div>Compensation: {state.compensation || "—"}</div>
                <div>Urgency: {state.hiringUrgency || "—"}</div>
                <div>Countries: {state.targetCountries.join(", ") || "—"}</div>
                <div>Screening questions: {state.screeningQuestions.length}</div>
              </ReviewBlock>

              <Field label="" error={errors.consent}>
                <label className="flex items-start gap-2">
                  <Checkbox
                    data-field="consent"
                    checked={state.consent}
                    onCheckedChange={(v) => set("consent", Boolean(v))}
                  />
                  <span className="text-sm">
                    I confirm this request is on behalf of my organization and accept TaaSFlow's terms
                    for processing candidate data.
                  </span>
                </label>
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={back} disabled={step === 1 || submitting}>
            Back
          </Button>
          <Button type="button" variant="ghost" onClick={saveDraft} disabled={submitting}>
            Save draft
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <a href="mailto:hello@taasflow.com" className="text-sm text-muted-foreground underline">
            Talk to TaaSFlow
          </a>
          {step < 5 ? (
            <Button type="button" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit intake"}
            </Button>
          )}
        </div>
      </div>
    </main>
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
