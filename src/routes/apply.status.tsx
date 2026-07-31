import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { FormShell } from "@/components/marketing/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  lookupApplicationStatus,
  statusLookupSchema,
  type PublicApplicationStatus,
} from "@/lib/apply-status.functions";
import {
  getMyApplicationDetails,
  requestMyDataDeletion,
  updateMyApplication,
  type CandidateEditableDetails,
} from "@/lib/candidate-self-service.functions";
import { ManageApplication } from "@/components/candidate/manage-application";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/apply/status")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Check your application status · TaaSFlow" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Enter your reference and email to see where your application stands.",
      },
      { property: "og:title", content: "Check your application status · TaaSFlow" },
      {
        property: "og:description",
        content: "Enter your reference and email to see where your application stands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  const { ref } = Route.useSearch();
  const [reference, setReference] = useState((ref ?? "").toUpperCase());
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<PublicApplicationStatus | null>(null);
  const [details, setDetails] = useState<CandidateEditableDetails | null>(null);
  const [verified, setVerified] = useState<{ reference: string; email: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotFound(false);
    const parsed = statusLookupSchema.safeParse({ reference, email });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fe[String(i.path[0])] = i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const data = await lookupApplicationStatus({ data: parsed.data });
      if (!data) setNotFound(true);
      setResult(data);
      if (data) {
        setVerified(parsed.data);
        setDetails(await getMyApplicationDetails({ data: parsed.data }));
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormShell exitTo="/jobs" exitLabel="← Open roles" width="md">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Check your application
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use the 6-character reference from your confirmation and the email you applied with. No
        account needed.
      </p>

      <form onSubmit={onSubmit} className="mt-6 rounded-lg border bg-card p-5 space-y-4">
        <div>
          <Label htmlFor="reference">Reference *</Label>
          <Input
            id="reference"
            value={reference}
            inputMode="text"
            autoCapitalize="characters"
            maxLength={6}
            placeholder="A1B2C3"
            className="font-mono tracking-widest"
            onChange={(e) => setReference(e.target.value.toUpperCase())}
          />
          {errors.reference && (
            <p className="mt-1 text-xs text-destructive">{errors.reference}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">Email you applied with *</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? "Checking…" : "Check status"}
        </Button>
      </form>

      {notFound && (
        <Alert className="mt-6">
          <AlertDescription>
            We couldn't match that reference and email. Check both against your confirmation email —
            or write to{" "}
            <a className="underline" href="mailto:hello@taasflow.com">
              hello@taasflow.com
            </a>{" "}
            and we'll find it for you.
          </AlertDescription>
        </Alert>
      )}

      {result && !notFound && (
        <section className="mt-6 rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">
            {result.position_title ?? "Your application"}
            {result.organization_name ? ` · ${result.organization_name}` : ""}
          </div>
          <h2 className="mt-1 text-xl font-semibold">{result.headline}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Applied {new Date(result.applied_at).toLocaleDateString()} · Reference{" "}
            <span className="font-mono">{result.reference}</span>
          </p>

          <ol className="mt-5 space-y-3">
            {result.steps.map((s) => (
              <li key={s.key} className="flex gap-3">
                <span
                  aria-hidden
                  className={
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full " +
                    (s.state === "done"
                      ? "bg-primary"
                      : s.state === "current"
                        ? "bg-primary ring-4 ring-primary/20"
                        : "bg-muted-foreground/30")
                  }
                />
                <div className="min-w-0">
                  <div
                    className={
                      "text-sm font-medium " +
                      (s.state === "upcoming" || s.state === "closed"
                        ? "text-muted-foreground"
                        : "")
                    }
                  >
                    {s.label}
                    {s.state === "current" && " — now"}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 rounded-md bg-muted px-4 py-3 text-sm">{result.next_note}</p>

          <p className="mt-4 text-xs text-muted-foreground">
            We show you where your application stands, not internal assessments. Your CV is only
            visible to our review team and the employer for this role.
          </p>

          <div className="mt-5">
            <Button asChild variant="outline">
              <Link to="/jobs">Browse other roles</Link>
            </Button>
          </div>
        </section>
      )}

      {result && verified && details && (
        <ManageApplication
          credentials={verified}
          details={details}
          onUpdated={async () => {
            setDetails(await getMyApplicationDetails({ data: verified }));
          }}
          updateFn={updateMyApplication}
          deleteFn={requestMyDataDeletion}
        />
      )}
    </FormShell>
  );
}
