import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { intakeSchema, DRAFT_KEY, IDEMPOTENCY_KEY, type IntakeInput } from "@/lib/intake-schema";
import { submitIntake } from "@/lib/intake.functions";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start hiring with TaaSFlow — Client intake" },
      {
        name: "description",
        content:
          "Tell us about the role you need to fill. Five short steps, no payment, save your draft anytime.",
      },
      { property: "og:title", content: "Start hiring with TaaSFlow" },
      { property: "og:description", content: "Client intake — 5 short steps to kick off your search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

const emptyDraft: Partial<IntakeInput> = {
  firstName: "",
  lastName: "",
  workEmail: "",
  companyName: "",
  roleTitle: "",
  workModel: "remote",
  location: "",
  employmentType: "",
  seniority: "",
  mustHaveSkills: [],
  jobDescription: "",
  preferredRequirements: "",
  dealbreakers: "",
  targetCountries: [],
  compensation: "",
  headcount: undefined as unknown as number,
  hiringUrgency: "",
  targetTitles: [],
  workAuthorization: "",
  consent: false as unknown as true,
};

const steps = [
  "Contact & company",
  "Role overview",
  "Requirements",
  "Hiring context",
  "Review & submit",
] as const;

function IntakePage() {
  const navigate = useNavigate();
  const submit = useServerFn(submitIntake);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<IntakeInput>>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...emptyDraft, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // Autosave
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const set = <K extends keyof IntakeInput>(k: K, v: IntakeInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const validateAll = () => {
    const parsed = intakeSchema.safeParse({
      ...draft,
      headcount:
        draft.headcount === undefined || (draft.headcount as unknown as string) === ""
          ? NaN
          : Number(draft.headcount),
    });
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const flat: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!flat[key]) flat[key] = issue.message;
    }
    setErrors(flat);
    return null;
  };

  const stepFieldsMap: string[][] = [
    ["firstName", "lastName", "workEmail", "companyName"],
    ["roleTitle", "workModel"],
    ["mustHaveSkills"],
    [],
    ["consent"],
  ];

  const validateStep = () => {
    const parsed = intakeSchema.safeParse({
      ...draft,
      headcount:
        draft.headcount === undefined || (draft.headcount as unknown as string) === ""
          ? NaN
          : Number(draft.headcount),
    });
    const flat: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!flat[key]) flat[key] = issue.message;
      }
    }
    const fields = stepFieldsMap[step];
    const stepErrors: Record<string, string> = {};
    for (const f of fields) if (flat[f]) stepErrors[f] = flat[f];
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const doSubmit = async () => {
    const parsed = validateAll();
    if (!parsed) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    // Idempotency: persist a key so refresh + retry hit the same submission
    let idem = "";
    try {
      idem = localStorage.getItem(IDEMPOTENCY_KEY) ?? "";
    } catch {}
    if (!idem) {
      idem = crypto.randomUUID();
      try {
        localStorage.setItem(IDEMPOTENCY_KEY, idem);
      } catch {}
    }
    try {
      const res = await submit({ data: { idempotencyKey: idem, payload: parsed } });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      navigate({
        to: "/intake/confirmation",
        search: {
          intake: res.intakeId,
          position: res.positionId,
          trace: res.traceId,
          status: res.status,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(IDEMPOTENCY_KEY);
    } catch {}
    setDraft(emptyDraft);
    setStep(0);
    toast.success("Draft cleared");
  };

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:underline">
            ← Home
          </Link>
          <a
            href="mailto:hello@taasflow.example"
            className="text-sm text-muted-foreground hover:underline"
          >
            Talk to TaaSFlow
          </a>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              Step {step + 1} of {steps.length}: {steps[step]}
            </span>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear progress
            </button>
          </div>
          <Progress value={progress} />
        </div>

        <Card className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="First name" error={errors.firstName} required>
                <Input
                  value={draft.firstName ?? ""}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last name" error={errors.lastName} required>
                <Input
                  value={draft.lastName ?? ""}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </Field>
              <Field label="Work email" error={errors.workEmail} required>
                <Input
                  type="email"
                  value={draft.workEmail ?? ""}
                  onChange={(e) => set("workEmail", e.target.value)}
                />
              </Field>
              <Field label="Company name" error={errors.companyName} required>
                <Input
                  value={draft.companyName ?? ""}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label="Role title" error={errors.roleTitle} required>
                <Input
                  value={draft.roleTitle ?? ""}
                  onChange={(e) => set("roleTitle", e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                />
              </Field>
              <Field label="Work model" error={errors.workModel} required>
                <Select
                  value={draft.workModel}
                  onValueChange={(v) => set("workModel", v as IntakeInput["workModel"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location">
                <Input
                  value={draft.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="City, country (optional)"
                />
              </Field>
              <Field label="Employment type">
                <Input
                  value={draft.employmentType ?? ""}
                  onChange={(e) => set("employmentType", e.target.value)}
                  placeholder="Full-time, contract, ... (optional)"
                />
              </Field>
              <Field label="Seniority">
                <Input
                  value={draft.seniority ?? ""}
                  onChange={(e) => set("seniority", e.target.value)}
                  placeholder="Mid, Senior, Staff, ... (optional)"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Must-have skills (add at least 3, or provide a job description below)"
                error={errors.mustHaveSkills}
              >
                <TagInput
                  value={draft.mustHaveSkills ?? []}
                  onChange={(v) => set("mustHaveSkills", v)}
                  placeholder="Type a skill and press Enter"
                />
              </Field>
              <Field label="Job description (40+ chars if fewer than 3 skills)">
                <Textarea
                  rows={5}
                  value={draft.jobDescription ?? ""}
                  onChange={(e) => set("jobDescription", e.target.value)}
                />
              </Field>
              <Field label="Preferred requirements">
                <Textarea
                  rows={3}
                  value={draft.preferredRequirements ?? ""}
                  onChange={(e) => set("preferredRequirements", e.target.value)}
                />
              </Field>
              <Field label="Dealbreakers">
                <Textarea
                  rows={2}
                  value={draft.dealbreakers ?? ""}
                  onChange={(e) => set("dealbreakers", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field label="Target countries">
                <TagInput
                  value={draft.targetCountries ?? []}
                  onChange={(v) => set("targetCountries", v)}
                  placeholder="e.g. Portugal"
                />
              </Field>
              <Field label="Compensation range">
                <Input
                  value={draft.compensation ?? ""}
                  onChange={(e) => set("compensation", e.target.value)}
                  placeholder="e.g. €60k–80k base"
                />
              </Field>
              <Field label="Headcount">
                <Input
                  type="number"
                  min={1}
                  value={draft.headcount ?? ""}
                  onChange={(e) =>
                    set("headcount", e.target.value === "" ? (undefined as any) : Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Hiring urgency">
                <Input
                  value={draft.hiringUrgency ?? ""}
                  onChange={(e) => set("hiringUrgency", e.target.value)}
                  placeholder="e.g. Start next month"
                />
              </Field>
              <Field label="Target titles (nice-to-have)">
                <TagInput
                  value={draft.targetTitles ?? []}
                  onChange={(v) => set("targetTitles", v)}
                  placeholder="e.g. Staff Engineer"
                />
              </Field>
              <Field label="Work authorization">
                <Input
                  value={draft.workAuthorization ?? ""}
                  onChange={(e) => set("workAuthorization", e.target.value)}
                  placeholder="Any restrictions?"
                />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <ReviewList draft={draft} />
              <div className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  id="consent"
                  checked={draft.consent === true}
                  onCheckedChange={(v) => set("consent", v === true ? (true as any) : (false as any))}
                />
                <Label htmlFor="consent" className="text-sm leading-snug">
                  I confirm the information above is accurate and consent to TaaSFlow contacting me
                  about this role.
                </Label>
              </div>
              {errors.consent && <p className="text-sm text-destructive">{errors.consent}</p>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={prev} disabled={step === 0 || submitting}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Draft saved automatically</span>
              {step < steps.length - 1 ? (
                <Button onClick={next} disabled={submitting}>
                  Next
                </Button>
              ) : (
                <Button onClick={doSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit intake"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (value.includes(t)) return setText("");
    onChange([...value, t]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
      />
    </div>
  );
}

function ReviewList({ draft }: { draft: Partial<IntakeInput> }) {
  const items: [string, string | number | undefined][] = [
    ["Name", `${draft.firstName ?? ""} ${draft.lastName ?? ""}`.trim()],
    ["Work email", draft.workEmail],
    ["Company", draft.companyName],
    ["Role", draft.roleTitle],
    ["Work model", draft.workModel],
    ["Location", draft.location],
    ["Must-have skills", (draft.mustHaveSkills ?? []).join(", ")],
    ["Job description", (draft.jobDescription ?? "").slice(0, 200)],
    ["Target countries", (draft.targetCountries ?? []).join(", ")],
    ["Compensation", draft.compensation],
    ["Headcount", draft.headcount],
    ["Urgency", draft.hiringUrgency],
  ];
  return (
    <dl className="divide-y rounded-md border">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-2 p-3 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="col-span-2 font-medium break-words">{v || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
