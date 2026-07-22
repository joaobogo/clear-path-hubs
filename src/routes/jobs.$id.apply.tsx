import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicPosition } from "@/lib/jobs.functions";
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

export const Route = createFileRoute("/jobs/$id/apply")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["public-position", params.id],
      queryFn: () => getPublicPosition({ data: { id: params.id } }),
    });
    if (!data) throw notFound();
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

type Answer = { question_id: string; value: string | boolean | number | null };

function ApplyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: pos } = useSuspenseQuery({
    queryKey: ["public-position", id],
    queryFn: () => getPublicPosition({ data: { id } }),
  });

  const draftKey = APPLY_DRAFT_KEY(id);
  const idemKey = APPLY_IDEMPOTENCY_KEY(id);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer["value"]>>({});
  const [consent, setConsent] = useState(false);
  const [network, setNetwork] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; trace_id?: string } | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  // Autosave/restore draft (text fields + answers only, never the CV file).
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
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, answers, network }),
      );
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

  const setAnswer = (qid: string, v: Answer["value"]) =>
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setServerError(null);
    setFieldErrors({});

    if (!cvFile) {
      setCvError("Please attach your CV.");
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
      // Clear draft; keep idempotency key so retries dedupe.
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">TaaSFlow</Link>
          <Link
            to="/jobs/$id"
            params={{ id }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Role details
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-sm text-muted-foreground">{pos.organization_name}</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
          Apply — {pos.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Takes about 3 minutes. Your draft is saved as you type.
        </p>

        {serverError && (
          <Alert variant="destructive" className="mt-6">
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

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Full name *</Label>
              <Input
                id="full_name"
                autoComplete="name"
                required
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
                required
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                autoComplete="address-level2"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cv">CV *</Label>
            <Input
              id="cv"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOC, or DOCX. Up to 10 MB.
            </p>
            {cvError && <p className="mt-1 text-xs text-destructive">{cvError}</p>}
            {cvFile && !cvError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Attached: {cvFile.name} ({Math.ceil(cvFile.size / 1024)} KB)
              </p>
            )}
          </div>

          {pos.questions.length > 0 && (
            <fieldset className="space-y-4">
              <legend className="text-lg font-semibold">Screening questions</legend>
              {pos.questions.map((q) => {
                const errKey = `answers.${pos.questions.indexOf(q)}.value`;
                const err = fieldErrors[errKey];
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
                        required={q.required}
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
                        required={q.required}
                        value={val == null ? "" : String(val)}
                        onChange={(e) =>
                          setAnswer(q.id, e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    ) : (
                      <Input
                        id={q.id}
                        type="text"
                        required={q.required}
                        value={(val as string) ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    )}
                    {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}
            </fieldset>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                required
                aria-label="I agree to the terms"
              />
              <span>
                I agree to TaaSFlow's terms and privacy policy and consent to sharing my CV with the
                hiring team for this role. *
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
                Optional — also add me to the TaaSFlow talent network so recruiters can consider me
                for future matching roles.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
            <Link
              to="/jobs/$id"
              params={{ id }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
