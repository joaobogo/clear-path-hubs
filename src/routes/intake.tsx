import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
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
  COMP_CURRENCIES,
  COMP_PERIODS,
  COMP_PERIOD_LABELS,
  WORK_MODELS,
  WORK_MODEL_LABELS,
  WORK_AUTHORIZATION_OPTIONS,

  UNREADABLE_JD_EXT,
  JD_ACCEPT_ATTR,
  JD_ACCEPT_LABEL,

  EXPRESS_DRAFT_KEY,
  EXPRESS_IDEMPOTENCY_KEY,
  MAX_JD_BYTES,
  MIN_ACCOUNT_PASSWORD,
  MIN_JD_TEXT,
  expressIntakeSchema,
  jdFileExt,
} from "@/lib/express-intake-schema";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { saveIntakeDraft, loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-draft.functions";
import { submitToCrm } from "@/lib/crm/submit-form";
import { trackEvent } from "@/lib/tracking/pixels";
import { FGV_EVENTS, trackConfirmedConversion, trackFgv } from "@/lib/tracking/fgv-events";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { Check, CheckCircle2, Eye, EyeOff, FileText, Loader2, Pencil, Upload, X } from "lucide-react";

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
      { property: "og:url", content: "https://taasflow.com/intake" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://taasflow.com/intake" }],
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
  whyOpen: string;
  mustHaves: string;
  trainable: string;
  dealBreakers: string;
  location: string;
  workModel: "remote" | "hybrid" | "onsite" | "";
  onsiteDays: string;
  currency: string;
  compensationPeriod: string;
  salaryMin: string;
  salaryMax: string;
  compensationNote: string;
  workAuthorization: string;
  workAuthorizationNote: string;
  interviewProcess: string;
  decisionMaker: string;
  targetStartDate: string;
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
  whyOpen: "",
  mustHaves: "",
  trainable: "",
  dealBreakers: "",
  location: "",
  workModel: "",
  onsiteDays: "",
  currency: "USD",
  compensationPeriod: "year",
  salaryMin: "",
  salaryMax: "",
  compensationNote: "",
  workAuthorization: "",
  workAuthorizationNote: "",
  interviewProcess: "",
  decisionMaker: "",
  targetStartDate: "",
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
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [emailStatus, setEmailStatus] = useState<
    { kind: "idle" } | { kind: "checking" } | { kind: "exists"; message: string } | { kind: "free" }
  >({ kind: "idle" });
  const [accountBusy, setAccountBusy] = useState(false);
  const [signInMode, setSignInMode] = useState(false);
  const [reviewing, setReviewing] = useState(true);
  const hydratedRef = useRef(false);

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
        setAccountEmail(user.email);
        // Their draft belongs to the account, not this tab.
        try {
          const remote = await loadIntakeDraft();
          if (remote?.payload) {
            setState((s3) => ({ ...s3, ...(remote.payload as Partial<FormState>), password: "", confirmPassword: "" }));
            if (remote.updatedAt) setSavedAt(remote.updatedAt);
          }
        } catch {
          /* no server draft yet */
        }
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

  // Autosave: locally always, and against the account once it exists.
  useEffect(() => {
    const {
      password: _pw,
      confirmPassword: _cpw,
      consent: _c,
      pilotAcknowledgement: _p,
      companyFax: _f,
      ...safe
    } = state;
    try {
      localStorage.setItem(EXPRESS_DRAFT_KEY, JSON.stringify(safe));
    } catch {
      /* storage unavailable — the form still works */
    }
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (!authed) {
      setSavedAt(new Date().toISOString());
      return;
    }
    const t = setTimeout(() => {
      setSavingDraft(true);
      void saveIntakeDraft({ data: { payload: safe } })
        .then((r) => setSavedAt(r?.savedAt ?? new Date().toISOString()))
        .catch(() => undefined)
        .finally(() => setSavingDraft(false));
    }, 1200);
    return () => clearTimeout(t);
  }, [state, authed]);

  // Recognise a returning client before they type a password.
  const checkEmail = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (authed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setEmailStatus({ kind: "checking" });
    try {
      const res = await fetch("/api/public/intake-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "check", email }),
      });
      const body = await res.json();
      if (body?.exists) {
        setEmailStatus({ kind: "exists", message: body.message });
        setSignInMode(true);
      } else {
        setEmailStatus({ kind: "free" });
      }
    } catch {
      setEmailStatus({ kind: "idle" });
    }
  };

  const createAccountInline = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErrors((e) => ({ ...e, workEmail: "Enter the work email you'd like to sign in with." }));
      return;
    }
    if (state.password.length < MIN_ACCOUNT_PASSWORD) {
      setErrors((e) => ({
        ...e,
        password: `Choose a password of at least ${MIN_ACCOUNT_PASSWORD} characters.`,
      }));
      return;
    }
    if (state.password !== state.confirmPassword) {
      setErrors((e) => ({ ...e, confirmPassword: "The two passwords don't match yet." }));
      return;
    }
    setAccountBusy(true);
    try {
      const res = await fetch("/api/public/intake-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          email,
          password: state.password,
          firstName: state.firstName,
          lastName: state.lastName,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        if (body?.error === "account_exists") {
          setEmailStatus({ kind: "exists", message: body.message });
          setSignInMode(true);
        }
        toast.error(body?.message ?? "We couldn't create your account. Please try again.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: state.password });
      if (error) {
        toast.error("Account created, but we couldn't sign you in. Try signing in below.");
        setSignInMode(true);
        return;
      }
      setAuthed(true);
      setAccountEmail(email);
      trackEvent("account_created_from_intake", { flow: "express_onboarding" });
      toast.success("Account created. Everything you've typed is saved to it.");
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const signInInline = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (!state.password) {
      setErrors((e) => ({ ...e, password: "Enter your password to sign in." }));
      return;
    }
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: state.password });
      if (error) {
        toast.error("That email and password don't match. Try again or reset your password.");
        return;
      }
      setAuthed(true);
      setAccountEmail(email);
      setEmailStatus({ kind: "idle" });
      toast.success("Signed in. This role will be added to your existing organisation.");
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const googleSignIn = async () => {
    setAccountBusy(true);
    try {
      // Come straight back to the account step of this form.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/intake?resume=account`,
      });
      if (result.error) {
        toast.error("Google sign-in didn't complete. Try again or use email.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setAuthed(true);
        setAccountEmail(data.user.email);
        setState((s2) => ({ ...s2, workEmail: s2.workEmail || data.user!.email! }));
        toast.success("Signed in with Google. Your draft is safe.");
      }
    } catch {
      toast.error("Google sign-in didn't complete. Try again or use email.");
    } finally {
      setAccountBusy(false);
    }
  };

  // After a full-page Google redirect, land back on the account step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("resume")) return;
    const t = setTimeout(() => {
      document.getElementById("account-step")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, []);

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
    if (UNREADABLE_JD_EXT.has(ext)) {
      toast.error("Legacy .doc files can't be read. Save it as PDF or DOCX and upload again.");
      return;
    }
    if (!ALLOWED_JD_EXT.has(ext)) {
      toast.error("Upload a PDF, DOCX, TXT or RTF file.");
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

  const submit = async (intent: "pay" | "call" = "pay") => {
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
      whyOpen: state.whyOpen,
      mustHaves: state.mustHaves,
      trainable: state.trainable,
      dealBreakers: state.dealBreakers,
      location: state.location,
      workModel: state.workModel,
      onsiteDays:
        state.workModel === "remote" || state.onsiteDays === "" ? undefined : Number(state.onsiteDays),
      currency: state.currency,
      compensationPeriod: state.compensationPeriod,
      salaryMin: state.salaryMin === "" ? undefined : Number(state.salaryMin),
      salaryMax: state.salaryMax === "" ? undefined : Number(state.salaryMax),
      compensationNote: state.compensationNote,
      workAuthorization: state.workAuthorization,
      workAuthorizationNote: state.workAuthorizationNote,
      interviewProcess: state.interviewProcess,
      decisionMaker: state.decisionMaker,
      targetStartDate: state.targetStartDate,

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
      // Object-level password checks only run once every field parses, so we
      // surface them here too — otherwise a mismatch stays invisible while
      // another field is still empty.
      if (!authed) {
        if (state.password && state.password.length < MIN_ACCOUNT_PASSWORD) {
          next.password = `Use at least ${MIN_ACCOUNT_PASSWORD} characters`;
        }
        if ((state.password ?? "") !== (state.confirmPassword ?? "")) {
          next.confirmPassword = "Both passwords must match";
        }
      }
      // Same class of problem for the job description: the length rule lives in
      // an object-level refine, so a too-short paste stayed invisible while any
      // other field was still empty.
      const jdTyped = (state.jobDescriptionText ?? "").trim();
      if (!jdFile && jdTyped.length > 0 && jdTyped.length < MIN_JD_TEXT) {
        next.jobDescriptionText = `Paste at least ${MIN_JD_TEXT} characters or upload the job description file`;
      }
      // Same for the two brief rules that live in object-level refines.
      if (
        state.salaryMin !== "" &&
        state.salaryMax !== "" &&
        Number(state.salaryMax) < Number(state.salaryMin)
      ) {
        next.salaryMax = "The top of the range must be at least the bottom";
      }
      if (state.workModel && state.workModel !== "remote" && state.onsiteDays === "") {
        next.onsiteDays = "How many days on site each week?";
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


      trackFgv(FGV_EVENTS.formSubmit, { form_type: "employer_intake" });
      void submitToCrm({
        formId: "employer-intake",
        email: parsed.data.workEmail,
        fullName: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
        phone: parsed.data.phone || null,
        jobTitle: parsed.data.contactTitle || null,
        linkedin: parsed.data.contactLinkedin || null,
        companyName: parsed.data.companyName || null,
        companyDomain: parsed.data.companyWebsite || null,
        answers: {
          "Role title": parsed.data.roleTitle ?? "",
          "Company website": parsed.data.companyWebsite ?? "",
          "Company LinkedIn": parsed.data.companyLinkedin ?? "",
          "Job description provided": parsed.data.jobDescriptionText ? "pasted" : jdFile ? "uploaded" : "none",
        },
        consentStatus: parsed.data.consent ? "accepted_terms" : null,
        honeypot: parsed.data.companyFax ?? "",
      }).then((result) => {
        if (result.ok) {
          trackConfirmedConversion({
            formType: "employer_intake",
            serviceInterest: "recruiting_subscription",
            destinationBrand: "taasflow",
            submissionId: result.submissionId,
          });
        } else {
          trackFgv(FGV_EVENTS.formError, {
            form_type: "employer_intake",
            error_code: result.error,
          });
        }
      });

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

      if (signedIn) void clearIntakeDraft().catch(() => undefined);
      try {
        localStorage.removeItem(EXPRESS_DRAFT_KEY);
        localStorage.removeItem(EXPRESS_IDEMPOTENCY_KEY);
      } catch {
        /* ignore */
      }

      if (signedIn && body.positionId) {
        // Role stays a draft either way — payment (or a conversation) comes next.
        trackEvent("intake_path_chosen", { flow: "express_onboarding", path: intent });
        if (intent === "call") {
          navigate({ to: "/book-call", search: { position: body.positionId } });
        } else {
          navigate({ to: "/checkout", search: { position: body.positionId } });
        }
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
            No payment today. Nothing is charged to start.
          </p>
          <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
            Create your workspace and share the role first. You only pay once your account is created
            and we've accepted the role — and you can walk away before that at no cost.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[color:var(--brand-navy)]/75" aria-live="polite">
          {savingDraft ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </>
          ) : savedAt ? (
            <>
              <Check className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" aria-hidden />
              Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {authed ? " to your account" : " on this device"}
            </>
          ) : (
            "We save your answers as you type."
          )}
        </div>


        <Section id="section-company" title="Your company" step={1}>
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

        <Section id="section-you" title="You" step={2}>
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
                onChange={(e) => {
                  set("workEmail", e.target.value);
                  setEmailStatus({ kind: "idle" });
                }}
                onBlur={() => void checkEmail()}
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

        <div id="account-step">
        {authed ? (
          <section className="flex items-center gap-3 rounded-xl border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/5 p-4">
            <Check className="h-5 w-5 shrink-0 text-[color:var(--brand-teal)]" aria-hidden />
            <p className="text-sm">
              Signed in as <strong>{accountEmail}</strong>. This role will be added to your existing
              organisation, and your answers are saved to your account as you type.
            </p>
          </section>
        ) : (
        <Section title="Create your account" step={3}>
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            Create it now and nothing you've typed can be lost — you stay on this page the whole time.
          </p>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={accountBusy}
            onClick={() => void googleSignIn()}
          >
            Continue with Google
          </Button>

          {emailStatus.kind === "exists" && (
            <div className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/4 p-3 text-sm">
              {emailStatus.message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              htmlFor="account-password"
              error={errors.password}
              required
              hint={signInMode ? "The password for your existing account." : `At least ${MIN_ACCOUNT_PASSWORD} characters.`}
            >
              <div className="relative">
                <Input
                  id="account-password"
                  type={showPassword ? "text" : "password"}
                  value={state.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete={signInMode ? "current-password" : "new-password"}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--brand-navy)]/75 sm:h-9 sm:w-9 hover:text-[color:var(--brand-navy)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
            {!signInMode && (
              <Field
                label="Confirm password"
                error={errors.confirmPassword}
                required
                hint="Type it once more so we know it's right."
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  value={state.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={accountBusy}
              onClick={() => void (signInMode ? signInInline() : createAccountInline())}
            >
              {accountBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Working…
                </>
              ) : signInMode ? (
                "Sign in and continue"
              ) : (
                "Create my account now"
              )}
            </Button>
            <button
              type="button"
              className="text-sm underline text-[color:var(--brand-navy)]/70"
              onClick={() => setSignInMode((v) => !v)}
            >
              {signInMode ? "I don't have an account yet" : "I already have an account"}
            </button>
          </div>
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            Prefer the full login screen?{" "}
            <a href="/login" className="underline">
              Sign in first
            </a>{" "}
            and come back — your answers stay saved.
          </p>

        </Section>
        )}
        </div>

        <Section id="section-role" title="The role" step={authed ? 3 : 4}>
          <Field label="Job title" error={errors.roleTitle} required>
            <Input
              value={state.roleTitle}
              onChange={(e) => set("roleTitle", e.target.value)}
              placeholder="Clinical Operations Manager"
            />
          </Field>

          <div className="space-y-3">
            <Label htmlFor="jd-text" className="text-sm font-medium">
              Job description
            </Label>
            {jdFile ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-[color:var(--brand-navy)]/75" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{jdFile.filename}</p>
                    <p className="text-xs text-[color:var(--brand-navy)]/75">
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
                    ? "border-[color:var(--brand-teal)] bg-[color:var(--brand-teal)]/5"
                    : "border-[color:var(--brand-navy)]/25 hover:border-[color:var(--brand-navy)]/50"
                }`}
              >
                <Upload className="h-5 w-5 text-[color:var(--brand-navy)]/75" aria-hidden />
                <span className="text-sm font-medium">Drop the job description here, or browse</span>
                <span className="text-xs text-[color:var(--brand-navy)]/75">
                  {JD_ACCEPT_LABEL}
                </span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              aria-label="Upload the job description file"
              accept={JD_ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />

            <div className="relative">
              <Textarea
                id="jd-text"
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
                <p className="mt-1 text-xs text-[color:var(--brand-navy)]/75">
                  {jdChars}/{MIN_JD_TEXT} characters minimum when you don't upload a file.
                </p>
              )}
            </div>
            {errors.jobDescriptionText && (
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.jobDescriptionText}
              </p>
            )}
          </div>
        </Section>

        <Section id="section-brief" title="The brief" step={authed ? 4 : 5}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            These answers decide whether your first shortlist lands. Five minutes here saves a week of
            back and forth — and your answers are saved as you type.
          </p>

          <Field
            label="Why is this role open?"
            error={errors.whyOpen}
            required
            hint="Growth, a replacement, a new function — and what changes once it is filled."
          >
            <Textarea
              value={state.whyOpen}
              onChange={(e) => set("whyOpen", e.target.value)}
              rows={3}
              placeholder="Our two clinical ops leads are covering three sites. This hire owns one site so they can stop firefighting."
            />
          </Field>
          <Example>
            "The last person left in March. Since then the team has had no one owning payer contracts,
            and renewals are slipping."
          </Example>

          <Field
            label="Must-haves"
            error={errors.mustHaves}
            required
            hint="One per line. Only what you would reject an otherwise-great candidate for."
          >
            <Textarea
              value={state.mustHaves}
              onChange={(e) => set("mustHaves", e.target.value)}
              rows={4}
              placeholder={"5+ years in clinical operations\nHas run a site through a CQC inspection\nFluent written English"}
            />
          </Field>
          <Example>
            Must-have: "Has managed a P&amp;L above $2M." Not a must-have: "Knows our scheduling tool" —
            that is trainable.
          </Example>

          <Field
            label="Nice to have, or willing to train"
            error={errors.trainable}
            hint="One per line. Naming these widens the pool without lowering the bar."
          >
            <Textarea
              value={state.trainable}
              onChange={(e) => set("trainable", e.target.value)}
              rows={3}
              placeholder={"Our EHR system\nExperience with multi-site rollouts"}
            />
          </Field>

          <Field
            label="What rules someone out?"
            error={errors.dealBreakers}
            required
            hint="Say it plainly, even if it feels obvious. This is the fastest way to stop wasting your time."
          >
            <Textarea
              value={state.dealBreakers}
              onChange={(e) => set("dealBreakers", e.target.value)}
              rows={3}
              placeholder="No agency-side-only backgrounds. No one who needs more than four weeks' notice."
            />
          </Field>
          <Example>
            "More than three jobs in two years", "cannot be on site Tuesdays", "no direct competitor
            X" — all valid, all better said now than after four interviews.
          </Example>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Where is the role based?"
              error={errors.location}
              required
              hint="City and country, or the region candidates must live in."
            >
              <Input
                value={state.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Manchester, United Kingdom"
              />
            </Field>
            <Field label="How does it work?" error={errors.workModel} required htmlFor="work-model">
              <select
                id="work-model"
                value={state.workModel}
                onChange={(e) => set("workModel", e.target.value as FormState["workModel"])}
                className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                aria-invalid={Boolean(errors.workModel)}
              >
                <option value="">Choose one</option>
                {WORK_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {WORK_MODEL_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {state.workModel && state.workModel !== "remote" && (
            <Field
              label="Days on site each week"
              error={errors.onsiteDays}
              required
              hint="Candidates ask this first. A wrong guess costs you offers."
            >
              <Input
                value={state.onsiteDays}
                onChange={(e) => set("onsiteDays", e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="3"
              />
            </Field>
          )}

          <div className="space-y-3 rounded-lg border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/3 p-4">
            <p className="text-sm font-semibold">Compensation range</p>
            <p className="text-sm text-[color:var(--brand-navy)]/75">
              We never publish this. We use it to avoid sending you people you cannot hire.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Currency" htmlFor="currency">
                <select
                  id="currency"
                  value={state.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                >
                  {COMP_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From" error={errors.salaryMin} required>
                <Input
                  value={state.salaryMin}
                  onChange={(e) => set("salaryMin", e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="70000"
                />
              </Field>
              <Field label="To" error={errors.salaryMax} required>
                <Input
                  value={state.salaryMax}
                  onChange={(e) => set("salaryMax", e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="85000"
                />
              </Field>
              <Field label="Period" htmlFor="comp-period">
                <select
                  id="comp-period"
                  value={state.compensationPeriod}
                  onChange={(e) => set("compensationPeriod", e.target.value)}
                  className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                >
                  {COMP_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {COMP_PERIOD_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Anything else about the package"
              error={errors.compensationNote}
              hint="Bonus, equity, shift premium, or where you have flexibility."
            >
              <Input
                value={state.compensationNote}
                onChange={(e) => set("compensationNote", e.target.value)}
                placeholder="10% bonus, can stretch to 90k for someone exceptional"
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Work authorisation
              <span className="ml-1 text-[color:var(--brand-navy)]/70" aria-hidden="true">
                *
              </span>
            </legend>
            {WORK_AUTHORIZATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3"
              >
                <input
                  type="radio"
                  name="work-authorization"
                  value={opt.value}
                  checked={state.workAuthorization === opt.value}
                  onChange={() => set("workAuthorization", opt.value)}
                  className="mt-1"
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-medium">{opt.label}</span>
                  <span className="block text-xs text-[color:var(--brand-navy)]/75">{opt.hint}</span>
                </span>
              </label>
            ))}
            {errors.workAuthorization && (
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.workAuthorization}
              </p>
            )}
          </fieldset>

          <Field
            label="How you interview"
            error={errors.interviewProcess}
            required
            hint="The stages and roughly how long each takes. Candidates drop out of processes they cannot see."
          >
            <Textarea
              value={state.interviewProcess}
              onChange={(e) => set("interviewProcess", e.target.value)}
              rows={3}
              placeholder={"1. 30 min with me\n2. 60 min panel with the site team\n3. Half-day on site, offer same week"}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Who makes the final decision?"
              error={errors.decisionMaker}
              required
              hint="Name and role. We keep the process moving through them."
            >
              <Input
                value={state.decisionMaker}
                onChange={(e) => set("decisionMaker", e.target.value)}
                placeholder="Dana Okoro, Operations Director"
              />
            </Field>
            <Field
              label="Ideal start date"
              error={errors.targetStartDate}
              hint="Optional. We will tell you honestly if it is achievable."
            >
              <Input
                type="date"
                value={state.targetStartDate}
                onChange={(e) => set("targetStartDate", e.target.value)}
              />
            </Field>
          </div>
        </Section>



        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Review your role brief</h2>
              <button
                type="button"
                className="text-sm underline text-[color:var(--brand-navy)]/70"
                onClick={() => setReviewing((v) => !v)}
              >
                {reviewing ? "Hide" : "Show summary"}
              </button>
            </div>
            <p className="text-sm text-[color:var(--brand-navy)]/70">
              This is the last chance to correct anything before you pay.
            </p>
            {reviewing && (
              <div className="space-y-4">
                <ReviewBlock
                  title="Your company"
                  target="section-company"
                  rows={[
                    ["Company", state.companyName],
                    ["Website", state.companyWebsite],
                    ["LinkedIn", state.companyLinkedin],
                  ]}
                />
                <ReviewBlock
                  title="You"
                  target="section-you"
                  rows={[
                    ["Name", `${state.firstName} ${state.lastName}`.trim()],
                    ["Job title", state.contactTitle],
                    ["Work email", state.workEmail],
                    ["Phone", state.phone],
                    ["LinkedIn", state.contactLinkedin],
                  ]}
                />
                <ReviewBlock
                  title="The role"
                  target="section-role"
                  rows={[
                    ["Job title", state.roleTitle],
                    [
                      "Job description",
                      jdFile ? jdFile.filename : state.jobDescriptionText.trim().slice(0, 400),
                    ],
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg bg-[color:var(--brand-navy)]/4 p-4">
              <p className="text-sm font-semibold">What happens after you submit</p>
              <ol className="mt-2 space-y-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                <li>1. Your account and workspace are created — free.</li>
                <li>2. We review the role and confirm we can deliver it.</li>
                <li>
                  3. Only then do you pay the ${PRICE_PILOT_USD} one-time pilot fee. The 14 days start
                  when the search goes live.
                </li>
              </ol>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                One active role, any industry, anywhere in the world, no placement fees. Available once
                per company. First candidate activity usually begins within 3–5 days after go-live.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="pilot-acknowledgement"
                checked={state.pilotAcknowledgement}
                onCheckedChange={(v) => set("pilotAcknowledgement", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.pilotAcknowledgement)}
              />
              <label htmlFor="pilot-acknowledgement" className="text-sm leading-relaxed">
                I understand there is no charge today, and that the ${PRICE_PILOT_USD} one-time 14-day
                pilot is billed only after my account is created and the role is accepted — once per
                company, for one role.
              </label>
            </div>

            {errors.pilotAcknowledgement && (
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.pilotAcknowledgement}
              </p>
            )}

            <div className="flex items-start gap-3">
              <Checkbox
                id="research-consent"
                checked={state.researchConsent}
                onCheckedChange={(v) => set("researchConsent", v === true)}
                className="mt-0.5"
              />
              <label htmlFor="research-consent" className="text-sm leading-relaxed">
                Review my company's public website to fill in company context. You can turn this off —
                we'll use only the job description.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms-consent"
                checked={state.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.consent)}
              />
              <label htmlFor="terms-consent" className="text-sm leading-relaxed">
                I accept the{" "}
                <a href="/terms" className="underline">
                  terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline">
                  privacy policy
                </a>
                .
              </label>
            </div>
            {errors.consent && (
              <p data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
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

            <div className="rounded-xl border border-[color:var(--brand-navy)]/12 p-4">
              <p className="text-sm font-semibold">Choose how you'd like to start</p>
              <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
                Both create your workspace and analyse the role. One publishes today; the other
                keeps it saved until we've spoken.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => void submit("pay")}
                  disabled={submitting}
                  className="min-h-12 w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Creating your workspace…
                    </>
                  ) : (
                    "Start now — pay and publish"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submit("call")}
                  disabled={submitting}
                  className="min-h-12 w-full"
                >
                  Book a call first
                </Button>
              </div>
              <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
                Booking a call still opens your workspace straight away. The role stays saved with
                payment pending until we agree the plan.
              </p>
            </div>
            <ul className="grid gap-2 pt-1 text-sm text-[color:var(--brand-navy)]/70 sm:grid-cols-3">
              {["Role live in your workspace", "Blueprint built for you", "Every answer editable"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" aria-hidden />
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

function Section({
  title,
  step,
  id,
  children,
}: {
  title: string;
  step: number;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4 rounded-xl border border-[color:var(--brand-navy)]/12 bg-white p-5 sm:p-6">
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

/** A worked example under the fields people otherwise skip or answer in three words. */
function Example({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-l-2 border-[color:var(--brand-teal)] bg-[color:var(--brand-teal)]/5 px-3 py-2 text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
      <span className="font-semibold">For example: </span>
      {children}
    </p>
  );
}

function Field({

  label,
  children,
  error,
  hint,
  required,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Set when the control is nested inside wrapper markup and carries its own id. */
  htmlFor?: string;
}) {
  // Every field gets a generated id so the visible label is programmatically
  // tied to its control — screen readers announce the field name, and clicking
  // the label focuses the input.
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const described = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const labelFor = htmlFor ?? fieldId;
  const control = !htmlFor && React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: ((children as React.ReactElement<Record<string, unknown>>).props["id"] as
          | string
          | undefined) ?? fieldId,
        "aria-describedby": described || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className="space-y-1.5">
      {/* The required marker sits outside the <label> so the label's text is
          exactly the field name — that keeps the announced/programmatic name
          clean, while aria-required carries the "required" semantics. */}
      <div className="flex items-baseline">
        <Label htmlFor={labelFor} className="text-sm font-medium">
          {label}
        </Label>
        {required && (
          <span className="ml-1 text-sm text-[color:var(--brand-navy)]/70" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[color:var(--brand-navy)]/75">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          data-field-error="true"
          className="text-sm text-[color:var(--brand-danger)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewBlock({
  title,
  target,
  rows,
}: {
  title: string;
  target: string;
  rows: Array<[string, string]>;
}) {
  // Anything the client chose to skip is simply left out of the summary —
  // a list of "Not provided" rows reads like a list of mistakes.
  const filled = rows.filter(([, value]) => Boolean(value?.trim()));
  return (
    <div className="rounded-lg border border-[color:var(--brand-navy)]/12 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={() =>
            document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="flex items-center gap-1 text-sm underline text-[color:var(--brand-navy)]/70"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </button>
      </div>
      {filled.length === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">
          Nothing filled in yet.
        </p>
      ) : (
        <dl className="mt-3 space-y-2">
          {filled.map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="text-xs uppercase tracking-wide text-[color:var(--brand-navy)]/75">
                {label}
              </dt>
              <dd className="text-sm whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

