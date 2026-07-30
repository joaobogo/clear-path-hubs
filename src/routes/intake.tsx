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
import { trackEvent } from "@/lib/tracking/pixels";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { CheckCircle2, Eye, EyeOff, FileText, Loader2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start your hiring pilot — TaaSFlow" },
      {
        name: "description",
        content:
          "Tell us about your company, create your account and upload the job description. TaaSFlow builds the role blueprint, scoring rubric and sourcing plan for you.",
      },
      { property: "og:title", content: "Start your hiring pilot — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Company details, your account, the job description. TaaSFlow builds the rest and shows you every step.",
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
  companyLinkedin: string;
  firstName: string;
  lastName: string;
  contactTitle: string;
  workEmail: string;
  phone: string;
  contactLinkedin: string;
  password: string;
  confirmPassword: string;
  roleTitle: string;
  jobDescriptionText: string;
  consent: boolean;
  pilotAcknowledgement: boolean;
  researchConsent: boolean;
  companyFax: string;
};

const EMPTY: FormState = {
  companyName: "",
  companyWebsite: "",
  companyLinkedin: "",
  firstName: "",
  lastName: "",
  contactTitle: "",
  workEmail: "",
  phone: "",
  contactLinkedin: "",
  password: "",
  confirmPassword: "",
  roleTitle: "",
  jobDescriptionText: "",
  consent: false,
  pilotAcknowledgement: false,
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
  const [showPassword, setShowPassword] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const idem = useRef<string>("");
  const startedRef = useRef(false);
  const pastedRef = useRef(false);
  const [authed, setAuthed] = useState(false);

  // Restore a draft so a refresh never costs the client their typing. Passwords
  // are deliberately never persisted.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPRESS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setState((s) => ({
          ...s,
          ...parsed,
          password: "",
          confirmPassword: "",
          consent: false,
          pilotAcknowledgement: false,
        }));
      }
      const existingIdem = localStorage.getItem(EXPRESS_IDEMPOTENCY_KEY);
      idem.current = existingIdem || newIdempotencyKey();
      localStorage.setItem(EXPRESS_IDEMPOTENCY_KEY, idem.current);
    } catch {
      idem.current = newIdempotencyKey();
    }
    trackEvent("express_intake_viewed", { flow: "express_onboarding" });

    // Already signed in? Reuse the account — never ask for another password.
    void (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session) return;
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user?.email) return;
        setAuthed(true);
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const full = typeof meta.full_name === "string" ? meta.full_name : "";
        const [first, ...rest] = full.split(" ");
        setState((s2) => ({
          ...s2,
          workEmail: s2.workEmail || user.email!,
          firstName: s2.firstName || first || "",
          lastName: s2.lastName || rest.join(" "),
          password: "",
          confirmPassword: "",
        }));
      } catch {
        /* anonymous visitor — normal path */
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const {
        password: _pw,
        confirmPassword: _cpw,
        consent: _c,
        pilotAcknowledgement: _p,
        companyFax: _f,
        ...safe
      } = state;
      localStorage.setItem(EXPRESS_DRAFT_KEY, JSON.stringify(safe));
    } catch {
      /* storage unavailable — the form still works */
    }
  }, [state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("express_intake_started", { flow: "express_onboarding" });
    }
    setState((s) => ({ ...s, [key]: value }));
  };

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
      setJdFile({
        filename: file.name,
        mime: file.type || "application/octet-stream",
        base64,
        size: file.size,
      });
      setErrors((e) => ({ ...e, jobDescriptionText: "" }));
      trackEvent("job_description_selected", { flow: "express_onboarding", kind: ext });
    } catch {
      toast.error("We couldn't read that file. Try another one.");
    }
  };

  const submit = async () => {
    const payload = {
      idempotencyKey: idem.current || newIdempotencyKey(),
      companyName: state.companyName,
      companyWebsite: state.companyWebsite,
      companyLinkedin: state.companyLinkedin,
      firstName: state.firstName,
      lastName: state.lastName,
      contactTitle: state.contactTitle,
      workEmail: state.workEmail,
      phone: state.phone,
      contactLinkedin: state.contactLinkedin,
      password: state.password,
      confirmPassword: state.confirmPassword,
      roleTitle: state.roleTitle,
      jobDescriptionText: state.jobDescriptionText,
      jobDescriptionFile: jdFile
        ? { filename: jdFile.filename, mime: jdFile.mime, base64: jdFile.base64 }
        : null,
      consent: state.consent,
      pilotAcknowledgement: state.pilotAcknowledgement,
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
      const first = document.querySelector<HTMLElement>("[data-field-error='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // A signed-in client proves ownership of the account with their bearer
      // token; the server refuses to touch an existing workspace without it.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authed) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/public/express-intake", {
        method: "POST",
        headers,
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        toast.error(body?.message || "We couldn't submit that. Please try again.");
        setSubmitting(false);
        return;
      }


      trackEvent("express_intake_submitted", {
        flow: "express_onboarding",
        pilot_eligible: body.pilotEligible !== false,
      });
      if (body.accountCreated) trackEvent("account_created_from_intake", { flow: "express_onboarding" });
      else trackEvent("existing_account_detected", { flow: "express_onboarding" });
      if (body.pilotEligible === false)
        trackEvent("pilot_ineligible", { reason: String(body.pilotReason ?? "unknown") });
      if (body.positionId) trackEvent("role_created", { flow: "express_onboarding" });
      if (jdFile)
        trackEvent(body.jdStored === false ? "document_upload_failed" : "document_upload_succeeded", {
          flow: "express_onboarding",
        });

      // Sign the client straight into their new workspace.
      let signedIn = authed;
      if (!authed && parsed.data.password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.workEmail,
            password: parsed.data.password,
          });
          signedIn = !error;
        } catch {
          signedIn = false;
        }
      }

      // Kick off blueprint preparation. Deliberately not awaited — the role
      // page shows real progress while it runs.
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

      if (signedIn && body.positionId) {
        navigate({ to: "/client/positions/$id", params: { id: body.positionId } });
        return;
      }
      navigate({ to: "/intake/confirmation", search: { intake_id: body.intakeId } });
    } catch {
      toast.error("Network problem. Please try again.");
      setSubmitting(false);
    }
  };

  const jdChars = state.jobDescriptionText.trim().length;

  // Fire once when the client has genuinely pasted a description.
  useEffect(() => {
    if (jdChars >= MIN_JD_TEXT && !pastedRef.current) {
      pastedRef.current = true;
      trackEvent("job_description_pasted", { flow: "express_onboarding" });
    }
  }, [jdChars]);

  return (
    <FormShell
      width="lg"
      eyebrow="Start hiring"
      title="Launch a role in minutes."
      description="Create your workspace and upload the job description. TaaSFlow will build the complete role blueprint, screening criteria, and sourcing plan for you."
    >
      <div className="space-y-6" id="form-main">
        <div className="rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/4 p-4">
          <p className="text-sm font-semibold">
            ${PRICE_PILOT_USD} one-time pilot · 14 days · One role · Any industry · Anywhere in the world ·
            No placement fees
          </p>
          <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
            Pilot access is available once per company.
          </p>
        </div>

        <Section title="Your company" step={1}>
          <Field label="Company name" error={errors.companyName} required>
            <Input
              value={state.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Northwind Health"
              autoComplete="organization"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Company website"
              error={errors.companyWebsite}
              required
              hint="We read only your public pages."
            >
              <Input
                value={state.companyWebsite}
                onChange={(e) => set("companyWebsite", e.target.value)}
                placeholder="northwindhealth.com"
                autoComplete="url"
                inputMode="url"
              />
            </Field>
            <Field label="Company LinkedIn" error={errors.companyLinkedin} hint="Optional">
              <Input
                value={state.companyLinkedin}
                onChange={(e) => set("companyLinkedin", e.target.value)}
                placeholder="linkedin.com/company/northwind"
                inputMode="url"
              />
            </Field>
          </div>
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
          <Field label="Your job title" error={errors.contactTitle} hint="Optional">
            <Input
              value={state.contactTitle}
              onChange={(e) => set("contactTitle", e.target.value)}
              placeholder="Head of Talent"
              autoComplete="organization-title"
            />
          </Field>
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
            <Field label="Phone" error={errors.phone} required>
              <Input
                value={state.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>
          </div>
          <Field label="Your LinkedIn" error={errors.contactLinkedin} hint="Optional">
            <Input
              value={state.contactLinkedin}
              onChange={(e) => set("contactLinkedin", e.target.value)}
              placeholder="linkedin.com/in/yourname"
              inputMode="url"
            />
          </Field>
        </Section>

        {authed ? null : (
        <Section title="Create your account" step={3}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              error={errors.password}
              required
              hint={`At least ${MIN_ACCOUNT_PASSWORD} characters.`}
            >
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={state.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--brand-navy)]/60 hover:text-[color:var(--brand-navy)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
            <Field
              label="Confirm password"
              error={errors.confirmPassword}
              required
              hint="You'll be signed in straight after submitting."
            >
              <Input
                type={showPassword ? "text" : "password"}
                value={state.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </Section>
        )}

        <Section title="The role" step={authed ? 3 : 4}>
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
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => fileInput.current?.click()}
                  >
                    Replace
                  </Button>
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
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void onPickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex min-h-[104px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-white p-4 text-center transition ${
                  dragging
                    ? "border-[color:var(--brand-teal,#0f766e)] bg-[color:var(--brand-teal,#0f766e)]/5"
                    : "border-[color:var(--brand-navy)]/25 hover:border-[color:var(--brand-navy)]/50"
                }`}
              >
                <Upload className="h-5 w-5 text-[color:var(--brand-navy)]/60" aria-hidden />
                <span className="text-sm font-medium">Drop the job description here, or browse</span>
                <span className="text-xs text-[color:var(--brand-navy)]/60">
                  PDF, DOCX or TXT · up to 10 MB
                </span>
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
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger,#b3261e)]">
                {errors.jobDescriptionText}
              </p>
            )}
          </div>
        </Section>

        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg bg-[color:var(--brand-navy)]/4 p-4">
              <p className="text-sm font-semibold">How the pilot works</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                ${PRICE_PILOT_USD} one-time introductory pilot, available once per company. One active
                role for 14 days, any industry, anywhere in the world, with no placement fees. First
                candidate activity usually begins within 3–5 days after the search goes live.
              </p>
            </div>

            <label className="flex items-start gap-3">
              <Checkbox
                checked={state.pilotAcknowledgement}
                onCheckedChange={(v) => set("pilotAcknowledgement", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.pilotAcknowledgement)}
              />
              <span className="text-sm leading-relaxed">
                I understand that this is a one-time 14-day pilot for one role and cannot be repeated by
                the same company.
              </span>
            </label>
            {errors.pilotAcknowledgement && (
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger,#b3261e)]">
                {errors.pilotAcknowledgement}
              </p>
            )}

            <label className="flex items-start gap-3">
              <Checkbox
                checked={state.researchConsent}
                onCheckedChange={(v) => set("researchConsent", v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed">
                Review my company's public website to fill in company context. You can turn this off —
                we'll use only the job description.
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
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger,#b3261e)]">
                {errors.consent}
              </p>
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
                "Create my workspace and analyze my role"
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
      {error && (
        <p data-field-error="true" className="text-sm text-[color:var(--brand-danger,#b3261e)]">
          {error}
        </p>
      )}
    </div>
  );
}
