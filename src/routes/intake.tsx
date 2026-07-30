import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { FormShell } from "@/components/marketing/form-shell";
import {
  ALLOWED_JD_EXT,
  EXPRESS_DRAFT_KEY,
  EXPRESS_IDEMPOTENCY_KEY,
  MAX_JD_BYTES,
  MIN_ACCOUNT_PASSWORD,
  MIN_JD_TEXT,
  expressIntakeSchema,
  jdFileExt,
} from "@/lib/express-intake-schema";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start hiring in minutes — TaaSFlow" },
      {
        name: "description",
        content:
          "Add your company, create your account, upload the job description. TaaSFlow builds the full role blueprint, scoring rubric and sourcing plan for you.",
      },
      { property: "og:title", content: "Start hiring in minutes — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Add your company, create your account, upload the job description. TaaSFlow builds the rest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpressIntakePage,
});

type FormState = {
  companyName: string;
  companyWebsite: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;
  password: string;
  roleTitle: string;
  jobDescriptionText: string;
  consent: boolean;
  researchConsent: boolean;
  companyFax: string;
};

const EMPTY: FormState = {
  companyName: "",
  companyWebsite: "",
  firstName: "",
  lastName: "",
  workEmail: "",
  phone: "",
  password: "",
  roleTitle: "",
  jobDescriptionText: "",
  consent: false,
  researchConsent: true,
  companyFax: "",
};

type JdFile = { filename: string; mime: string; base64: string; size: number };

function newIdempotencyKey(): string {
  return `exp_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function ExpressIntakePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>(EMPTY);
  const [jdFile, setJdFile] = useState<JdFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const idem = useRef<string>("");

  // Restore a draft so a refresh never costs the client their typing. The
  // password is deliberately never persisted.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPRESS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setState((s) => ({ ...s, ...parsed, password: "", consent: false }));
      }
      const existingIdem = localStorage.getItem(EXPRESS_IDEMPOTENCY_KEY);
      idem.current = existingIdem || newIdempotencyKey();
      localStorage.setItem(EXPRESS_IDEMPOTENCY_KEY, idem.current);
    } catch {
      idem.current = newIdempotencyKey();
    }
  }, []);

  useEffect(() => {
    try {
      const { password: _pw, consent: _c, companyFax: _f, ...safe } = state;
      localStorage.setItem(EXPRESS_DRAFT_KEY, JSON.stringify(safe));
    } catch {
      /* storage unavailable — the form still works */
    }
  }, [state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const ext = jdFileExt(file.name);
    if (!ALLOWED_JD_EXT.has(ext)) {
      toast.error("Upload a PDF, DOCX or TXT file.");
      return;
    }
    if (file.size > MAX_JD_BYTES) {
      toast.error("That file is larger than 10 MB.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setJdFile({ filename: file.name, mime: file.type || "application/octet-stream", base64, size: file.size });
      setErrors((e) => ({ ...e, jobDescriptionText: "" }));
    } catch {
      toast.error("We couldn't read that file. Try another one.");
    }
  };

  const submit = async () => {
    const payload = {
      idempotencyKey: idem.current || newIdempotencyKey(),
      companyName: state.companyName,
      companyWebsite: state.companyWebsite,
      firstName: state.firstName,
      lastName: state.lastName,
      workEmail: state.workEmail,
      phone: state.phone,
      password: state.password,
      roleTitle: state.roleTitle,
      jobDescriptionText: state.jobDescriptionText,
      jobDescriptionFile: jdFile
        ? { filename: jdFile.filename, mime: jdFile.mime, base64: jdFile.base64 }
        : null,
      consent: state.consent,
      researchConsent: state.researchConsent,
      source: "express_onboarding",
      companyFax: state.companyFax,
    };

    const parsed = expressIntakeSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/public/express-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        toast.error(body?.message || "We couldn't submit that. Please try again.");
        setSubmitting(false);
        return;
      }

      // Sign the client straight into their new workspace.
      try {
        await supabase.auth.signInWithPassword({
          email: parsed.data.workEmail,
          password: parsed.data.password,
        });
      } catch {
        /* they can still sign in manually from the confirmation screen */
      }

      // Kick off blueprint preparation. Deliberately not awaited — the
      // confirmation screen shows real progress while it runs.
      if (body.intakeId) {
        void fetch("/api/public/blueprint-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeId: body.intakeId }),
        }).catch(() => undefined);
      }

      try {
        localStorage.removeItem(EXPRESS_DRAFT_KEY);
        localStorage.removeItem(EXPRESS_IDEMPOTENCY_KEY);
      } catch {
        /* ignore */
      }

      navigate({ to: "/intake/confirmation", search: { intake_id: body.intakeId } });
    } catch {
      toast.error("Network problem. Please try again.");
      setSubmitting(false);
    }
  };

  const jdChars = state.jobDescriptionText.trim().length;

  return (
    <FormShell
      width="lg"
      eyebrow="Start hiring"
      title="Give us the role. We'll build the rest."
      description="Five fields and a job description. Your workspace, role blueprint, scoring rubric and sourcing plan are prepared automatically."
    >
      <div className="space-y-6" id="form-main">
        <Section title="Your company" step={1}>
          <Field label="Company name" error={errors.companyName} required>
            <Input
              value={state.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Northwind Health"
              autoComplete="organization"
            />
          </Field>
          <Field
            label="Company website"
            error={errors.companyWebsite}
            hint="We read only your public pages to fill in company context."
          >
            <Input
              value={state.companyWebsite}
              onChange={(e) => set("companyWebsite", e.target.value)}
              placeholder="northwindhealth.com"
              autoComplete="url"
              inputMode="url"
            />
          </Field>
        </Section>

        <Section title="You" step={2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName} required>
              <Input
                value={state.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name" error={errors.lastName} required>
              <Input
                value={state.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work email" error={errors.workEmail} required>
              <Input
                type="email"
                value={state.workEmail}
                onChange={(e) => set("workEmail", e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </Field>
            <Field label="Phone" error={errors.phone} hint="Optional">
              <Input
                value={state.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>
          </div>
        </Section>

        <Section title="Create your account" step={3}>
          <Field
            label="Password"
            error={errors.password}
            required
            hint={`At least ${MIN_ACCOUNT_PASSWORD} characters. You'll be signed in straight after submitting.`}
          >
            <Input
              type="password"
              value={state.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </Section>

        <Section title="The role" step={4}>
          <Field label="Job title" error={errors.roleTitle} required>
            <Input
              value={state.roleTitle}
              onChange={(e) => set("roleTitle", e.target.value)}
              placeholder="Clinical Operations Manager"
            />
          </Field>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Job description</Label>
            {jdFile ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-[color:var(--brand-navy)]/60" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{jdFile.filename}</p>
                    <p className="text-xs text-[color:var(--brand-navy)]/60">
                      {(jdFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setJdFile(null)}
                  aria-label="Remove file"
                  className="min-h-11"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[color:var(--brand-navy)]/25 bg-white p-4 text-center transition hover:border-[color:var(--brand-navy)]/50"
              >
                <Upload className="h-5 w-5 text-[color:var(--brand-navy)]/60" aria-hidden />
                <span className="text-sm font-medium">Upload the job description</span>
                <span className="text-xs text-[color:var(--brand-navy)]/60">PDF, DOCX or TXT · up to 10 MB</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain"
              className="sr-only"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />

            <div className="relative">
              <Textarea
                value={state.jobDescriptionText}
                onChange={(e) => set("jobDescriptionText", e.target.value)}
                rows={8}
                placeholder={
                  jdFile
                    ? "Anything else we should know about this role (optional)…"
                    : "…or paste the job description here."
                }
                aria-invalid={Boolean(errors.jobDescriptionText)}
              />
              {!jdFile && (
                <p className="mt-1 text-xs text-[color:var(--brand-navy)]/60">
                  {jdChars}/{MIN_JD_TEXT} characters minimum when you don't upload a file.
                </p>
              )}
            </div>
            {errors.jobDescriptionText && (
              <p className="text-sm text-[color:var(--brand-danger,#b3261e)]">{errors.jobDescriptionText}</p>
            )}
          </div>
        </Section>

        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={state.researchConsent}
                onCheckedChange={(v) => set("researchConsent", v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed">
                Review my company's public website to fill in company context. You can turn this off — we'll
                use only the job description.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Checkbox
                checked={state.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.consent)}
              />
              <span className="text-sm leading-relaxed">
                I accept the{" "}
                <a href="/terms" className="underline">
                  terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline">
                  privacy policy
                </a>
                .
              </span>
            </label>
            {errors.consent && (
              <p className="text-sm text-[color:var(--brand-danger,#b3261e)]">{errors.consent}</p>
            )}

            {/* Spam trap — intentionally hidden from people and assistive tech. */}
            <div aria-hidden className="hidden">
              <label htmlFor="company-fax">Company fax</label>
              <input
                id="company-fax"
                tabIndex={-1}
                autoComplete="off"
                value={state.companyFax}
                onChange={(e) => set("companyFax", e.target.value)}
              />
            </div>

            <Button type="button" onClick={submit} disabled={submitting} className="min-h-12 w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Creating your workspace…
                </>
              ) : (
                "Create my workspace and role"
              )}
            </Button>
            <ul className="grid gap-2 pt-1 text-sm text-[color:var(--brand-navy)]/70 sm:grid-cols-3">
              {["Role live in your workspace", "Blueprint built for you", "Every answer editable"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--brand-teal,#0f766e)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </FormShell>
  );
}

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-[color:var(--brand-navy)]/12 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-xs font-semibold text-white">
          {step}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-[color:var(--brand-navy)]/50">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-[color:var(--brand-navy)]/60">{hint}</p>}
      {error && <p className="text-sm text-[color:var(--brand-danger,#b3261e)]">{error}</p>}
    </div>
  );
}
