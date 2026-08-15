import { createFileRoute, Link, redirect, useNavigate, notFound } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COVER_NOTE_MAX } from "@/lib/screening-limits";
import { SCREENING_ANSWER_MAX } from "@/lib/screening-limits";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FormShell } from "@/components/marketing/form-shell";
import { TransparencyPanel } from "@/components/candidate/transparency-panel";
import { ReturningApplicantCard } from "@/components/candidate/returning-applicant-card";
import type { ExistingApplicationSummary } from "@/lib/candidate/existing-application.server";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/candidate/funnel-events.functions";
import { deviceBucket } from "@/lib/candidate/funnel-events";


const EMPTY_FORM = {
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
};

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
  errorComponent: makeRouteErrorComponent("public", "jobs.$id.apply"),
});

type AnswerValue = string | boolean | number | null;

const STEP_LABELS = APPLY_STEP_LABELS;


/** Human file size — KB under 1 MB, one decimal above. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
        search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
        replace: opts?.replace ?? false,
        resetScroll: false,
      });
    },
    [navigate, rawId],
  );
  const setStep = useCallback((n: number) => goTo({ step: n, q: 1 }), [goTo]);

  const [form, setForm] = useState(EMPTY_FORM);
  // Account creation for applicants who are not signed in.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvChecking, setCvChecking] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [cvStatus, setCvStatus] = useState("");
  const cvReaderRef = useRef<FileReader | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "sending">("idle");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [consent, setConsent] = useState(false);
  const [network, setNetwork] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; trace_id?: string } | null>(
    null,
  );
  // A repeat application is not an error: we show the candidate their own
  // existing application instead of a duplicate failure.
  const [returning, setReturning] = useState<
    { existing: ExistingApplicationSummary | null; email: string } | null
  >(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  // Set only when the browser refuses to keep the draft (private mode, full
  // quota). We say so instead of implying the answers are safe.
  const [draftError, setDraftError] = useState(false);
  // A draft found on reopen: what step it reached, and when it was last saved.
  const [resume, setResume] = useState<{ step: number; savedAt: number | null } | null>(null);
  // Ticks so "Saved just now" ages into "Saved 3 minutes ago" on its own.
  const [savedTick, setSavedTick] = useState(0);
  const submittingRef = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  // When this form first became usable. The gap to a successful submit is the
  // only honest source for the time we quote to the next candidate.
  const startedAtRef = useRef<number>(Date.now());



  // Restore the text draft — never the CV, which is not stored anywhere until
  // the application is submitted. Keyed per posting and per browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.form) setForm(d.form);
      if (d.answers) setAnswers(d.answers);
      if (typeof d.network === "boolean") setNetwork(d.network);
      const hasContent =
        Object.values(d.form ?? {}).some((v) => typeof v === "string" && v.trim() !== "") ||
        Object.keys(d.answers ?? {}).length > 0;
      if (hasContent) {
        setResume({
          step: typeof d.step === "number" ? Math.min(APPLY_STEPS, Math.max(1, d.step)) : 1,
          savedAt: typeof d.savedAt === "number" ? d.savedAt : null,
        });
      }
    } catch { /* a corrupt draft is the same as no draft */ }
  }, [draftKey]);

  useEffect(() => {
    if (!draftSavedAt) return;
    const t = setInterval(() => setSavedTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [draftSavedAt]);

  // Is this applicant already signed in? If so we skip account creation and
  // prefill the email we already know. We read the locally stored session
  // rather than calling getUser(), which hits the network and can leave a
  // public applicant staring at a half-rendered step 1.
  useEffect(() => {
    let alive = true;
    // Never gate the form on this probe. A slow or offline auth call must not
    // leave an applicant staring at a step that never becomes interactive, so
    // we fall back to "not signed in" — the correct assumption for a public
    // application — after a short wait.
    const fallback = setTimeout(() => {
      if (alive) setSignedIn((current) => (current === null ? false : current));
    }, 4000);
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
      clearTimeout(fallback);
    };
  }, []);


  // Persist the text draft on every keystroke, and tell the candidate it
  // happened. An invisible draft still costs the whole application when a
  // phone rings, because nobody knows their answers are safe.
  const firstSaveSkipped = useRef(false);
  useEffect(() => {
    const savedAt = Date.now();
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, answers, network, step, savedAt }),
      );
      setDraftError(false);
      if (firstSaveSkipped.current) setDraftSavedAt(savedAt);
      else firstSaveSkipped.current = true;
    } catch {
      // Storage refused us. Never pretend the draft exists.
      setDraftError(true);
      setDraftSavedAt(null);
    }
  }, [draftKey, form, answers, network, step]);


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


  /** Name the actual problem — a wrong extension should say what to do about it. */
  const extensionMessage = (name: string): string => {
    const ext = fileExt(name);
    if (ext === "docx") return "This is a Word file — export it as a PDF and try again.";
    if (ext === "doc") return "This is an older Word file — save it as a PDF and try again.";
    if (ext === "pages") return "This is a Pages file — export it as a PDF and try again.";
    if (["png", "jpg", "jpeg", "heic", "webp"].includes(ext))
      return "This is an image — upload a PDF of your CV, not a photo or screenshot.";
    if (["txt", "rtf", "md"].includes(ext))
      return "This is a text file — export or print it as a PDF and try again.";
    if (["zip", "rar", "7z"].includes(ext))
      return "This is a compressed folder — upload the CV itself as a single PDF.";
    return `We only accept PDF files${ext ? ` (this one is .${ext})` : ""} — export your CV as a PDF and try again.`;
  };

  const validateFile = (f: File): string | null => {
    if (!ALLOWED_CV_EXT.has(fileExt(f.name))) return extensionMessage(f.name);
    if (f.size === 0)
      return "That file is empty (0 bytes) — re-export your CV and pick the new file.";
    if (f.size > MAX_CV_BYTES)
      return `That file is ${(f.size / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB. Export a smaller PDF (images are usually the cause) and try again.`;
    return null;
  };

  /** Determinate, cancellable read so progress is real and never a dead spinner. */
  const readBytes = (f: File) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const r = new FileReader();
      cvReaderRef.current = r;
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cvReaderRef.current = null;
        fn();
      };
      r.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0)
          setCvProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      r.onload = () =>
        done(() => resolve(new Uint8Array(r.result as ArrayBuffer)));
      r.onerror = () => done(() => reject(new Error("read_failed")));
      r.onabort = () => done(() => reject(new Error("cancelled")));
      try {
        r.readAsArrayBuffer(f);
      } catch {
        done(() => reject(new Error("read_failed")));
      }
    });

  const cancelCvCheck = () => {
    try { cvReaderRef.current?.abort(); } catch { /* ignore */ }
    setCvChecking(false);
    setCvProgress(0);
    setCvError(null);
    setCvStatus("Upload cancelled. No file attached.");
  };

  const onFile = async (f: File | null) => {
    setCvError(null);
    setCvFile(null);
    setCvProgress(0);
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setCvError(err);
      setCvStatus(`${f.name} was not accepted. ${err}`);
      return;
    }
    // Same signature/structure checks the server runs — catch renamed Word docs,
    // images and corrupt PDFs before the applicant waits on an upload.
    setCvChecking(true);
    setCvStatus(`Checking ${f.name}.`);
    try {
      const bytes = await readBytes(f);
      setCvProgress(100);
      const { validateCv } = await import("@/lib/cv-validation");
      const res = await validateCv(bytes, f.name, f.type || "application/pdf");
      if (!res.ok) {
        const msg = res.message ?? CV_MESSAGES.unknown;
        setCvError(msg);
        setCvStatus(`${f.name} was not accepted. ${msg}`);
        return;
      }
    } catch (e) {
      if ((e as Error).message === "cancelled") return;
      setCvError(CV_MESSAGES.corrupt);
      setCvStatus(`${f.name} could not be read.`);
      return;
    } finally {
      setCvChecking(false);
    }
    setCvFile(f);
    setCvStatus(`Attached ${f.name}, ${formatFileSize(f.size)}.`);
  };

  const clearCv = () => {
    setCvFile(null);
    setCvError(null);
    setCvProgress(0);
    setCvStatus("CV removed. No file attached.");
    if (cvInputRef.current) cvInputRef.current.value = "";
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

  // Editing from the review screen: jump to the owning step, put focus on the
  // first field of that section, and offer a one-tap way back to review so
  // nobody walks the whole flow again to fix a typo.
  const [returningToReview, setReturningToReview] = useState(false);
  const pendingFocusRef = useRef<string | null>(null);
  const editSection = useCallback(
    (targetStep: number, field: string) => {
      pendingFocusRef.current = field;
      setReturningToReview(true);
      setFieldErrors({});
      setStep(targetStep);
    },
    [setStep],
  );
  const returnToReview = useCallback(() => {
    const errs = stepIssues(step);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setReturningToReview(false);
    setStep(5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, setStep, form, answers, consent, cvFile, cvError, password, password2]);

  // Every step change moves focus to the new heading and announces it, so a
  // screen reader user is told where they are instead of guessing. When the
  // candidate came from an Edit link, focus the field they came to change.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    const field = pendingFocusRef.current;
    if (field) {
      pendingFocusRef.current = null;
      const el =
        (document.querySelector(`[data-field="${field}"]`) as HTMLElement | null) ??
        document.getElementById(field);
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.focus();
        return;
      }
    }
    stepHeadingRef.current?.focus();
  }, [step, qCursor]);

  // Only answers the candidate actually gave. A skipped optional question is
  // omitted from the review rather than rendered as an empty row.
  const answeredQuestions = (pos?.questions ?? [])
    .map((q) => {
      const v = answers[q.id];
      const text =
        typeof v === "boolean"
          ? v
            ? "Yes"
            : "No"
          : v == null
            ? ""
            : String(v).trim();
      return { id: q.id, question: q.question, value: text };
    })
    .filter((a) => a.value !== "");


  // Relative, plain-language save marker. Absent until the first real save,
  // so nothing claims to be saved before it is.
  const savedLabel = (() => {
    void savedTick;
    if (draftError) return null;
    if (!draftSavedAt) return null;
    const mins = Math.floor((Date.now() - draftSavedAt) / 60_000);
    if (mins < 1) return "Saved just now";
    return `Saved ${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  })();

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
      track("apply_submitted", { position_id: id, device: deviceBucket(window.innerWidth) });
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
      if (result.deduped) {
        // Their first application stands. Tell them the truth about it and
        // offer a CV replacement rather than a dead end.
        setReturning({ existing: result.existing ?? null, email: form.email.trim() });
        setPhase("idle");
        setSubmitting(false);
        submittingRef.current = false;
        return;
      }
      await navigate({
        to: "/apply/received/$applicationId",
        params: { applicationId: result.application_id },
        // A withdrawn or rejected earlier application permits this fresh
        // submission — the confirmation says so plainly.
        search: { again: Boolean(result.prior_closed) },
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

  if (returning) {
    return (
      <FormShell exitTo="/jobs" exitLabel="Browse more roles" width="md">
        {returning.existing ? (
          <ReturningApplicantCard
            email={returning.email}
            existing={returning.existing}
            positionTitle={pos.title}
          />
        ) : (
          <div className="w-full rounded-lg border bg-card p-6 md:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              You already applied to this role — you&apos;re all set
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We have your application for {pos.title} and it is with our team. We could not load
              its details just now — email hello@taasflow.com and a person will send you the date,
              status and reference.
            </p>
            <div className="mt-6">
              <Button asChild className="w-full min-h-11" size="lg">
                <Link to="/apply/status">Find my application</Link>
              </Button>
            </div>
          </div>
        )}
      </FormShell>
    );
  }

  // The same figure the job page quoted, so the cost does not change between
  // deciding to apply and starting.
  const effort = pos.apply_effort ?? EFFORT_DEFAULT;


  return (
    <FormShell
      exitTo={`/jobs/${id}`}
      exitLabel="← Role details"
      progress={{
        step,
        total: STEP_LABELS.length,
        label: `Step ${step} of ${STEP_LABELS.length}`,
        note: draftError ? (
          <span
            className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
            data-testid="apply-draft-error"
            role="status"
          >
            Not saved — finish this step before leaving
          </span>
        ) : savedLabel ? (
          <span
            className="shrink-0 rounded-full bg-[color:var(--brand-navy)]/8 px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-navy)]/80"
            data-testid="apply-draft-saved-marker"
            role="status"
          >
            {savedLabel}
          </span>
        ) : null,
      }}
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

          {/* The visible marker lives in the sticky header; this keeps the
              same fact available to assistive tech in reading order. */}
          <span aria-live="polite" className="sr-only" data-testid="apply-draft-saved">
            {savedLabel ? `${savedLabel} on this device` : ""}
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
            <AlertTitle>No application was created</AlertTitle>
            <AlertDescription>
              {serverError.message}
              <span className="block mt-1">
                Nothing was sent and nothing was lost — your answers are still here. Press submit
                again when you're ready.
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

        {draftError && (
          <Alert variant="destructive" className="mt-6" data-testid="apply-draft-error-alert">
            <AlertTitle>We could not save your progress</AlertTitle>
            <AlertDescription>
              This browser is not letting us keep a local draft, so finish this step before
              leaving the page. Nothing has been sent yet.
            </AlertDescription>
          </Alert>
        )}

        {resume && (
          <Alert className="mt-6" data-testid="apply-resume-prompt">
            <AlertTitle>Pick up where you left off</AlertTitle>
            <AlertDescription>
              <span className="block">
                You already started applying for {pos.title}
                {resume.savedAt
                  ? ` — saved on this device ${new Date(resume.savedAt).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}`
                  : ""}
                . You reached step {resume.step} of {APPLY_STEPS},{" "}
                {STEP_LABELS[Math.min(resume.step, STEP_LABELS.length) - 1]}.
              </span>
              <span className="mt-1 block">
                Your answers are restored. Your CV is not — files are never kept on this device,
                so you will need to attach the PDF again.
              </span>
              <span className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = resume.step;
                    setResume(null);
                    // The CV is gone, so never drop someone past the upload step.
                    goTo({ step: Math.min(target, 2), q: 1 });
                  }}
                >
                  Continue application
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      localStorage.removeItem(draftKey);
                    } catch { /* ignore */ }
                    setForm(EMPTY_FORM);
                    setAnswers({});
                    setNetwork(false);
                    setDraftSavedAt(null);
                    setResume(null);
                    goTo({ step: 1, q: 1 });
                  }}
                >
                  Start over
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div
          data-apply-form
          aria-busy={submitting}
          className={`mt-8 rounded-lg border bg-card p-5 md:p-6 ${
            submitting ? "pointer-events-none select-none opacity-60" : ""
          }`}
        >
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
                    autoComplete="email" inputMode="email"
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
                    autoComplete="tel" inputMode="tel"
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
              {pos.locations.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Hiring locations
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pos.locations.map((l, i) => {
                      const titleCase = (s: string) => 
                        s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                      const location = [l.city, l.region, l.country]
                        .filter((p): p is string => !!p)
                        .map(titleCase)
                        .join(", ");
                      
                      return (
                        <Badge key={i} variant="secondary" className="font-normal bg-background/50">
                          {location}
                          {l.work_model ? ` · ${l.work_model}` : ""}
                          {l.headcount && l.headcount > 1 ? ` · ${l.headcount} hires` : ""}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mt-4">
                {/* Rules first, in plain text with no error styling, so nothing
                    arrives as a surprise after a failed attempt. */}
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Before you pick a file</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    <li>PDF only — Word, Pages, images and text files are not accepted</li>
                    <li>Maximum size 10 MB</li>
                    <li>No password-protected PDFs — upload an unlocked copy</li>
                    <li>Stored securely; only the hiring team can open it</li>
                  </ul>
                </div>

                <Label htmlFor="cv" className="mt-4 block">CV file (PDF, max 10 MB) *</Label>
                <Input
                  id="cv"
                  ref={cvInputRef}
                  type="file"
                  data-field="cv"
                  accept="application/pdf,.pdf"
                  aria-describedby="cv-help"
                  className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                  disabled={cvChecking}
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <p id="cv-help" className="mt-1 text-xs text-muted-foreground">
                  Opens your phone's file picker — Files, Drive and iCloud all work.
                </p>

                {/* Screen-reader announcements: filename, outcome, cancellation. */}
                <p className="sr-only" role="status" aria-live="polite">{cvStatus}</p>

                {cvChecking && (
                  <div className="mt-3 rounded-lg border p-3">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={cvProgress}
                      aria-label="Reading your CV"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(4, cvProgress)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Checking your file — {cvProgress}% read.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={cancelCvCheck}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {cvError ? (
                  <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{cvError}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => cvInputRef.current?.click()}
                      >
                        Choose another file
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Everything else you've filled in is kept.
                      </span>
                    </div>
                  </div>
                ) : fieldErrors.cv ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.cv}</p>
                ) : null}

                {cvFile && !cvError && !cvChecking && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cvFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        PDF · {formatFileSize(cvFile.size)} · ready to send
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => cvInputRef.current?.click()}
                      >
                        Replace
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={clearCv}>
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>


              <div className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Optional extras</h3>
                  <p className="text-xs text-muted-foreground">
                    Only add what's relevant — none of these are required.
                  </p>
                </div>
                <div>
                  <Label htmlFor="cover_letter">
                    Cover note{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <p id="cover_letter-help" className="text-xs text-muted-foreground">
                    In two or three sentences, what makes this role a fit for you? Skip it
                    if you'd rather — it never blocks your application.
                  </p>
                  <Textarea
                    id="cover_letter"
                    rows={4}
                    data-field="cover_letter"
                    aria-describedby="cover_letter-help cover_letter-count"
                    maxLength={COVER_NOTE_MAX}
                    placeholder="In two or three sentences, what makes this role a fit for you?"
                    className="mt-1 max-h-[40vh] min-h-[6.5rem] resize-none overflow-y-auto"
                    value={form.cover_letter}
                    onChange={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
                      setForm({ ...form, cover_letter: e.target.value });
                    }}
                  />
                  <p
                    id="cover_letter-count"
                    aria-live="polite"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {form.cover_letter.length === 0
                      ? `Up to ${COVER_NOTE_MAX.toLocaleString()} characters. A few sentences is plenty.`
                      : `${form.cover_letter.length.toLocaleString()} of ${COVER_NOTE_MAX.toLocaleString()} characters`}
                  </p>
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
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
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
                    const reason = (q as { why_asked?: string | null }).why_asked?.trim();
                    const isFreeText =
                      q.answer_type === "long_text" || q.answer_type === "text";
                    const used = typeof val === "string" ? val.length : 0;
                    return (
                      <fieldset key={q.id} className="space-y-1 border-0 p-0 m-0">
                        <legend className="sr-only">{q.question}</legend>
                        <Label htmlFor={q.id}>
                          {q.question}
                          {q.required && " *"}
                        </Label>
                        {reason && (
                          <p id={`${q.id}-why`} className="text-xs text-muted-foreground">
                            Why we ask: {reason}
                          </p>
                        )}
                        {q.answer_type === "long_text" ? (
                          <Textarea
                            id={q.id}
                            aria-describedby={reason ? `${q.id}-why` : undefined}
                            maxLength={SCREENING_ANSWER_MAX}
                            value={(val as string) ?? ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            rows={4}
                          />
                        ) : q.answer_type === "boolean" ? (
                          <RadioGroup
                            id={q.id}
                            aria-describedby={reason ? `${q.id}-why` : undefined}
                            value={val === true ? "yes" : val === false ? "no" : ""}
                            onValueChange={(v) => setAnswer(q.id, v === "yes")}
                            className="flex gap-4 mt-1"
                          >
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                              <RadioGroupItem value="yes" id={`${q.id}-y`} /> Yes
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                              <RadioGroupItem value="no" id={`${q.id}-n`} /> No
                            </label>
                          </RadioGroup>
                        ) : q.answer_type === "number" ? (
                          <Input
                            id={q.id}
                            type="number"
                            inputMode="decimal"
                            aria-describedby={reason ? `${q.id}-why` : undefined}
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
                            aria-describedby={reason ? `${q.id}-why` : undefined}
                            maxLength={SCREENING_ANSWER_MAX}
                            value={(val as string) ?? ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                          />
                        )}
                        {isFreeText && used > SCREENING_ANSWER_MAX - 60 && (
                          <p className="text-xs text-muted-foreground">
                            {SCREENING_ANSWER_MAX - used} characters left — a sentence or
                            two is enough.
                          </p>
                        )}
                        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                      </fieldset>
                    );
                  })}

                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Consent &amp; privacy</h2>
                <p className="text-sm text-muted-foreground">
                  Two consents, then a full review of everything you entered.
                </p>
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
                    data-field="consent"
                    aria-label="I agree to the terms"

                  />
                  <span>
                    I agree that TaaSFlow may share my CV and answers with the hiring team for
                    this role, keep them to review this application, and contact me about it.
                    Nothing is shared with any other employer without my say-so, and I can ask
                    for my data to be deleted at any time. *
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
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Review &amp; submit</h2>
                <p className="text-sm text-muted-foreground">
                  Check your email address carefully — every update about{" "}
                  <span className="font-medium">{pos.title}</span> at{" "}
                  <span className="font-medium">{pos.organization_name}</span> goes there.
                </p>
              </div>

              {signedIn === null ? (
                <ReviewSkeleton />
              ) : (
                <div className="space-y-3">
                  <ReviewSection
                    title="Your details"
                    editLabel="details"
                    onEdit={() => editSection(1, "email")}
                  >
                    <ReviewRow label="Name" value={form.full_name.trim()} />
                    <ReviewRow label="Email" value={form.email.trim()} />
                    <ReviewRow label="Phone" value={form.phone.trim()} />
                    <ReviewRow
                      label="Location"
                      value={composeLocation({
                        city: form.city,
                        region: form.region,
                        country: form.country,
                      })}
                    />
                  </ReviewSection>

                  <ReviewSection
                    title="CV and links"
                    editLabel="cv"
                    onEdit={() => editSection(2, "cv")}
                  >
                    <ReviewRow
                      label="CV file"
                      value={
                        cvFile
                          ? `${cvFile.name} · ${formatFileSize(cvFile.size)}`
                          : "Not attached yet"
                      }
                    />
                    {form.linkedin_url.trim() && (
                      <ReviewRow label="LinkedIn" value={form.linkedin_url.trim()} />
                    )}
                    {form.portfolio_url.trim() && (
                      <ReviewRow label="Portfolio" value={form.portfolio_url.trim()} />
                    )}
                    {form.website_url.trim() && (
                      <ReviewRow label="Website" value={form.website_url.trim()} />
                    )}
                    {form.cover_letter.trim() && (
                      <ReviewRow label="Cover note" value={form.cover_letter.trim()} />
                    )}
                  </ReviewSection>

                  {answeredQuestions.length > 0 && (
                    <ReviewSection
                      title="Screening answers"
                      editLabel="screening"
                      onEdit={() => editSection(3, pos.questions[0]?.id ?? "")}
                    >
                      {answeredQuestions.map((a) => (
                        <ReviewRow key={a.id} label={a.question} value={a.value} />
                      ))}
                    </ReviewSection>
                  )}

                  <ReviewSection
                    title="Consent and privacy"
                    editLabel="consent"
                    onEdit={() => editSection(4, "consent")}
                  >
                    <ReviewRow
                      label="Terms and data sharing"
                      value={consent ? "Agreed" : "Not agreed yet"}
                    />
                    {network && <ReviewRow label="Talent network" value="Yes, add me" />}
                    {form.accommodation_request.trim() && (
                      <ReviewRow
                        label="Adjustments (private)"
                        value={form.accommodation_request.trim()}
                      />
                    )}
                  </ReviewSection>
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Submissions are final. We'll email you when there's a decision or a next step.
              </div>
            </div>
          )}

          <div
            className={`mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${
              step === 5
                ? "sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:px-0"
                : ""
            }`}
          >
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
                onClick={returningToReview ? returnToReview : goNext}
                data-testid={returningToReview ? "apply-return-to-review" : "apply-continue"}
                className="w-full sm:w-auto"
                disabled={cvChecking}
              >
                {returningToReview ? "Done — back to review" : "Continue →"}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={onSubmit}
                disabled={submitting}
                aria-disabled={submitting}
                aria-busy={submitting}
                data-testid="apply-submit"
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {phase === "reading" ? "Preparing your CV…" : "Sending…"}
                  </span>
                ) : (
                  "Submit application"
                )}
              </Button>
            )}
          </div>
          <p aria-live="assertive" className="sr-only">
            {submitting ? "Sending your application. Please wait." : ""}
          </p>


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

/** One value the candidate entered. Never rendered for a skipped field. */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
        {value}
      </div>
    </div>
  );
}

/**
 * A named group of entered values with its own edit link. The heading is a real
 * heading so a screen reader can jump between sections instead of reading the
 * whole summary top to bottom.
 */
function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          data-testid={`review-edit-${editLabel}`}
          className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary underline underline-offset-2"
        >
          Edit<span className="sr-only"> {title}</span>
        </button>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-3" data-testid="review-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-md border p-4">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

