import { createFileRoute, Link, redirect, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicPosition } from "@/lib/jobs.functions";
import { extractJobUuid } from "@/lib/marketing/job-slug";
import { submitApplication } from "@/lib/apply.functions";
import {
  ALLOWED_CV_EXT,
  APPLY_DRAFT_KEY,
  APPLY_IDEMPOTENCY_KEY,
  MAX_CV_BYTES,
  applySchema,
  fileExt,
} from "@/lib/apply-schema";
import { CV_MESSAGES } from "@/lib/cv-validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FormShell } from "@/components/marketing/form-shell";

export const Route = createFileRoute("/jobs/$id/apply")({
  loader: async ({ context, params }) => {
    const uuid = extractJobUuid(params.id);
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["public-position", uuid],
      queryFn: () => getPublicPosition({ data: { id: uuid } }),
    });
    if (!data) throw notFound();
    // Paused roles keep a readable listing but must not accept applications.
    if (!data.accepting_applications) {
      throw redirect({ to: "/jobs/$id", params: { id: params.id } });
    }
    return data;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `Apply — ${loaderData.title}` : "Apply — TaaSFlow";
    return {
      meta: [
        { title: `${t} · TaaSFlow` },
        { name: "robots", content: "noindex" },
        { name: "description", content: "Submit your application in a few minutes." },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h1 className="text-2xl font-semibold">This role is no longer accepting applications.</h1>
      <div className="mt-6">
        <Button asChild><Link to="/jobs">Browse open roles</Link></Button>
      </div>
    </div>
  ),
  component: ApplyPage,
});

type AnswerValue = string | boolean | number | null;

const STEP_LABELS = [
  "Your details",
  "CV upload",
  "Screening",
  "Consent & review",
  "Submit",
] as const;

function ApplyPage() {
  const { id: rawId } = Route.useParams();
  const id = extractJobUuid(rawId);
  const navigate = useNavigate();
  const { data: pos } = useSuspenseQuery({
    queryKey: ["public-position", id],
    queryFn: () => getPublicPosition({ data: { id } }),
  });

  const draftKey = APPLY_DRAFT_KEY(id);
  const idemKey = APPLY_IDEMPOTENCY_KEY(id);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [consent, setConsent] = useState(false);
  const [network, setNetwork] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; trace_id?: string } | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  // Restore text draft (never the CV).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.form) setForm(d.form);
        if (d.answers) setAnswers(d.answers);
        if (typeof d.network === "boolean") setNetwork(d.network);
      }
    } catch { /* ignore */ }
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, answers, network }));
    } catch { /* ignore */ }
  }, [draftKey, form, answers, network]);

  const readFileAsBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result ?? "");
        resolve(s.includes(",") ? s.split(",", 2)[1] : s);
      };
      r.onerror = () => reject(new Error("read_failed"));
      r.readAsDataURL(f);
    });

  const validateFile = (f: File): string | null => {
    if (f.size === 0) return CV_MESSAGES.empty;
    if (f.size > MAX_CV_BYTES) return CV_MESSAGES.too_large;
    if (!ALLOWED_CV_EXT.has(fileExt(f.name))) return CV_MESSAGES.bad_extension;
    return null;
  };

  const onFile = (f: File | null) => {
    setCvError(null);
    setCvFile(null);
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setCvError(err);
      return;
    }
    setCvFile(f);
  };

  const setAnswer = (qid: string, v: AnswerValue) =>
    setAnswers((a) => ({ ...a, [qid]: v }));

  const getOrCreateIdempotencyKey = useCallback(() => {
    try {
      const existing = localStorage.getItem(idemKey);
      if (existing) return existing;
      const k = crypto.randomUUID();
      localStorage.setItem(idemKey, k);
      return k;
    } catch {
      return crypto.randomUUID();
    }
  }, [idemKey]);

  // Per-step validation used to gate Continue.
  const stepIssues = (n: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (n === 1) {
      if (!form.full_name.trim() || form.full_name.trim().length < 2)
        errs.full_name = "Enter your full name";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
        errs.email = "Enter a valid email";
    }
    if (n === 2) {
      if (!cvFile) errs.cv = "Attach your CV to continue";
      if (cvError) errs.cv = cvError;
    }
    if (n === 3) {
      pos!.questions.forEach((q) => {
        if (!q.required) return;
        const v = answers[q.id];
        const empty =
          v == null ||
          (typeof v === "string" && v.trim() === "") ||
          (Array.isArray(v) && v.length === 0);
        if (empty) errs[`q:${q.id}`] = "This question is required";
      });
    }
    if (n === 4) {
      if (!consent) errs.consent_terms = "You must accept the terms to continue";
    }
    return errs;
  };

  const goNext = () => {
    const errs = stepIssues(step);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => {
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  };

  const onSubmit = async () => {
    if (submittingRef.current) return;
    setServerError(null);
    // Final aggregate validation across all steps.
    const allErrs = { ...stepIssues(1), ...stepIssues(2), ...stepIssues(3), ...stepIssues(4) };
    setFieldErrors(allErrs);
    if (Object.keys(allErrs).length > 0) {
      // Jump to earliest failing step.
      if (allErrs.full_name || allErrs.email) setStep(1);
      else if (allErrs.cv) setStep(2);
      else if (Object.keys(allErrs).some((k) => k.startsWith("q:"))) setStep(3);
      else if (allErrs.consent_terms) setStep(4);
      return;
    }
    if (!cvFile) {
      setStep(2);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const base64 = await readFileAsBase64(cvFile);
      const payload = {
        position_id: id,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        location: form.location,
        cv: {
          filename: cvFile.name,
          mime: cvFile.type || "application/octet-stream",
          base64,
        },
        answers: pos!.questions.map((q) => ({
          question_id: q.id,
          value: answers[q.id] ?? null,
        })),
        consent_terms: consent as true,
        network_opt_in: network,
        idempotency_key: getOrCreateIdempotencyKey(),
      };

      const parsed = applySchema.safeParse(payload);
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          fe[i.path.join(".") || "form"] = i.message;
        });
        setFieldErrors(fe);
        setSubmitting(false);
        submittingRef.current = false;
        return;
      }

      const result = await submitApplication({ data: parsed.data });
      if (!result.ok) {
        setServerError({ message: result.message, trace_id: result.trace_id });
        setSubmitting(false);
        submittingRef.current = false;
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      await navigate({
        to: "/apply/received/$applicationId",
        params: { applicationId: result.application_id },
        replace: true,
      });
    } catch (err) {
      console.error(err);
      setServerError({ message: "Network error — please try again." });
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (!pos) return null;

  return (
    <FormShell
      exitTo={`/jobs/${id}`}
      exitLabel="← Role details"
      progress={{ step, total: STEP_LABELS.length, label: `Step ${step} of ${STEP_LABELS.length}` }}
      width="md"
    >
      <div className="text-sm text-[color:var(--brand-navy)]/60">{pos.organization_name}</div>
        <div className="text-sm text-muted-foreground">{pos.organization_name}</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
          Apply — {pos.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Takes about 3 minutes. Your progress is saved as you type.
        </p>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
            />
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <li
                  key={label}
                  className={
                    active
                      ? "font-medium text-foreground"
                      : done
                        ? "text-foreground/70"
                        : "text-muted-foreground"
                  }
                >
                  {n}. {label}
                </li>
              );
            })}
          </ol>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mt-6" data-testid="apply-server-error">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {serverError.message}
              {serverError.trace_id && (
                <span className="block mt-1 text-xs opacity-70">
                  Reference: {serverError.trace_id}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-8 rounded-lg border bg-card p-5 md:p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Your details</h2>
                <p className="text-sm text-muted-foreground">
                  We'll use this to reach out about the role.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full name *</Label>
                  <Input
                    id="full_name"
                    autoComplete="name"
                    data-field="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                  {fieldErrors.full_name && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.full_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    data-field="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    data-field="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Optional.</p>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    autoComplete="address-level2"
                    data-field="location"
                    placeholder="City, Country"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Optional.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Upload your CV</h2>
                <p className="text-sm text-muted-foreground">
                  PDF, DOC, or DOCX up to 10 MB. Unicode filenames welcome.
                </p>
              </div>
              <div>
                <Label htmlFor="cv">CV file *</Label>
                <Input
                  id="cv"
                  type="file"
                  data-field="cv"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                {cvError ? (
                  <p className="mt-1 text-xs text-destructive">{cvError}</p>
                ) : fieldErrors.cv ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.cv}</p>
                ) : null}
                {cvFile && !cvError && (
                  <p className="mt-2 text-sm text-foreground/80">
                    ✓ Attached: <span className="font-medium">{cvFile.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({Math.ceil(cvFile.size / 1024)} KB)
                    </span>
                  </p>
                )}
                <ul className="mt-3 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  <li>Accepted formats: .pdf, .doc, .docx</li>
                  <li>Max size: 10 MB</li>
                  <li>We store your CV securely; only the hiring team can access it.</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Screening questions</h2>
                <p className="text-sm text-muted-foreground">
                  {pos.questions.length === 0
                    ? "No screening questions for this role — you're all set."
                    : `${pos.questions.length} short ${
                        pos.questions.length === 1 ? "question" : "questions"
                      } from the hiring team.`}
                </p>
              </div>
              {pos.questions.length > 0 && (
                <div className="space-y-5">
                  {pos.questions.map((q) => {
                    const err = fieldErrors[`q:${q.id}`];
                    const val = answers[q.id];
                    return (
                      <div key={q.id}>
                        <Label htmlFor={q.id}>
                          {q.question}
                          {q.required && " *"}
                        </Label>
                        {q.answer_type === "long_text" ? (
                          <Textarea
                            id={q.id}
                            value={(val as string) ?? ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            rows={4}
                          />
                        ) : q.answer_type === "boolean" ? (
                          <RadioGroup
                            id={q.id}
                            value={val === true ? "yes" : val === false ? "no" : ""}
                            onValueChange={(v) => setAnswer(q.id, v === "yes")}
                            className="flex gap-4 mt-1"
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="yes" id={`${q.id}-y`} /> Yes
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="no" id={`${q.id}-n`} /> No
                            </label>
                          </RadioGroup>
                        ) : q.answer_type === "number" ? (
                          <Input
                            id={q.id}
                            type="number"
                            inputMode="decimal"
                            value={val == null ? "" : String(val)}
                            onChange={(e) =>
                              setAnswer(
                                q.id,
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                          />
                        ) : (
                          <Input
                            id={q.id}
                            type="text"
                            value={(val as string) ?? ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                          />
                        )}
                        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Consent & review</h2>
                <p className="text-sm text-muted-foreground">
                  Confirm the details below before submitting.
                </p>
              </div>

              <div className="rounded-md border divide-y">
                <ReviewRow label="Name" value={form.full_name || "—"} onEdit={() => setStep(1)} />
                <ReviewRow label="Email" value={form.email || "—"} onEdit={() => setStep(1)} />
                <ReviewRow
                  label="Phone"
                  value={form.phone || "—"}
                  onEdit={() => setStep(1)}
                />
                <ReviewRow
                  label="Location"
                  value={form.location || "—"}
                  onEdit={() => setStep(1)}
                />
                <ReviewRow
                  label="CV"
                  value={cvFile ? `${cvFile.name} (${Math.ceil(cvFile.size / 1024)} KB)` : "—"}
                  onEdit={() => setStep(2)}
                />
                <ReviewRow
                  label="Screening"
                  value={
                    pos.questions.length === 0
                      ? "No questions"
                      : `${pos.questions.filter((q) => {
                          const v = answers[q.id];
                          return v != null && !(typeof v === "string" && v.trim() === "");
                        }).length} of ${pos.questions.length} answered`
                  }
                  onEdit={() => setStep(3)}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    aria-label="I agree to the terms"
                  />
                  <span>
                    I agree to TaaSFlow's terms and privacy policy and consent to sharing my CV
                    and answers with the hiring team for this role. *
                  </span>
                </label>
                {fieldErrors.consent_terms && (
                  <p className="text-xs text-destructive">{fieldErrors.consent_terms}</p>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={network}
                    onCheckedChange={(v) => setNetwork(v === true)}
                    aria-label="Join the TaaSFlow talent network"
                  />
                  <span>
                    Optional — also add me to the TaaSFlow talent network so recruiters can
                    consider me for future matching roles.
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Ready to submit</h2>
                <p className="text-sm text-muted-foreground">
                  Submit your application for <span className="font-medium">{pos.title}</span> at{" "}
                  <span className="font-medium">{pos.organization_name}</span>. You'll receive a
                  tracking reference on the next screen.
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Submissions are final. We'll email you when there's a decision or a next step.
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 1 || submitting}
            >
              ← Back
            </Button>
            {step < 5 ? (
              <Button type="button" onClick={goNext} data-testid="apply-continue">
                Continue →
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={onSubmit}
                disabled={submitting}
                data-testid="apply-submit"
              >
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/jobs/$id"
            params={{ id }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel and return to role
          </Link>
        </div>
    </FormShell>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm text-foreground/90 truncate">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Edit
      </button>
    </div>
  );
}
