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
          "Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — with a first ranked shortlist within 14 days.",
      },
      { property: "og:title", content: "Start a hiring engagement — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — with a first ranked shortlist within 14 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

const DRAFT_KEY = "taasflow.intake.draft.v3";
const IDEM_KEY = "taasflow.intake.idem.v3";

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

type FormState = {
  // Step 1 — Role Definition
  roleTitle: string;
  employmentType: "" | "full_time" | "part_time" | "contract" | "temporary" | "internship";
  workModel: "" | "remote" | "hybrid" | "onsite";
  seniority: string;
  headcount: string;
  jobDescription: string;
  openWorldwide: boolean;
  targetCountries: string[];
  statesRegions: string[];
  metroAreas: string[];
  searchRadius: string;
  hiringUrgency: string;
  targetStartDate: string;
  timeToHire: string;
  department: string;
  location: string;

  // Step 2 — Hiring Contact
  companyName: string;
  companyWebsite: string;
  companySize: string;
  headquarters: string;
  hireFromCountries: string[];
  firstName: string;
  lastName: string;
  currentTitle: string;
  workEmail: string;
  phone: string;
  employerValueProposition: string;

  // Step 3 — Candidate Profile
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  certificationsList: string[];
  toolsPlatforms: string[];
  experience: string;
  education: string;
  timezoneRequirements: string;
  responsibilities: string;
  additionalRequirements: string;

  // Step 4 — Compensation
  currency: string;
  budgetMin: string;
  budgetMax: string;
  compensation: string; // free-text notes

  // Step 5 — Search Criteria
  targetTitles: string[];
  titleMatchTiming: "" | "current" | "previous" | "either";
  targetCompanyTypes: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  disqualifiers: string[];
  interviewProcess: string;
  additionalContext: string;

  // Step 6 — Submit
  password: string;
  passwordConfirm: string;
  consent: boolean;
};

const EMPTY: FormState = {
  roleTitle: "",
  employmentType: "",
  workModel: "",
  seniority: "",
  headcount: "1",
  jobDescription: "",
  openWorldwide: false,
  targetCountries: [],
  statesRegions: [],
  metroAreas: [],
  searchRadius: "",
  hiringUrgency: "",
  targetStartDate: "",
  timeToHire: "",
  department: "",
  location: "",

  companyName: "",
  companyWebsite: "",
  companySize: "",
  headquarters: "",
  hireFromCountries: [],
  firstName: "",
  lastName: "",
  currentTitle: "",
  workEmail: "",
  phone: "",
  employerValueProposition: "",

  mustHaveSkills: [],
  niceToHaveSkills: [],
  certificationsList: [],
  toolsPlatforms: [],
  experience: "",
  education: "",
  timezoneRequirements: "",
  responsibilities: "",
  additionalRequirements: "",

  currency: "USD",
  budgetMin: "",
  budgetMax: "",
  compensation: "",

  targetTitles: [],
  titleMatchTiming: "",
  targetCompanyTypes: [],
  includeKeywords: [],
  excludeKeywords: [],
  disqualifiers: [],
  interviewProcess: "",
  additionalContext: "",

  password: "",
  passwordConfirm: "",
  consent: false,
};

const STEPS = [
  { id: 1, label: "Organization & Contact" },
  { id: 2, label: "Role & Objective" },
  { id: 3, label: "Location & Work Model" },
  { id: 4, label: "Requirements & Priorities" },
  { id: 5, label: "Process & Timeline" },
  { id: 6, label: "Review & Submit" },
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
    if (!s.companyName.trim()) e.companyName = "Organization name is required";
    if (!s.companyWebsite.trim()) e.companyWebsite = "Company website is required";
    if (!s.companySize) e.companySize = "Select company size";
    if (!s.headquarters.trim()) e.headquarters = "Headquarters is required";
    if (s.hireFromCountries.length === 0) e.hireFromCountries = "Add at least one country you can hire from";
    if (!s.firstName.trim()) e.firstName = "First name is required";
    if (!s.lastName.trim()) e.lastName = "Last name is required";
    if (!emailIsValid(s.workEmail)) e.workEmail = "Enter a valid work email";
  }
  if (step === 2) {
    if (!s.roleTitle.trim()) e.roleTitle = "Role title is required";
    if (!s.employmentType) e.employmentType = "Select an employment type";
    if (!s.seniority.trim()) e.seniority = "Select a seniority level";
    const n = Number(s.headcount);
    if (!s.headcount || !Number.isFinite(n) || n < 1) e.headcount = "At least 1 position required";
  }
  if (step === 3) {
    if (!s.workModel) e.workModel = "Select a work arrangement";
    if (!s.openWorldwide && s.targetCountries.length === 0) {
      e.targetCountries = "Add at least one country, or mark the role as open worldwide";
    }
  }
  if (step === 4) {
    const skills = uniqueLower(s.mustHaveSkills);
    const desc = s.jobDescription.trim();
    if (skills.length < 3 && desc.length < 40) {
      e.mustHaveSkills =
        "Provide at least 3 must-have skills or a job description of at least 40 characters";
    }
  }
  if (step === 5) {
    if (s.targetTitles.length === 0) e.targetTitles = "Add at least one target job title";
  }
  if (step === 6) {
    if (!s.password || s.password.length < 8) e.password = "Choose a password with at least 8 characters";
    if (s.password !== s.passwordConfirm) e.passwordConfirm = "Passwords do not match";
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
  const idemRef = useRef<string>("");
  const firstErrRef = useRef<HTMLElement | null>(null);

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
    if (Object.keys(stepErrs).length === 0) setStep((n) => Math.min(6, n + 1));
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
    const allErrs = {
      ...validateStep(1, state),
      ...validateStep(2, state),
      ...validateStep(3, state),
      ...validateStep(5, state),
      ...validateStep(6, state),
    };
    setErrors(allErrs);
    if (Object.keys(allErrs).length > 0) {
      const firstKey = Object.keys(allErrs)[0];
      if (["roleTitle", "workModel", "employmentType", "seniority", "headcount"].includes(firstKey)) setStep(1);
      else if (["firstName", "lastName", "workEmail", "companyName", "companyWebsite", "companySize", "headquarters", "hireFromCountries"].includes(firstKey)) setStep(2);
      else if (["mustHaveSkills"].includes(firstKey)) setStep(3);
      else if (["targetTitles"].includes(firstKey)) setStep(5);
      else if (["password", "passwordConfirm", "consent"].includes(firstKey)) setStep(6);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        idempotencyKey: idemRef.current || crypto.randomUUID(),
        // Contact
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        currentTitle: state.currentTitle.trim(),
        workEmail: state.workEmail.trim().toLowerCase(),
        phone: state.phone.trim(),
        // Organization
        companyName: state.companyName.trim(),
        companyWebsite: state.companyWebsite.trim(),
        companySize: state.companySize,
        headquarters: state.headquarters.trim(),
        hireFromCountries: uniqueLower(state.hireFromCountries),
        employerValueProposition: state.employerValueProposition.trim(),
        // Role
        roleTitle: state.roleTitle.trim(),
        department: state.department.trim(),
        location: state.location.trim(),
        workModel: state.workModel,
        employmentType: state.employmentType || "",
        seniority: state.seniority.trim(),
        headcount: state.headcount ? Number(state.headcount) : null,
        jobDescription: state.jobDescription.trim(),
        // Geography
        openWorldwide: state.openWorldwide,
        targetCountries: uniqueLower(state.targetCountries),
        statesRegions: uniqueLower(state.statesRegions),
        metroAreas: uniqueLower(state.metroAreas),
        searchRadius: state.searchRadius.trim(),
        // Timeline
        hiringUrgency: state.hiringUrgency.trim(),
        targetStartDate: state.targetStartDate.trim(),
        timeToHire: state.timeToHire.trim(),
        // Candidate profile
        mustHaveSkills: uniqueLower(state.mustHaveSkills),
        niceToHaveSkills: uniqueLower(state.niceToHaveSkills),
        certificationsList: uniqueLower(state.certificationsList),
        toolsPlatforms: uniqueLower(state.toolsPlatforms),
        experience: state.experience.trim(),
        education: state.education.trim(),
        timezoneRequirements: state.timezoneRequirements.trim(),
        responsibilities: state.responsibilities.trim(),
        additionalRequirements: state.additionalRequirements.trim(),
        // Compensation
        currency: state.currency,
        budgetMin: state.budgetMin ? Number(state.budgetMin) : null,
        budgetMax: state.budgetMax ? Number(state.budgetMax) : null,
        compensation: state.compensation.trim(),
        // Search
        targetTitles: uniqueLower(state.targetTitles),
        titleMatchTiming: state.titleMatchTiming || "",
        targetCompanyTypes: state.targetCompanyTypes,
        includeKeywords: uniqueLower(state.includeKeywords),
        excludeKeywords: uniqueLower(state.excludeKeywords),
        disqualifiers: state.disqualifiers,
        interviewProcess: state.interviewProcess.trim(),
        additionalContext: state.additionalContext.trim(),
        // Consent
        consent: state.consent,
        password: state.password,
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

  const toggleDisqualifier = (opt: string) => {
    set(
      "disqualifiers",
      state.disqualifiers.includes(opt)
        ? state.disqualifiers.filter((d) => d !== opt)
        : [...state.disqualifiers, opt],
    );
  };
  const toggleCompanyType = (opt: string) => {
    set(
      "targetCompanyTypes",
      state.targetCompanyTypes.includes(opt)
        ? state.targetCompanyTypes.filter((d) => d !== opt)
        : [...state.targetCompanyTypes, opt],
    );
  };

  return (
    <FormShell
      exitTo="/"
      exitLabel="Exit"
      progress={{ step, total: STEPS.length, label: `Step ${step} of ${STEPS.length}` }}
      width="lg"
      eyebrow="Employer intake"
      title="Start a hiring engagement"
      description="Tell us who you need to hire. TaaSFlow returns evidence-scored shortlists — with a first ranked shortlist within 14 days. No account required. Your progress is saved as you go."
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
        <CardContent className="space-y-6">
          {/* ================= STEP 2: ROLE & OBJECTIVE ================= */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Role Title" error={errors.roleTitle} required className="sm:col-span-2">
                  <Input
                    data-field="roleTitle"
                    value={state.roleTitle}
                    onChange={(e) => set("roleTitle", e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                  />
                </Field>
                <Field label="Employment Type" error={errors.employmentType} required>
                  <Select
                    value={state.employmentType}
                    onValueChange={(v) => set("employmentType", v as FormState["employmentType"])}
                  >
                    <SelectTrigger data-field="employmentType">
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
                    onChange={(e) => set("headcount", e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Job Description"
                hint="Paste the JD or write it here. We use this to enrich matching."
              >
                <Textarea
                  rows={6}
                  value={state.jobDescription}
                  onChange={(e) => set("jobDescription", e.target.value)}
                  placeholder="Paste the full job description or describe the role, responsibilities, and success criteria."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.jobDescription.trim().length} characters
                </p>
              </Field>
            </div>
          )}

          {/* ================= STEP 3: LOCATION & WORK MODEL ================= */}
          {step === 3 && (
            <div className="space-y-6">
              <Field label="Work Arrangement" error={errors.workModel} required>
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

              <SectionHeader
                title="Geographic Requirements"
                subtitle="Where the role can be based."
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.openWorldwide}
                  onCheckedChange={(v) => set("openWorldwide", Boolean(v))}
                />
                <span>Open worldwide (fully remote — anywhere)</span>
              </label>
              {!state.openWorldwide && (
                <div className="space-y-4">
                  <ChipInput
                    label="Target Countries"
                    hint="Countries where the role can be based."
                    error={errors.targetCountries}
                    values={state.targetCountries}
                    onChange={(v) => set("targetCountries", v)}
                    required
                    dataField="targetCountries"
                    placeholder="e.g. United States, Portugal, Germany"
                  />
                  <ChipInput
                    label="States / Regions"
                    values={state.statesRegions}
                    onChange={(v) => set("statesRegions", v)}
                    placeholder="e.g. California, Bavaria, Ontario"
                  />
                  <ChipInput
                    label="Metro Areas"
                    values={state.metroAreas}
                    onChange={(v) => set("metroAreas", v)}
                    placeholder="e.g. San Francisco Bay Area, Berlin, Lisbon"
                  />
                  <Field label="Search Radius" hint="Optional. e.g. 25 miles, 50 km">
                    <Input
                      value={state.searchRadius}
                      onChange={(e) => set("searchRadius", e.target.value)}
                      placeholder="25 miles"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 5: PROCESS & TIMELINE ================= */}
          {step === 5 && (
            <div className="space-y-6">
              <SectionHeader title="Timeline & Availability" subtitle="Optional." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Hiring Timeline">
                  <Select value={state.hiringUrgency} onValueChange={(v) => set("hiringUrgency", v)}>
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
                    value={state.targetStartDate}
                    onChange={(e) => set("targetStartDate", e.target.value)}
                  />
                </Field>
                <Field label="Time to Hire" hint="How fast do you need to close?">
                  <Input
                    value={state.timeToHire}
                    onChange={(e) => set("timeToHire", e.target.value)}
                    placeholder="e.g. 4 weeks"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ================= STEP 1: ORGANIZATION & CONTACT ================= */}
          {step === 1 && (
            <div className="space-y-6">
              <SectionHeader title="Organization" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Organization Name" error={errors.companyName} required>
                  <Input
                    data-field="companyName"
                    value={state.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    autoComplete="organization"
                  />
                </Field>
                <Field label="Company Website" error={errors.companyWebsite} required>
                  <Input
                    data-field="companyWebsite"
                    value={state.companyWebsite}
                    onChange={(e) => set("companyWebsite", e.target.value)}
                    placeholder="https://"
                  />
                </Field>
                <Field label="Company Size" error={errors.companySize} required>
                  <Select value={state.companySize} onValueChange={(v) => set("companySize", v)}>
                    <SelectTrigger data-field="companySize">
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
                <Field label="Headquarters" error={errors.headquarters} required>
                  <Input
                    data-field="headquarters"
                    value={state.headquarters}
                    onChange={(e) => set("headquarters", e.target.value)}
                    placeholder="City, Country"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <ChipInput
                    label="Countries you can hire from"
                    hint="Where you have legal entities or can employ candidates."
                    error={errors.hireFromCountries}
                    values={state.hireFromCountries}
                    onChange={(v) => set("hireFromCountries", v)}
                    required
                    placeholder="e.g. United States, Portugal"
                    dataField="hireFromCountries"
                  />
                </div>
                <Field label="Employer Value Proposition" className="sm:col-span-2" hint="Why do candidates want to work with you? Mission, culture, perks.">
                  <Textarea
                    rows={3}
                    value={state.employerValueProposition}
                    onChange={(e) => set("employerValueProposition", e.target.value)}
                    placeholder="Our mission is… We offer… Our team…"
                  />
                </Field>
              </div>

              <SectionHeader title="Primary Hiring Contact" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First Name" error={errors.firstName} required>
                  <Input
                    data-field="firstName"
                    value={state.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last Name" error={errors.lastName} required>
                  <Input
                    data-field="lastName"
                    value={state.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    autoComplete="family-name"
                  />
                </Field>
                <Field label="Current title" hint="Your role at the company.">
                  <Input
                    value={state.currentTitle}
                    onChange={(e) => set("currentTitle", e.target.value)}
                    placeholder="Head of Talent, VP People, CEO…"
                  />
                </Field>
                <Field label="Work Email" error={errors.workEmail} required>
                  <Input
                    data-field="workEmail"
                    type="email"
                    value={state.workEmail}
                    onChange={(e) => set("workEmail", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <Field label="Direct Phone" hint="Optional. Best number to reach you." className="sm:col-span-2">
                  <Input
                    type="tel"
                    value={state.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                    placeholder="+1 555 123 4567"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ================= STEP 3: CANDIDATE PROFILE ================= */}
          {step === 3 && (
            <div className="space-y-6">
              <ChipInput
                label="Must-have skills"
                hint="Add at least 3 or provide a job description of at least 40 characters on Step 1."
                error={errors.mustHaveSkills}
                values={state.mustHaveSkills}
                onChange={(v) => set("mustHaveSkills", v)}
                placeholder="Type a skill and press Enter"
                dataField="mustHaveSkills"
              />
              <ChipInput
                label="Nice-to-have skills"
                hint="Bonus skills that strengthen a candidate."
                values={state.niceToHaveSkills}
                onChange={(v) => set("niceToHaveSkills", v)}
                placeholder="e.g. GraphQL, Terraform"
              />
              <ChipInput
                label="Required Certifications"
                values={state.certificationsList}
                onChange={(v) => set("certificationsList", v)}
                placeholder="e.g. AWS SA, PMP, CFA"
              />
              <ChipInput
                label="Required Tools & Platforms"
                values={state.toolsPlatforms}
                onChange={(v) => set("toolsPlatforms", v)}
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
                    value={state.timezoneRequirements}
                    onChange={(e) => set("timezoneRequirements", e.target.value)}
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
              <Field label="Additional Requirements" hint="Anything else the candidate must have.">
                <Textarea
                  rows={3}
                  value={state.additionalRequirements}
                  onChange={(e) => set("additionalRequirements", e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* ================= STEP 4: COMPENSATION ================= */}
          {step === 4 && (
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
                    value={state.budgetMin}
                    onChange={(e) => set("budgetMin", e.target.value)}
                    placeholder="80000"
                  />
                </Field>
                <Field label="Maximum">
                  <Input
                    type="number"
                    min={0}
                    value={state.budgetMax}
                    onChange={(e) => set("budgetMax", e.target.value)}
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

          {/* ================= STEP 5: SEARCH CRITERIA ================= */}
          {step === 5 && (
            <div className="space-y-6">
              <ChipInput
                label="Target Job Titles"
                hint="Titles to source from (current or previous roles)."
                error={errors.targetTitles}
                values={state.targetTitles}
                onChange={(v) => set("targetTitles", v)}
                placeholder="e.g. Senior Software Engineer, Staff Engineer"
                required
                dataField="targetTitles"
              />
              <Field label="Title Match Timing" hint="Should the target title be their current, previous, or either role?">
                <Select
                  value={state.titleMatchTiming}
                  onValueChange={(v) => set("titleMatchTiming", v as FormState["titleMatchTiming"])}
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
                        checked={state.targetCompanyTypes.includes(opt)}
                        onCheckedChange={() => toggleCompanyType(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <ChipInput
                label="Include Keywords"
                hint="Boost candidates whose profiles contain these terms."
                values={state.includeKeywords}
                onChange={(v) => set("includeKeywords", v)}
                placeholder="e.g. Kubernetes, distributed systems"
              />
              <ChipInput
                label="Exclude Keywords"
                hint="Filter out candidates whose profiles contain these terms."
                values={state.excludeKeywords}
                onChange={(v) => set("excludeKeywords", v)}
                placeholder="e.g. bootcamp only, agency"
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
                        checked={state.disqualifiers.includes(opt)}
                        onCheckedChange={() => toggleDisqualifier(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="Interview Process" hint="Number of rounds, format, panel.">
                <Textarea
                  rows={3}
                  value={state.interviewProcess}
                  onChange={(e) => set("interviewProcess", e.target.value)}
                  placeholder="Screen → Technical → Panel → Offer"
                />
              </Field>
              <Field label="Additional Context" hint="Anything else we should know?">
                <Textarea
                  rows={3}
                  value={state.additionalContext}
                  onChange={(e) => set("additionalContext", e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* ================= STEP 6: REVIEW & SUBMIT ================= */}
          {step === 6 && (
            <div className="space-y-4 text-sm">
              <ReviewBlock title="Role">
                <div>
                  {state.roleTitle || "—"} · {state.workModel || "—"} · {state.employmentType || "—"}
                </div>
                <div className="text-muted-foreground">
                  {state.seniority || "—"} · Positions: {state.headcount || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Geography">
                <div>
                  {state.openWorldwide
                    ? "Open worldwide"
                    : state.targetCountries.join(", ") || "—"}
                </div>
                {state.metroAreas.length > 0 && (
                  <div className="text-muted-foreground">Metros: {state.metroAreas.join(", ")}</div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Contact">
                <div>
                  {state.firstName} {state.lastName}
                  {state.currentTitle ? ` · ${state.currentTitle}` : ""} · {state.workEmail}
                </div>
                <div className="text-muted-foreground">
                  {state.companyName}
                  {state.companyWebsite ? ` · ${state.companyWebsite}` : ""} · {state.companySize || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Candidate profile">
                <div>Must-have: {state.mustHaveSkills.join(", ") || "—"}</div>
                <div>Nice-to-have: {state.niceToHaveSkills.join(", ") || "—"}</div>
                <div className="text-muted-foreground">
                  Experience: {state.experience || "—"} · Education: {state.education || "—"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Compensation">
                <div>
                  {state.budgetMin || "—"}
                  {state.budgetMax ? ` – ${state.budgetMax}` : ""} {state.currency}
                </div>
                {state.compensation && (
                  <div className="text-muted-foreground">{state.compensation}</div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Search criteria">
                <div>Titles: {state.targetTitles.join(", ") || "—"}</div>
                {state.disqualifiers.length > 0 && (
                  <div className="text-muted-foreground">
                    Disqualifiers: {state.disqualifiers.join(", ")}
                  </div>
                )}
              </ReviewBlock>

              <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-medium">Create your client account</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    We'll set up your workspace at{" "}
                    <span className="font-medium text-foreground">
                      {state.workEmail || "your work email"}
                    </span>
                    . Choose a password to sign in and track your shortlist.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Password" error={errors.password} required>
                    <Input
                      data-field="password"
                      type="password"
                      autoComplete="new-password"
                      value={state.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </Field>
                  <Field label="Confirm password" error={errors.passwordConfirm} required>
                    <Input
                      data-field="passwordConfirm"
                      type="password"
                      autoComplete="new-password"
                      value={state.passwordConfirm}
                      onChange={(e) => set("passwordConfirm", e.target.value)}
                      placeholder="Repeat password"
                    />
                  </Field>
                </div>
              </div>

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
          {step < 6 ? (
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
    </FormShell>
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
