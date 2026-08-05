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
  splitLines,

  COMP_PERIODS,
  COMP_PERIOD_LABELS,
  COMP_EQUITY,
  COMP_EQUITY_LABELS,
  COMPENSATION_HONEST_LINE,
  COMPENSATION_WIDE_RANGE_WARNING,
  isWideCompensationRange,
  WORK_MODELS,
  WORK_MODEL_LABELS,
  WORK_AUTHORIZATION_OPTIONS,

  UNREADABLE_JD_EXT,
  JD_ACCEPT_ATTR,
  JD_ACCEPT_LABEL,

  EXPRESS_DRAFT_KEY,
  EXPRESS_IDEMPOTENCY_KEY,
  EXPRESS_STEP_KEY,
  INTAKE_STEPS,
  INTAKE_TOTAL_MINUTES,
  STEP_FIELDS,
  INTAKE_REQUIRED_LEGEND,
  intakeRequiredness,
  briefCompleteness,
  stepValidators,
  linesToRequirements,
  requirementsToLines,
  validateRequirements,
  type RequirementItem,

  MAX_JD_BYTES,
  MIN_ACCOUNT_PASSWORD,
  MIN_JD_TEXT,
  expressIntakeSchema,
  jdFileExt,
} from "@/lib/express-intake-schema";
import { FieldExamples } from "@/components/intake/field-examples";
import { RequirementsList, type SuggestionState } from "@/components/intake/requirements-list";
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
  team: string;
  jobDescriptionText: string;
  whyOpen: string;
  mustHaves: string;
  niceToHaves: string;
  trainable: string;
  /** The tagged, ordered requirements list step 2 actually edits. */
  requirements: RequirementItem[];
  manyMustHavesConfirmed: boolean;
  dealBreakers: string;

  location: string;
  workModel: "remote" | "hybrid" | "onsite" | "";
  onsiteDays: string;
  currency: string;
  compensationPeriod: string;
  salaryMin: string;
  salaryMax: string;
  compensationNote: string;
  compensationUndecided: boolean;
  bonusStructure: string;
  equity: string;
  compensationFlexible: boolean;
  wideRangeConfirmed: boolean;
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
  team: "",
  jobDescriptionText: "",
  whyOpen: "",
  mustHaves: "",
  niceToHaves: "",
  trainable: "",
  requirements: [],
  manyMustHavesConfirmed: false,
  dealBreakers: "",

  location: "",
  workModel: "",
  onsiteDays: "",
  currency: "USD",
  compensationPeriod: "year",
  salaryMin: "",
  salaryMax: "",
  compensationNote: "",
  compensationUndecided: false,
  bonusStructure: "",
  equity: "",
  compensationFlexible: false,
  wideRangeConfirmed: false,
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

/**
 * Older drafts stored three line-separated strings. Rebuild the tagged list from
 * them so a returning client never loses their requirements.
 */
function withRequirements(patch: Partial<FormState>): Partial<FormState> {
  if (Array.isArray(patch.requirements) && patch.requirements.length > 0) return patch;
  const rebuilt = linesToRequirements({
    mustHaves: patch.mustHaves ?? "",
    niceToHaves: patch.niceToHaves ?? "",
    trainable: patch.trainable ?? "",
  });
  return rebuilt.length > 0 ? { ...patch, requirements: rebuilt } : patch;
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
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [suggestions, setSuggestions] = useState<SuggestionState>({ kind: "idle" });
  const suggestedForRef = useRef<string>("");
  const lastIntentRef = useRef<"pay" | "call">("pay");
  const hydratedRef = useRef(false);

  const currentStep = INTAKE_STEPS[stepIndex];
  const step = stepIndex + 1;
  const minutesLeft = INTAKE_STEPS.slice(stepIndex).reduce((sum, s) => sum + s.minutes, 0);

  /**
   * Requiredness comes from the same map the server validator uses, so the
   * asterisks on screen can never disagree with what submit will accept.
   */
  const req = React.useMemo(
    () =>
      intakeRequiredness({
        hasJdFile: Boolean(jdFile),
        authed,
        signInMode,
        workModel: state.workModel,
      }),
    [jdFile, authed, signInMode, state.workModel],
  );

  // What is still missing from the brief, in the client's own words. Shown
  // before submit so an incomplete brief is a stated choice, not a surprise.
  const brief = briefCompleteness({
    location: state.location,
    workModel: state.workModel,
    salaryMin: state.salaryMin === "" ? 0 : Number(state.salaryMin),
    workAuthorization: state.workAuthorization,
    interviewProcess: state.interviewProcess,
    decisionMaker: state.decisionMaker,
    dealBreakers: state.dealBreakers,
  });

  /** Move focus and announcement to the first invalid field on this step. */
  const focusFirstError = () => {
    requestAnimationFrame(() => {
      const err = document.querySelector<HTMLElement>("[data-field-error='true']");
      if (!err) return;
      err.scrollIntoView({ behavior: "smooth", block: "center" });
      const field = err.closest("[data-field]")?.querySelector<HTMLElement>(
        "input, textarea, select",
      );
      (field ?? err).focus?.();
    });
  };

  /** Validate only the fields belonging to the step being left. */
  const validateStep = (index: number): boolean => {
    const key = INTAKE_STEPS[index].key;
    const next: Record<string, string> = {};
    if (key === "role") {
      const res = stepValidators.role.safeParse({
        roleTitle: state.roleTitle,
        whyOpen: state.whyOpen,
      });
      if (!res.success) {
        for (const issue of res.error.issues) {
          const f = String(issue.path[0] ?? "form");
          if (!next[f]) next[f] = issue.message;
        }
      }
      const jd = state.jobDescriptionText.trim();
      if (!jdFile && jd.length < MIN_JD_TEXT) {
        next.jobDescriptionText = jd.length
          ? `Paste at least ${MIN_JD_TEXT} characters or upload the job description file`
          : `Upload a job description file or paste at least ${MIN_JD_TEXT} characters`;
      }
    }
    let hardFail = false;
    if (key === "people") {
      const res = validateRequirements(state.requirements, {
        manyConfirmed: state.manyMustHavesConfirmed,
      });
      // Row problems render under their own row; only the list-level message
      // belongs in the shared error map.
      setRowErrors(res.rowErrors);
      if (res.listError) next.requirements = res.listError;
      hardFail = !res.ok;
    }
    if (key === "practicalities") {
      // Optional step: only what was filled in has to make sense.
      if (state.salaryMin !== "" && state.salaryMax === "") {
        next.salaryMax = "Add the top of the range too, or clear both";
      }
      if (state.salaryMax !== "" && state.salaryMin === "") {
        next.salaryMin = "Add the bottom of the range too, or clear both";
      }
      if (
        state.salaryMin !== "" &&
        state.salaryMax !== "" &&
        Number(state.salaryMax) < Number(state.salaryMin)
      ) {
        next.salaryMax = "The top of the range must be at least the bottom";
      }
      if (state.compensationUndecided && (state.salaryMin !== "" || state.salaryMax !== "")) {
        next.compensationUndecided = "Clear the range, or untick 'Not decided yet'";
      }
      if (
        isWideCompensationRange(Number(state.salaryMin) || 0, Number(state.salaryMax) || 0) &&
        !state.wideRangeConfirmed
      ) {
        next.wideRangeConfirmed = COMPENSATION_WIDE_RANGE_WARNING;
      }
      if (state.workModel && state.workModel !== "remote" && state.onsiteDays === "") {
        next.onsiteDays = "How many days on site each week?";
      }
    }
    const fields = STEP_FIELDS[key];
    setErrors((prev) => {
      const carried = { ...prev };
      for (const f of fields) delete carried[f];
      return { ...carried, ...next };
    });
    if (hardFail || Object.keys(next).length > 0) {
      focusFirstError();
      return false;
    }
    return true;
  };

  const goToStep = (index: number) => {
    if (index === stepIndex) return;
    // Going back never blocks. Jumping forward respects the gating steps.
    if (index > stepIndex) {
      for (let i = stepIndex; i < index; i++) {
        if (INTAKE_STEPS[i].required && !validateStep(i)) {
          setStepIndex(i);
          return;
        }
      }
    }
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = (skipValidation = false) => {
    // "Finish this later" skips the checks on an optional step; Continue never does.
    if (!skipValidation && !validateStep(stepIndex)) return;

    setStepIndex((i) => Math.min(i + 1, INTAKE_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  // Restore a draft so a refresh never costs the client their typing. Passwords
  // are deliberately never persisted.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPRESS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setState((s) => ({
          ...s,
          ...withRequirements(parsed),
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
            setState((s3) => ({
              ...s3,
              ...withRequirements(remote.payload as Partial<FormState>),
              password: "",
              confirmPassword: "",
            }));
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

  // After a full-page Google redirect, land back on the confirm step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("resume")) return;
    setStepIndex(INTAKE_STEPS.length - 1);
    const t = setTimeout(() => {
      document.getElementById("account-step")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Remember which step the client was on, so a refresh costs them nothing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPRESS_STEP_KEY);
      const saved = raw === null ? NaN : Number(raw);
      if (Number.isInteger(saved) && saved >= 0 && saved < INTAKE_STEPS.length) {
        setStepIndex(saved);
      }
    } catch {
      /* storage unavailable — start at step 1 */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EXPRESS_STEP_KEY, String(stepIndex));
    } catch {
      /* ignore */
    }
  }, [stepIndex]);


  /**
   * Asks for requirement suggestions from the pasted job description once the
   * client reaches step 2. Failure is non-fatal: the list still works by hand.
   */
  const fetchSuggestions = React.useCallback(
    async (jd: string, roleTitle: string) => {
      setSuggestions({ kind: "loading" });
      try {
        const res = await fetch("/api/public/jd-requirements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleTitle, jobDescriptionText: jd }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          suggestions?: RequirementItem[];
        };
        if (json.ok && Array.isArray(json.suggestions) && json.suggestions.length > 0) {
          setSuggestions({ kind: "ready", items: json.suggestions });
        } else {
          setSuggestions({ kind: "failed" });
        }
      } catch {
        setSuggestions({ kind: "failed" });
      }
    },
    [],
  );

  useEffect(() => {
    if (stepIndex !== 1) return;
    const jd = state.jobDescriptionText.trim();
    // Only the pasted text can be read here; an uploaded file is parsed after
    // submit, so the list simply starts blank in that case.
    if (jd.length < MIN_JD_TEXT) return;
    const signature = `${state.roleTitle.trim()}::${jd.length}`;
    if (suggestedForRef.current === signature) return;
    suggestedForRef.current = signature;
    void fetchSuggestions(jd, state.roleTitle);
  }, [stepIndex, state.jobDescriptionText, state.roleTitle, fetchSuggestions]);

  const setRequirements = (next: RequirementItem[]) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("express_intake_started", { flow: "express_onboarding" });
    }
    setState((s) => ({ ...s, requirements: next }));
    setErrors((e) => ({ ...e, requirements: "" }));
    setRowErrors({});
  };

  /** An example the client chose: appended as ordinary editable text. */
  const useExample = (key: "whyOpen" | "dealBreakers" | "interviewProcess", text: string) => {
    setState((s) => {
      const current = (s[key] ?? "").trim();
      return { ...s, [key]: current.length > 0 ? `${current}\n${text}` : text };
    });
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("express_intake_started", { flow: "express_onboarding" });
    }
    setState((s) => ({ ...s, [key]: value }));
  };

  /**
   * Compensation inputs take digits only. Anything else is rejected inline
   * instead of being silently swallowed, so nobody wonders where their "$" went.
   */
  const onSalaryChange = (key: "salaryMin" | "salaryMax", raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    set(key, digits);
    setErrors((prev) => {
      const next = { ...prev };
      if (raw.trim() !== "" && digits !== raw.replace(/\s/g, "")) {
        next[key] = "Numbers only — no currency symbols, commas or text";
      } else {
        delete next[key];
      }
      // Re-open the wide-range confirmation whenever the numbers move.
      delete next.wideRangeConfirmed;
      return next;
    });
    setState((s) => ({ ...s, wideRangeConfirmed: false }));
  };

  /** Whether the current range trips the stated wide-range threshold. */
  const wideRange = isWideCompensationRange(
    Number(state.salaryMin) || 0,
    Number(state.salaryMax) || 0,
  );

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
      team: state.team,
      jobDescriptionText: state.jobDescriptionText,
      jobDescriptionFile: jdFile
        ? { filename: jdFile.filename, mime: jdFile.mime, base64: jdFile.base64 }
        : null,
      whyOpen: state.whyOpen,
      ...requirementsToLines(state.requirements),
      requirements: state.requirements,
      manyMustHavesConfirmed: state.manyMustHavesConfirmed,
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
      compensationUndecided: state.compensationUndecided,
      bonusStructure: state.bonusStructure,
      equity: state.equity,
      compensationFlexible: state.compensationFlexible,
      wideRangeConfirmed: state.wideRangeConfirmed,
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
      if (
        isWideCompensationRange(Number(state.salaryMin) || 0, Number(state.salaryMax) || 0) &&
        !state.wideRangeConfirmed
      ) {
        next.wideRangeConfirmed = COMPENSATION_WIDE_RANGE_WARNING;
      }
      if (state.compensationUndecided && (state.salaryMin !== "" || state.salaryMax !== "")) {
        next.compensationUndecided = "Clear the range, or untick 'Not decided yet'";
      }
      if (state.workModel && state.workModel !== "remote" && state.onsiteDays === "") {
        next.onsiteDays = "How many days on site each week?";
      }


      setErrors(next);
      toast.error("Please check the highlighted fields.");
      // Send the client to the step that actually holds the first problem,
      // rather than showing an error they cannot see.
      const badStep = INTAKE_STEPS.findIndex((s) =>
        STEP_FIELDS[s.key].some((f) => next[f]),
      );
      if (badStep >= 0 && badStep !== stepIndex) setStepIndex(badStep);
      focusFirstError();
      return;
    }
    setErrors({});
    setSubmitError(null);
    lastIntentRef.current = intent;
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
        // Keep every entered value; show one clear message with Retry.
        setSubmitError(body?.message || "We couldn't submit that. Nothing was lost — please retry.");
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
        localStorage.removeItem(EXPRESS_STEP_KEY);
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
      setSubmitError("We couldn't reach us just now. Your answers are safe — please retry.");
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

        {/* Step counter and an honest time estimate — not a fake "2 minutes". */}
        <nav aria-label="Intake progress" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">
              Step {stepIndex + 1} of {INTAKE_STEPS.length}: {currentStep.title}
            </p>
            <p className="text-xs text-[color:var(--brand-navy)]/70">
              About {minutesLeft} min left · {INTAKE_TOTAL_MINUTES} min in total
            </p>
          </div>
          <ol className="grid grid-cols-4 gap-2">
            {INTAKE_STEPS.map((s, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-current={current ? "step" : undefined}
                    className={`w-full rounded-md border px-2 py-2 text-left text-xs transition ${
                      current
                        ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                        : done
                          ? "border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/8"
                          : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/70"
                    }`}
                  >
                    <span className="block font-semibold">{i + 1}. {s.title}</span>
                    {!s.required && (
                      <span className={current ? "text-white/75" : "text-[color:var(--brand-navy)]/60"}>
                        Optional now
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">{currentStep.blurb}</p>
          {/* One legend per step — the only place requiredness is explained. */}
          <p className="text-xs text-[color:var(--brand-navy)]/70" data-testid="required-legend">
            {INTAKE_REQUIRED_LEGEND}
          </p>
        </nav>


        {step === 4 && (
          <>
        <Section id="section-company" title="Your company" step={4}>

          <Field label="Company name" error={errors.companyName} required={req["companyName"]}>
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
              required={req["companyWebsite"]}
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
            <Field label="Company LinkedIn" error={errors.companyLinkedin} required={req["companyLinkedin"]}>
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
            <Field label="First name" error={errors.firstName} required={req["firstName"]}>
              <Input
                value={state.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name" error={errors.lastName} required={req["lastName"]}>
              <Input
                value={state.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <Field label="Your job title" error={errors.contactTitle} required={req["contactTitle"]}>
            <Input
              value={state.contactTitle}
              onChange={(e) => set("contactTitle", e.target.value)}
              placeholder="Head of Talent"
              autoComplete="organization-title"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work email" error={errors.workEmail} required={req["workEmail"]}>
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
            <Field label="Phone" error={errors.phone} required={req["phone"]}>
              <Input
                value={state.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>
          </div>
          <Field label="Your LinkedIn" error={errors.contactLinkedin} required={req["contactLinkedin"]}>
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
              required={req["password"]}
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
                required={req["confirmPassword"]}
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
          </>
        )}



        {step === 1 && (
        <Section id="section-role" title="The role" step={1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" error={errors.roleTitle} required={req["roleTitle"]}>
              <Input
                value={state.roleTitle}
                onChange={(e) => set("roleTitle", e.target.value)}
                placeholder="Clinical Operations Manager"
              />
            </Field>
            <Field label="Team" error={errors.team} required={req["team"]} hint="Which team it sits in.">
              <Input
                value={state.team}
                onChange={(e) => set("team", e.target.value)}
                placeholder="Clinical Operations"
              />
            </Field>
          </div>


          <div className="space-y-3">
            <div className="flex items-baseline">
              <Label htmlFor="jd-text" className="text-sm font-medium">
                Job description
              </Label>
              {req["jobDescriptionText"] ? (
                <span className="ml-1 text-sm text-[color:var(--brand-navy)]/70" aria-hidden="true">
                  *
                </span>
              ) : (
                <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
                  Optional
                </span>
              )}
            </div>
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
          <Field
            label="Why is this role open?"
            error={errors.whyOpen}
            required={req["whyOpen"]}
            hint="Growth, a replacement, a new function — and what changes once it is filled."
          >
            <Textarea
              value={state.whyOpen}
              onChange={(e) => set("whyOpen", e.target.value)}
              rows={3}
              placeholder="Our two clinical ops leads are covering three sites. This hire owns one site so they can stop firefighting."
            />
          </Field>
          <FieldExamples
            field="why_open"
            roleTitle={state.roleTitle}
            onUse={(text) => useExample("whyOpen", text)}
          />
        </Section>
        )}

        {step === 2 && (
        <Section id="section-people" title="Who you need" step={2}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            One list. Tag each requirement so sourcing chases the right people instead of a wish list.
          </p>

          <RequirementsList
            items={state.requirements}
            onChange={setRequirements}
            rowErrors={rowErrors}
            listError={errors.requirements || null}
            needsConfirm={
              validateRequirements(state.requirements, {
                manyConfirmed: state.manyMustHavesConfirmed,
              }).needsConfirm
            }
            manyConfirmed={state.manyMustHavesConfirmed}
            onConfirmMany={(confirmed) => {
              set("manyMustHavesConfirmed", confirmed);
              if (confirmed) setErrors((e) => ({ ...e, requirements: "" }));
            }}
            roleTitle={state.roleTitle}
            suggestions={suggestions}
            onRetrySuggestions={() => {
              const jd = state.jobDescriptionText.trim();
              if (jd.length < MIN_JD_TEXT) return;
              suggestedForRef.current = "";
              void fetchSuggestions(jd, state.roleTitle);
            }}
          />

          <FieldExamples
            field="must_haves"
            roleTitle={state.roleTitle}
            label="See an example must-have"
            onUse={(text) =>
              setRequirements([...state.requirements, { text, tag: "must_have" }])
            }
          />
        </Section>
        )}

        {step === 3 && (
        <Section id="section-practicalities" title="Practicalities" step={3}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            Money, place, authorisation, timing. If you do not have an answer yet, leave it — the role
            will simply be marked <span className="font-medium">Brief incomplete</span> until you do.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">

            <Field
              label="Where is the role based?"
              error={errors.location}
              required={req["location"]}
              hint="City and country, or the region candidates must live in."
            >
              <Input
                value={state.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Manchester, United Kingdom"
              />
            </Field>
            <Field label="How does it work?" error={errors.workModel} required={req["workModel"]} htmlFor="work-model">
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
              required={req["onsiteDays"]}
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
            <p className="text-sm text-[color:var(--brand-navy)]/75">{COMPENSATION_HONEST_LINE}</p>
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
              <Field label="From" error={errors.salaryMin} required={req["salaryMin"]}>
                <Input
                  value={state.salaryMin}
                  disabled={state.compensationUndecided}
                  onChange={(e) => onSalaryChange("salaryMin", e.target.value)}
                  inputMode="numeric"
                  placeholder="70000"
                />
              </Field>
              <Field label="To" error={errors.salaryMax} required={req["salaryMax"]}>
                <Input
                  value={state.salaryMax}
                  disabled={state.compensationUndecided}
                  onChange={(e) => onSalaryChange("salaryMax", e.target.value)}
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

            {/* Wide-range confirmation: it goes through, but on purpose. */}
            {wideRange && (
              <div
                className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3"
                data-field="wideRangeConfirmed"
              >
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={state.wideRangeConfirmed}
                    onChange={(e) => set("wideRangeConfirmed", e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>{COMPENSATION_WIDE_RANGE_WARNING}</span>
                </label>
                {errors.wideRangeConfirmed && !state.wideRangeConfirmed && (
                  <p className="text-sm text-red-600" data-field-error="true">
                    {errors.wideRangeConfirmed}
                  </p>
                )}
              </div>
            )}

            {/* "Not decided yet" is recorded as undecided, never as zero. */}
            <div className="space-y-1" data-field="compensationUndecided">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={state.compensationUndecided}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setState((prev) => ({
                      ...prev,
                      compensationUndecided: on,
                      salaryMin: on ? "" : prev.salaryMin,
                      salaryMax: on ? "" : prev.salaryMax,
                      wideRangeConfirmed: on ? false : prev.wideRangeConfirmed,
                    }));
                    setErrors((prev) => {
                      const nextErrors = { ...prev };
                      delete nextErrors.salaryMin;
                      delete nextErrors.salaryMax;
                      delete nextErrors.compensationUndecided;
                      delete nextErrors.wideRangeConfirmed;
                      return nextErrors;
                    });
                  }}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Not decided yet
                  <span className="block text-[color:var(--brand-navy)]/65">
                    We will record this as undecided and mark the brief incomplete for compensation.
                  </span>
                </span>
              </label>
              {errors.compensationUndecided && (
                <p className="text-sm text-red-600" data-field-error="true">
                  {errors.compensationUndecided}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Bonus structure"
                error={errors.bonusStructure}
                required={req["bonusStructure"]}
                hint="Only what you would actually pay."
              >
                <Input
                  value={state.bonusStructure}
                  onChange={(e) => set("bonusStructure", e.target.value)}
                  placeholder="10% annual, paid on company and personal targets"
                />
              </Field>
              <Field label="Equity" htmlFor="comp-equity" required={req["equity"]}>
                <select
                  id="comp-equity"
                  value={state.equity}
                  onChange={(e) => set("equity", e.target.value)}
                  className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                >
                  <option value="">Not stated</option>
                  {COMP_EQUITY.map((k) => (
                    <option key={k} value={k}>
                      {COMP_EQUITY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={state.compensationFlexible}
                onChange={(e) => set("compensationFlexible", e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>Flexible for the right person</span>
            </label>

            <Field
              label="Anything else about the package"
              error={errors.compensationNote}
              required={req["compensationNote"]}
              hint="Shift premium, relocation, or where exactly you have room."
            >
              <Input
                value={state.compensationNote}
                onChange={(e) => set("compensationNote", e.target.value)}
                placeholder="Can stretch to 90k for someone exceptional"
              />
            </Field>
          </div>


          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Work authorisation
              <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
                Optional
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
            label="Ideal start date"
            error={errors.targetStartDate}
            required={req["targetStartDate"]}
            hint="We will tell you honestly if it is achievable."
          >
            <Input
              type="date"
              value={state.targetStartDate}
              onChange={(e) => set("targetStartDate", e.target.value)}
            />
          </Field>
        </Section>
        )}

        {step === 4 && (
        <Section id="section-process" title="Process and confirm" step={4}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            How you decide, and what rules someone out. Two minutes here saves candidates dropping
            out halfway.
          </p>

          <Field
            label="What rules someone out?"
            error={errors.dealBreakers}
            required={req["dealBreakers"]}
            hint="Say it plainly, even if it feels obvious. This is the fastest way to stop wasting your time."
          >
            <Textarea
              value={state.dealBreakers}
              onChange={(e) => set("dealBreakers", e.target.value)}
              rows={3}
              placeholder="No agency-side-only backgrounds. No one who needs more than four weeks' notice."
            />
          </Field>
          <FieldExamples
            field="deal_breakers"
            roleTitle={state.roleTitle}
            onUse={(text) => useExample("dealBreakers", text)}
          />

          <Field
            label="How you interview"
            error={errors.interviewProcess}
            required={req["interviewProcess"]}
            hint="The stages and roughly how long each takes. Candidates drop out of processes they cannot see."
          >
            <Textarea
              value={state.interviewProcess}
              onChange={(e) => set("interviewProcess", e.target.value)}
              rows={3}
              placeholder={"1. 30 min with me\n2. 60 min panel with the site team\n3. Half-day on site, offer same week"}
            />
          </Field>
          <FieldExamples
            field="interview_process"
            roleTitle={state.roleTitle}
            onUse={(text) => useExample("interviewProcess", text)}
          />

          <Field
            label="Who makes the final decision?"
            error={errors.decisionMaker}
            required={req["decisionMaker"]}
            hint="Name and role. We keep the process moving through them."
          >
            <Input
              value={state.decisionMaker}
              onChange={(e) => set("decisionMaker", e.target.value)}
              placeholder="Dana Okoro, Operations Director"
            />
          </Field>
        </Section>
        )}



        {step === 4 && (
          <>
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
              This is the last chance to correct anything before you submit.
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
                    ["Team", state.team],
                    ["Why it is open", state.whyOpen],
                    [
                      "Job description",
                      jdFile ? jdFile.filename : state.jobDescriptionText.trim().slice(0, 400),
                    ],
                  ]}
                />
                <ReviewBlock
                  title="Who you need"
                  target="section-people"
                  rows={[
                    [
                      "Must have",
                      state.requirements
                        .filter((r) => r.tag === "must_have")
                        .map((r) => r.text)
                        .join(" · "),
                    ],
                    [
                      "Nice to have",
                      state.requirements
                        .filter((r) => r.tag === "nice_to_have")
                        .map((r) => r.text)
                        .join(" · "),
                    ],
                    [
                      "Can be trained (never filtered)",
                      state.requirements
                        .filter((r) => r.tag === "trainable")
                        .map((r) => r.text)
                        .join(" · "),
                    ],
                  ]}
                />
                <ReviewBlock
                  title="Practicalities"
                  target="section-practicalities"
                  rows={[
                    [
                      "Location",
                      [
                        state.location,
                        state.workModel ? WORK_MODEL_LABELS[state.workModel] : "",
                        state.workModel && state.workModel !== "remote" && state.onsiteDays
                          ? `${state.onsiteDays} days on site`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    ],
                    [
                      "Compensation",
                      state.salaryMin && state.salaryMax
                        ? `${state.currency} ${Number(state.salaryMin).toLocaleString()}–${Number(
                            state.salaryMax,
                          ).toLocaleString()} ${COMP_PERIOD_LABELS[state.compensationPeriod as "year"]}`
                        : "",
                    ],
                    [
                      "Work authorisation",
                      WORK_AUTHORIZATION_OPTIONS.find((o) => o.value === state.workAuthorization)
                        ?.label ?? "",
                    ],
                    ["Ideal start", state.targetStartDate],
                  ]}
                />
                <ReviewBlock
                  title="Process"
                  target="section-process"
                  rows={[
                    ["Rules someone out", state.dealBreakers],
                    ["Interview process", state.interviewProcess],
                    ["Final decision", state.decisionMaker],
                  ]}
                />

              </div>
            )}
            {!brief.complete && (
              <div className="rounded-lg border border-[color:var(--brand-amber,#b45309)]/30 bg-[color:var(--brand-navy)]/4 p-4">
                <p className="text-sm font-semibold">
                  This brief is incomplete — you can still submit it.
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                  The role will be labelled <span className="font-medium">Brief incomplete</span> in
                  your workspace until you add: {brief.missing.join(", ").toLowerCase()}. You can
                  finish it any time from the role page.
                </p>
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
              <span aria-hidden="true" className="order-last text-sm text-[color:var(--brand-navy)]/70">
                *
              </span>
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
              <span className="order-last text-xs text-[color:var(--brand-navy)]/60">Optional</span>
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
              <span aria-hidden="true" className="order-last text-sm text-[color:var(--brand-navy)]/70">
                *
              </span>
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

            {submitError && (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4"
              >
                <p className="text-sm leading-relaxed">{submitError}</p>
                <p className="text-xs text-[color:var(--brand-navy)]/70">
                  Nothing you typed was lost.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void submit(lastIntentRef.current)}
                  disabled={submitting}
                >
                  Retry
                </Button>
              </div>
            )}

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
          </>
        )}

        {/* Step navigation. Back never validates; Continue does. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--brand-navy)]/12 pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="min-h-11"
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            {!currentStep.required && stepIndex < INTAKE_STEPS.length - 1 && (
              <button
                type="button"
                className="text-sm underline text-[color:var(--brand-navy)]/70"
                onClick={() => goNext(true)}
              >
                Finish this later
              </button>
            )}
            {stepIndex < INTAKE_STEPS.length - 1 && (
              <Button type="button" onClick={() => goNext()} className="min-h-11">
                Continue
              </Button>
            )}
          </div>
        </div>
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
        "aria-required": required === true || undefined,
      })
    : children;
  return (
    <div className="space-y-1.5" data-field={label}>
      {/* The required marker sits outside the <label> so the label's text is
          exactly the field name — that keeps the announced/programmatic name
          clean, while aria-required carries the "required" semantics. */}
      <div className="flex items-baseline">
        <Label htmlFor={labelFor} className="text-sm font-medium">
          {label}
        </Label>
        {required === true && (
          <span className="ml-1 text-sm text-[color:var(--brand-navy)]/70" aria-hidden="true">
            *
          </span>
        )}
        {required === false && (
          <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
            Optional
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
          role="alert"
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

