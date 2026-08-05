import { createFileRoute, Link, redirect, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicPosition } from "@/lib/jobs.functions";
import { extractJobUuid } from "@/lib/marketing/job-slug";
import { useIsMobile } from "@/hooks/use-mobile";
import { submitApplication } from "@/lib/apply.functions";
import {
  APPLY_STEPS,
  APPLY_STEP_LABELS,
  EFFORT_DEFAULT,
  applyEffortLine,
  applyEffortProvenance,
} from "@/lib/jobs/apply-effort";



import { ProcessState } from "@/components/ds/process-state";
import {
  ALLOWED_CV_EXT,
  APPLY_DRAFT_KEY,
  APPLY_IDEMPOTENCY_KEY,
  MAX_CV_BYTES,
  MIN_PASSWORD_LENGTH,
  applySchema,
  composeLocation,
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
import { TransparencyPanel } from "@/components/candidate/transparency-panel";

export const Route = createFileRoute("/jobs/$id/apply")({
  // The step lives in the URL so the browser back button walks back through
  // the flow instead of leaving it — the component stays mounted, so nothing
  // the candidate typed (or attached) is lost.
  validateSearch: (search: Record<string, unknown>): { step?: number; q?: number } => {
    const clamp = (raw: unknown, max: number) => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(max, Math.max(1, Math.trunc(n))) : 1;
    };
    return { step: clamp(search.step, APPLY_STEPS), q: clamp(search.q, 99) };
  },
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

const STEP_LABELS = APPLY_STEP_LABELS;


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

  const isMobile = useIsMobile();
  const { step: stepParam, q: qParam } = Route.useSearch();
  const step = stepParam ?? 1;
  const qIndex = qParam ?? 1;
  // One writer for both step and question cursor, so back/forward always land
  // on a state the flow can render.
  const goTo = useCallback(
    (next: { step?: number; q?: number }, opts?: { replace?: boolean }) => {
      void navigate({
        to: "/jobs/$id/apply",
        params: { id: rawId },
        search: (prev: { step?: number; q?: number }) => ({ ...prev, ...next }),
        replace: opts?.replace ?? false,
        resetScroll: false,
      });
    },
    [navigate, rawId],
  );
  const setStep = useCallback((n: number) => goTo({ step: n, q: 1 }), [goTo]);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    country: "",
    region: "",
    city: "",
    cover_letter: "",
    portfolio_url: "",
    linkedin_url: "",
    website_url: "",
    accommodation_request: "",
  });
  // Account creation for applicants who are not signed in.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvChecking, setCvChecking] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "sending">("idle");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [consent, setConsent] = useState(false);
  const [network, setNetwork] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; trace_id?: string } | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  // When this form first became usable. The gap to a successful submit is the
  // only honest source for the time we quote to the next candidate.
  const startedAtRef = useRef<number>(Date.now());



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

  // Is this applicant already signed in? If so we skip account creation and
  // prefill the email we already know. We read the locally stored session
  // rather than calling getUser(), which hits the network and can leave a
  // public applicant staring at a half-rendered step 1.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const user = data.session?.user ?? null;
      setSignedIn(Boolean(user));
      if (user?.email) {
        setForm((f) => (f.email ? f : { ...f, email: user.email as string }));
      }
    })().catch(() => {
      if (alive) setSignedIn(false);
    });
    return () => {
      alive = false;
    };
  }, []);


  // Persist the text draft on every keystroke, and tell the candidate it
  // happened. An invisible draft still costs the whole application when a
  // phone rings, because nobody knows their answers are safe.
  const firstSaveSkipped = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, answers, network }));
      if (firstSaveSkipped.current) setDraftSavedAt(Date.now());
      else firstSaveSkipped.current = true;
    } catch { /* ignore */ }
  }, [draftKey, form, answers, network]);


  /**
   * A CV upload must never hang on a spinner. FileReader can abort silently
   * (file moved/renamed mid-read, revoked permission), so we settle the promise
   * on abort as well as error and cap the read with a timeout.
   */
  const readFileAsBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { r.abort(); } catch { /* ignore */ }
        reject(new Error("read_timeout"));
      }, 45_000);
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      r.onload = () =>
        done(() => {
          const s = String(r.result ?? "");
          resolve(s.includes(",") ? s.split(",", 2)[1] : s);
        });
      r.onerror = () => done(() => reject(new Error("read_failed")));
      r.onabort = () => done(() => reject(new Error("read_failed")));
      try {
        r.readAsDataURL(f);
      } catch {
        done(() => reject(new Error("read_failed")));
      }
    });

  /** Caps any submit round-trip so a stalled request always surfaces an error. */
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("submit_timeout")), ms);
      p.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });


  const validateFile = (f: File): string | null => {
    if (f.size === 0) return CV_MESSAGES.empty;
    if (f.size > MAX_CV_BYTES) return CV_MESSAGES.too_large;
    if (!ALLOWED_CV_EXT.has(fileExt(f.name))) return CV_MESSAGES.bad_extension;
    return null;
  };

  const onFile = async (f: File | null) => {
    setCvError(null);
    setCvFile(null);
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setCvError(err);
      return;
    }
    // Same signature/structure checks the server runs — catch renamed Word docs,
    // images and corrupt PDFs before the applicant waits on an upload.
    setCvChecking(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { validateCv } = await import("@/lib/cv-validation");
      const res = await validateCv(bytes, f.name, f.type || "application/pdf");
      if (!res.ok) {
        setCvError(res.message ?? CV_MESSAGES.unknown);
        return;
      }
    } catch {
      setCvError(CV_MESSAGES.corrupt);
      return;
    } finally {
      setCvChecking(false);
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

  /**
   * Required-answer check for a subset of screening questions. Scoped so a
   * single question can gate its own screen without dragging in the rest.
   */
  const questionIssues = (
    qs: { id: string; required?: boolean | null }[],
  ): Record<string, string> => {
    const errs: Record<string, string> = {};
    qs.forEach((q) => {
      if (!q?.required) return;
      const v = answers[q.id];
      const empty =
        v == null || (typeof v === "string" && v.trim() === "");
      if (empty) errs[`q:${q.id}`] = "This question is required";
    });
    return errs;
  };

  // Per-step validation used to gate Continue.
  const stepIssues = (n: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    const url = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/.test(v.trim());
    if (n === 1) {
      if (!form.full_name.trim() || form.full_name.trim().length < 2)
        errs.full_name = "Enter your full name";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
        errs.email = "Enter a valid email";
      if (form.phone.trim().length < 6) errs.phone = "Enter a phone number we can reach you on";
      if (form.country.trim().length < 2) errs.country = "Enter your country";
      if (!form.city.trim()) errs.city = "Enter your city";
      if (signedIn === false && wantsAccount) {
        if (password.length < MIN_PASSWORD_LENGTH)
          errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
        else if (password !== password2) errs.password2 = "Passwords do not match";
      }
    }
    if (n === 2) {
      if (!cvFile) errs.cv = "Attach your CV to continue";
      if (cvError) errs.cv = cvError;
      if (!url(form.portfolio_url)) errs.portfolio_url = "Enter a full link starting with https://";
      if (!url(form.linkedin_url)) errs.linkedin_url = "Enter a full link starting with https://";
      if (!url(form.website_url)) errs.website_url = "Enter a full link starting with https://";
    }
    if (n === 3) Object.assign(errs, questionIssues(pos!.questions));
    if (n === 4) {
      if (!consent) errs.consent_terms = "You must accept the terms to continue";
    }
    return errs;
  };

  // On a phone the screening step is shown one question per screen, so the
  // cursor has to advance before the step does.
  const questionCount = pos?.questions.length ?? 0;
  const paginateQuestions = isMobile && step === 3 && questionCount > 1;
  const qCursor = Math.min(Math.max(1, qIndex), Math.max(1, questionCount));

  const goNext = () => {
    if (paginateQuestions && qCursor < questionCount) {
      // Only this question gates the next question. Later ones are not its
      // problem.
      const errs = questionIssues([pos!.questions[qCursor - 1]]);
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;
      goTo({ q: qCursor + 1 });
      return;
    }
    const errs = stepIssues(step);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep(Math.min(APPLY_STEPS, step + 1));
  };
  const goBack = () => {
    setFieldErrors({});
    if (paginateQuestions && qCursor > 1) {
      goTo({ q: qCursor - 1 });
      return;
    }
    setStep(Math.max(1, step - 1));
  };

  // A pasted or reloaded URL can point at a step whose inputs are gone — the
  // CV is deliberately never stored. Drop back to the first step that still
  // needs something rather than showing a review of nothing.
  const clampedRef = useRef(false);
  useEffect(() => {
    if (clampedRef.current || signedIn === null || step === 1) return;
    clampedRef.current = true;
    for (let n = 1; n < step; n++) {
      if (Object.keys(stepIssues(n)).length > 0) {
        goTo({ step: n, q: 1 }, { replace: true });
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, step]);

  // Every step change moves focus to the new heading and announces it, so a
  // screen reader user is told where they are instead of guessing.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step, qCursor]);

  const stepName = STEP_LABELS[Math.min(step, STEP_LABELS.length) - 1];
  const stepAnnouncement = paginateQuestions
    ? `Step ${step} of ${APPLY_STEPS}, ${stepName}. Question ${qCursor} of ${questionCount}.`
    : `Step ${step} of ${APPLY_STEPS}, ${stepName}.`;


  const onSubmit = async () => {
    if (submittingRef.current) return;
    setServerError(null);
    // Final aggregate validation across all steps.
    const allErrs = { ...stepIssues(1), ...stepIssues(2), ...stepIssues(3), ...stepIssues(4) };
    setFieldErrors(allErrs);
    if (Object.keys(allErrs).length > 0) {
      // Jump to earliest failing step.
      if (
        allErrs.full_name ||
        allErrs.email ||
        allErrs.phone ||
        allErrs.country ||
        allErrs.region ||
        allErrs.city ||
        allErrs.password ||
        allErrs.password2
      )
        setStep(1);
      else if (allErrs.cv || allErrs.portfolio_url || allErrs.linkedin_url || allErrs.website_url)
        setStep(2);
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
    setPhase("reading");
    try {
      const base64 = await readFileAsBase64(cvFile);
      setPhase("sending");
      const payload = {
        position_id: id,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        country: form.country,
        region: form.region,
        city: form.city,
        cover_letter: form.cover_letter,
        portfolio_url: form.portfolio_url,
        linkedin_url: form.linkedin_url,
        website_url: form.website_url,
        accommodation_request: form.accommodation_request,
        source: "public_job_board",
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
        elapsed_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),

        ...(signedIn === false && password ? { password } : {}),
      };

      const parsed = applySchema.safeParse(payload);
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          fe[i.path.join(".") || "form"] = i.message;
        });
        setFieldErrors(fe);
        setPhase("idle");
      setSubmitting(false);
        submittingRef.current = false;
        return;
      }

      const result = await withTimeout(submitApplication({ data: parsed.data }), 90_000);
      if (!result.ok) {
        setServerError({ message: result.message, trace_id: result.trace_id });
        setPhase("idle");
      setSubmitting(false);
        submittingRef.current = false;
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      // Account just created for this applicant → sign them straight in so the
      // confirmation page can take them to their application tracker.
      if (result.account === "created" && password) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.auth.signInWithPassword({
            email: form.email.trim().toLowerCase(),
            password,
          });
        } catch { /* non-blocking: they can sign in later */ }
      }
      setPassword("");
      setPassword2("");
      await navigate({
        to: "/apply/received/$applicationId",
        params: { applicationId: result.application_id },
        replace: true,
      });
    } catch (err) {
      console.error(err);
      // Always name the failure so the applicant is never left on a spinner.
      const code = err instanceof Error ? err.message : "";
      const message =
        code === "read_failed"
          ? "We couldn't read that file. Please re-select your CV and try again."
          : code === "read_timeout"
            ? "Reading your CV took too long. Please re-select the file and try again."
            : code === "submit_timeout"
              ? "The upload timed out. Your details are saved — please press Submit again."
              : "Network error — please try again.";
      setServerError({ message });
      setPhase("idle");
      setSubmitting(false);
      submittingRef.current = false;
    }

  };

  if (!pos) return null;

  // The same figure the job page quoted, so the cost does not change between
  // deciding to apply and starting.
  const effort = pos.apply_effort ?? EFFORT_DEFAULT;


  return (
    <FormShell
      exitTo={`/jobs/${id}`}
      exitLabel="← Role details"
      progress={{ step, total: STEP_LABELS.length, label: `Step ${step} of ${STEP_LABELS.length}` }}
      width="md"
    >
      <div className="text-sm text-[color:var(--brand-navy)]/80">{pos.organization_name}</div>

        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
          Apply — {pos.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {/* The measured cost, repeated from the job page. Never a figure we
              invented — see applyEffortLine. */}
          <span title={applyEffortProvenance(effort)}>
            {applyEffortLine(effort, STEP_LABELS.length)}
          </span>

          <span
            aria-live="polite"
            className={
              draftSavedAt
                ? "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                : "sr-only"
            }
            data-testid="apply-draft-saved"
          >
            {draftSavedAt ? "Answers saved on this device" : ""}
          </span>
        </div>


        {/* Progress bar */}
        <div className="mt-6">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="motion-progress h-full bg-primary"
              style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              Step {step} of {APPLY_STEPS} · {stepName}
            </span>
            {paginateQuestions && (
              <span className="text-xs text-muted-foreground">
                Question {qCursor} of {questionCount}
              </span>
            )}
          </div>
          {/* Announce the move, and only the move — the heading itself takes focus. */}
          <p className="sr-only" aria-live="polite" data-testid="apply-step-announcement">
            {stepAnnouncement}
          </p>
          <ol className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 text-xs sm:flex">
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
              <span className="block mt-1">
                Nothing was lost — your answers are still here. Press submit again when you're
                ready.
              </span>
              {serverError.trace_id && (
                <span className="block mt-1 text-xs opacity-70">
                  Reference: {serverError.trace_id}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {Object.keys(fieldErrors).length > 0 && (
          <Alert variant="destructive" className="mt-6" data-testid="apply-step-error">
            <AlertTitle>This step needs a little more</AlertTitle>
            <AlertDescription>
              Check the highlighted fields below. Everything you have already entered is still
              here — nothing was cleared.
            </AlertDescription>
          </Alert>
        )}

        <div data-apply-form className="mt-8 rounded-lg border bg-card p-5 md:p-6">
          {step === 1 && (
            <div className="space-y-5" data-hydrated={signedIn === null ? "pending" : "ready"}>

              {/* State the cost of applying before it is paid, so nobody
                  starts on a phone without the one file they will need. */}
              <section
                className="rounded-lg border bg-muted/30 p-4"
                aria-labelledby="apply-before-you-start"
              >
                <h2 id="apply-before-you-start" className="text-sm font-semibold">
                  Before you start
                </h2>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>
                    ·{" "}
                    {effort.measured
                      ? `${STEP_LABELS.length} short steps, about ${effort.minutes} ${
                          effort.minutes === 1 ? "minute" : "minutes"
                        } — the median for people who completed this application.`
                      : `${STEP_LABELS.length} short steps, usually under ${
                          effort.minutes + 2
                        } minutes.`}
                  </li>
                  <li>· You need your CV as a PDF, up to 10 MB. It is required.</li>
                  <li>
                    ·{" "}
                    {pos.questions.length > 0
                      ? `${pos.questions.length} screening ${
                          pos.questions.length === 1 ? "question" : "questions"
                        } from the hiring team.`
                      : "No screening questions for this role."}
                  </li>
                  <li>
                    · Your typed answers are saved on this device as you go, so you can stop and
                    come back. The CV itself is not kept, so re-attach it if you return.
                  </li>
                </ul>
              </section>


              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Your details</h2>
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
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    data-field="phone"
                    placeholder="+1 555 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    autoComplete="country-name"
                    data-field="country"
                    placeholder="e.g. Portugal"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                  {fieldErrors.country && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.country}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="region">State / region</Label>
                  <Input
                    id="region"
                    autoComplete="address-level1"
                    data-field="region"
                    placeholder="Optional"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                  {fieldErrors.region && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.region}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    autoComplete="address-level2"
                    data-field="city"
                    placeholder="e.g. Lisbon"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                  {fieldErrors.city && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.city}</p>
                  )}
                </div>
              </div>

              {signedIn === false && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={wantsAccount}
                      onCheckedChange={(v) => setWantsAccount(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        Create a candidate account (optional)
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        You don't need one to apply — you can always check your status with the
                        reference we email you. An account lets you sign in and reuse your details.
                      </span>
                    </span>
                  </label>
                  {wantsAccount && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>

                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        data-field="password"
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      {fieldErrors.password && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="password2">Confirm password *</Label>
                      <Input
                        id="password2"
                        type="password"
                        autoComplete="new-password"
                        data-field="password2"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                      />
                      {fieldErrors.password2 && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.password2}</p>
                      )}
                    </div>
                  </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <Link to="/login" className="underline">
                      Sign in first
                    </Link>{" "}
                    — your details will be prefilled.
                  </p>
                </div>
              )}
            </div>


          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Upload your CV</h2>
                <p className="text-sm text-muted-foreground">
                  PDF only, up to 10 MB. Unicode filenames welcome.
                </p>
              </div>
              <div>
                <Label htmlFor="cv">CV file (PDF, max 10 MB) *</Label>
                <Input
                  id="cv"
                  type="file"
                  data-field="cv"
                  accept=".pdf,application/pdf"
                  className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                  disabled={cvChecking}
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                {cvChecking && (
                  <div className="mt-2" aria-live="polite">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Checking your file — this takes a moment.
                    </p>
                  </div>
                )}
                {cvError ? (
                  <p className="mt-1 text-xs text-destructive" aria-live="polite">
                    {cvError} Your answers are saved — just pick another file.
                  </p>
                ) : fieldErrors.cv ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.cv}</p>
                ) : null}
                {cvFile && !cvError && !cvChecking && (
                  <p className="mt-2 text-sm text-foreground/80" aria-live="polite">
                    ✓ Attached: <span className="font-medium">{cvFile.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({Math.ceil(cvFile.size / 1024)} KB)
                    </span>
                  </p>
                )}

                <ul className="mt-3 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  <li>Accepted format: .pdf only</li>
                  <li>Max size: 10 MB</li>
                  <li>Password-protected PDFs can't be reviewed — upload an unlocked copy</li>
                  <li>We store your CV securely; only the hiring team can access it.</li>
                </ul>
              </div>

              <div className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Optional extras</h3>
                  <p className="text-xs text-muted-foreground">
                    Only add what's relevant — none of these are required.
                  </p>
                </div>
                <div>
                  <Label htmlFor="cover_letter">Cover letter</Label>
                  <Textarea
                    id="cover_letter"
                    rows={4}
                    data-field="cover_letter"
                    placeholder="A short note on why this role fits you."
                    value={form.cover_letter}
                    onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn</Label>
                    <Input
                      id="linkedin_url"
                      inputMode="url"
                      data-field="linkedin_url"
                      placeholder="https://linkedin.com/in/…"
                      value={form.linkedin_url}
                      onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    />
                    {fieldErrors.linkedin_url && (
                      <p className="mt-1 text-xs text-destructive">{fieldErrors.linkedin_url}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="portfolio_url">Portfolio or Loom link</Label>
                    <Input
                      id="portfolio_url"
                      inputMode="url"
                      data-field="portfolio_url"
                      placeholder="https://…"
                      value={form.portfolio_url}
                      onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
                    />
                    {fieldErrors.portfolio_url && (
                      <p className="mt-1 text-xs text-destructive">{fieldErrors.portfolio_url}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="website_url">Personal website</Label>
                    <Input
                      id="website_url"
                      inputMode="url"
                      data-field="website_url"
                      placeholder="https://…"
                      value={form.website_url}
                      onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                    />
                    {fieldErrors.website_url && (
                      <p className="mt-1 text-xs text-destructive">{fieldErrors.website_url}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Screening questions</h2>
                <p className="text-sm text-muted-foreground">
                  {questionCount === 0
                    ? "No screening questions for this role — you're all set."
                    : paginateQuestions
                      ? `Question ${qCursor} of ${questionCount} from the hiring team.`
                      : `${questionCount} short ${
                          questionCount === 1 ? "question" : "questions"
                        } from the hiring team.`}
                </p>
              </div>
              {questionCount > 0 && (
                <div className="space-y-5">
                  {/* One question per screen on a phone; the full set fits a
                      desktop column without becoming a wall of fields. */}
                  {(paginateQuestions
                    ? [pos.questions[qCursor - 1]]
                    : pos.questions
                  ).map((q) => {
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
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Consent &amp; review</h2>
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
                  value={
                    composeLocation({
                      city: form.city,
                      region: form.region,
                      country: form.country,
                    }) || "—"
                  }
                  onEdit={() => setStep(1)}
                />
                <ReviewRow
                  label="Links"
                  value={
                    [form.linkedin_url, form.portfolio_url, form.website_url]
                      .filter(Boolean)
                      .join("  ·  ") || "—"
                  }
                  onEdit={() => setStep(2)}
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

              <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">What happens to your data</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    <span className="text-foreground">What we store:</span> your CV, your answers,
                    and your contact details.
                  </li>
                  <li>
                    <span className="text-foreground">Who sees it:</span> the TaaSFlow review team,
                    and the hiring team at {pos.organization_name} for this role. Nobody else.
                  </li>
                  <li>
                    <span className="text-foreground">How long:</span> 12 months after this role
                    closes — or 24 months if you join the talent network below — then it is deleted.
                  </li>
                  <li>
                    <span className="text-foreground">Changed your mind:</span> ask us to delete
                    everything at any time from your status page, or email{" "}
                    <a className="underline" href="mailto:privacy@taasflow.com">
                      privacy@taasflow.com
                    </a>
                    . We action deletion requests within 30 days.
                  </li>
                </ul>
              </div>

              <TransparencyPanel
                company={pos.organization_name}
                title="Before you send it"
                intro="Software helps read your CV; a person reviews your application. Here's the detail."
                defaultOpen="automation"
              />



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

              <div className="space-y-2 rounded-lg border p-4">
                <Label htmlFor="accommodation_request">
                  Accessibility or interview adjustments (private)
                </Label>
                <Textarea
                  id="accommodation_request"
                  rows={3}
                  data-field="accommodation_request"
                  placeholder="Let us know if you need any adjustments during the process."
                  value={form.accommodation_request}
                  onChange={(e) => setForm({ ...form, accommodation_request: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Handled privately by the TaaSFlow team and never shared with the
                  employer without your say-so. It plays no part in your application review.
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Ready to submit</h2>
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

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 1 || submitting}
              className="w-full sm:w-auto"
            >
              ← Back
            </Button>
            {phase !== "idle" ? (
              <ProcessState
                compact
                className="mb-3 w-full"
                status={{
                  process: "file",
                  phase: "running",
                  stageIndex: phase === "reading" ? 0 : 2,
                  note:
                    phase === "reading"
                      ? "Checking your CV is a readable PDF."
                      : "Sending your application and attaching your CV.",
                }}
              />
            ) : null}
            {step < 5 ? (
              <Button
                type="button"
                onClick={goNext}
                data-testid="apply-continue"
                className="w-full sm:w-auto"
                disabled={cvChecking}
              >
                Continue →
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={onSubmit}
                disabled={submitting}
                data-testid="apply-submit"
                className="w-full sm:w-auto"
              >
                {phase === "reading"
                  ? "Preparing your CV…"
                  : phase === "sending"
                    ? "Sending your application…"
                    : "Submit application"}
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
