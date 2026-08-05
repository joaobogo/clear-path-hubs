import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, FileText } from "lucide-react";
import { replaceApplicationCv } from "@/lib/apply.functions";
import type { ExistingApplicationSummary } from "@/lib/candidate/existing-application.server";
import { ALLOWED_CV_EXT, MAX_CV_BYTES, fileExt } from "@/lib/apply-schema";
import { CV_MESSAGES } from "@/lib/cv-validation";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read_failed"));
    r.onload = () => resolve(String(r.result ?? ""));
    r.readAsDataURL(file);
  });
}

export function ReturningApplicantSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 md:p-8" aria-busy="true">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-6 h-11 w-full animate-pulse rounded bg-muted" />
      <span className="sr-only">Loading your existing application…</span>
    </div>
  );
}

/**
 * Shown when someone applies to a role they have already applied to.
 * It is not an error: it tells them their first application is fine, when it
 * was sent, where it stands, its reference, and offers a CV replacement
 * instead of a dead end. Only their own application is disclosed.
 */
export function ReturningApplicantCard({
  existing,
  email,
  positionTitle,
}: {
  existing: ExistingApplicationSummary;
  email: string;
  positionTitle: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_CV_EXT.includes(fileExt(f.name))) {
      setError(CV_MESSAGES.wrong_type);
      setFile(null);
      return;
    }
    if (f.size > MAX_CV_BYTES) {
      setError(CV_MESSAGES.too_large);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const send = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const base64 = await readAsBase64(file);
      const res = await replaceApplicationCv({
        data: {
          application_id: existing.application_id,
          email,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          base64,
        },
      });
      if (res.ok) {
        setReplaced(res.filename);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(res.message);
      }
    } catch {
      setError(
        `We couldn't upload that file. Your existing application is unaffected — email ${SUPPORT_EMAIL} if this keeps happening.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full rounded-lg border bg-card p-6 md:p-8" data-testid="returning-applicant">
      <h1 className="text-2xl font-semibold tracking-tight">
        You already applied to this role — you&apos;re all set
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing went wrong, and you don&apos;t need to apply again. Here is the application we
        already have for {positionTitle}.
      </p>

      <dl className="mt-6 divide-y rounded-md border">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
          <dt className="text-sm text-muted-foreground">Applied on</dt>
          <dd className="text-sm font-medium" data-testid="returning-applied-at">
            {fmtDate(existing.applied_at)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
          <dt className="text-sm text-muted-foreground">Where it stands</dt>
          <dd className="text-sm font-medium" data-testid="returning-status">
            {existing.status_label}
          </dd>
        </div>
        <div className="p-4 text-sm text-muted-foreground">{existing.status_happening}</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
          <dt className="text-sm text-muted-foreground">Your reference</dt>
          <dd className="font-mono text-sm font-medium" data-testid="returning-reference">
            {existing.reference}
          </dd>
        </div>
        {existing.cv_filename ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <dt className="text-sm text-muted-foreground">CV on file</dt>
            <dd className="flex items-center gap-2 text-sm font-medium">
              <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              {existing.cv_filename}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6">
        <Button asChild className="w-full min-h-11" size="lg">
          <Link to={existing.tracking_path}>Track this application</Link>
        </Button>
      </div>

      {existing.can_replace_cv ? (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-base font-semibold">Send a newer CV instead</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            If your CV has changed, replace it on this application. PDF only, up to 10MB. No new
            application is created.
          </p>

          {replaced ? (
            <Alert className="mt-4" role="status">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>
                We&apos;ve replaced your CV with {replaced}. Your reference stays{" "}
                {existing.reference}.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium" htmlFor="replacement-cv">
                Replacement CV
              </label>
              <input
                accept="application/pdf,.pdf"
                className="block w-full min-h-11 rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                id="replacement-cv"
                onChange={(e) => pick(e.currentTarget.files?.[0] ?? null)}
                ref={inputRef}
                type="file"
              />
              <Button
                aria-busy={busy}
                className="w-full min-h-11"
                disabled={!file || busy}
                onClick={send}
                variant="secondary"
              >
                {busy ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Replacing your CV…
                  </>
                ) : (
                  "Replace my CV"
                )}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <Alert className="mt-4" role="alert" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="mt-6 text-sm text-muted-foreground">
        Something look wrong? Email{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        with your reference and a person will pick it up.
      </p>
    </div>
  );
}
