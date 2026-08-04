import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { FormShell } from "@/components/marketing/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  lookupApplicationStatus,
  respondToInfoRequest,
  statusLookupSchema,
  withdrawMyApplication,
  type PublicApplicationStatus,
} from "@/lib/apply-status.functions";
import {
  getMyApplicationDetails,
  requestMyDataDeletion,
  updateMyApplication,
  type CandidateEditableDetails,
} from "@/lib/candidate-self-service.functions";
import { ManageApplication } from "@/components/candidate/manage-application";
import { CandidateStatePanel } from "@/components/candidate/candidate-state-panel";
import { TransparencyPanel } from "@/components/candidate/transparency-panel";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";

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
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const refresh = async (creds: { reference: string; email: string }) => {
    setResult(await lookupApplicationStatus({ data: creds }));
  };

  const submitReply = async (requestId: string) => {
    if (!verified) return;
    const response = (replies[requestId] ?? "").trim();
    if (!response) return;
    setBusy(requestId);
    setActionMessage(null);
    try {
      const r = await respondToInfoRequest({ data: { ...verified, requestId, response } });
      setActionMessage(r.message);
      if (r.ok) {
        setReplies((p) => ({ ...p, [requestId]: "" }));
        await refresh(verified);
      }
    } catch {
      setActionMessage(`We couldn't send that reply. Please email ${SUPPORT_EMAIL}.`);
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!verified) return;
    if (!confirmWithdraw) {
      setConfirmWithdraw(true);
      return;
    }
    setBusy("withdraw");
    setActionMessage(null);
    try {
      const r = await withdrawMyApplication({ data: verified });
      setActionMessage(r.message);
      if (r.ok) await refresh(verified);
    } catch {
      setActionMessage(`We couldn't withdraw it just now. Please email ${SUPPORT_EMAIL}.`);
    } finally {
      setBusy(null);
      setConfirmWithdraw(false);
    }
  };


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
        <div className="mt-6 space-y-6">
          <div className="rounded-lg border bg-card p-5 sm:p-6">
            <div className="text-sm text-muted-foreground">
              {result.position_title ?? "Your application"}
              {result.organization_name ? ` · ${result.organization_name}` : ""}
            </div>
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
          </div>

          <CandidateStatePanel
            state={result.state}
            lastUpdate={result.last_update}
            nextInterviewAt={result.next_interview_at}
          />

          {verified && result.open_requests.length > 0 && (
            <section className="rounded-lg border taas-bg-warning-soft p-5 sm:p-6">
              <h2 className="text-base font-semibold">The team asked you something</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Answer in your own words. Your reply goes to the TaaSFlow review team, not to the
                employer directly.
              </p>
              <div className="mt-4 space-y-4">
                {result.open_requests.map((r) => (
                  <div key={r.id} className="rounded-md border bg-card p-4">
                    <p className="text-sm font-medium">{r.prompt}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Asked {new Date(r.created_at).toLocaleDateString()}
                      {r.due_at ? ` · reply by ${new Date(r.due_at).toLocaleDateString()}` : ""}
                    </p>
                    {r.expired ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        This request has expired. Email{" "}
                        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                          {SUPPORT_EMAIL}
                        </a>{" "}
                        with your reference and we&apos;ll pick it up.
                      </p>
                    ) : (
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitReply(r.id);
                        }}
                      >
                        <Label htmlFor={`reply-${r.id}`} className="sr-only">
                          Your reply
                        </Label>
                        <Textarea
                          id={`reply-${r.id}`}
                          rows={4}
                          maxLength={4000}
                          required
                          value={replies[r.id] ?? ""}
                          placeholder="Type your reply…"
                          onChange={(e) =>
                            setReplies((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="min-h-11"
                          disabled={busy === r.id || !(replies[r.id] ?? "").trim()}
                        >
                          {busy === r.id ? "Sending…" : "Send reply"}
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {actionMessage && (
            <Alert>
              <AlertDescription>{actionMessage}</AlertDescription>
            </Alert>
          )}

          <TransparencyPanel company={result.organization_name} />

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/jobs">Browse other roles</Link>
            </Button>
            {verified && result.can_withdraw && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy === "withdraw"}
                onClick={() => void withdraw()}
              >
                {busy === "withdraw"
                  ? "Withdrawing…"
                  : confirmWithdraw
                    ? "Confirm — withdraw my application"
                    : "Withdraw my application"}
              </Button>
            )}
          </div>
          {confirmWithdraw && (
            <p className="text-xs text-muted-foreground">
              Withdrawing stops the review for this role and tells the hiring team. Your profile
              stays with us for future roles unless you ask us to delete it.
            </p>
          )}
        </div>
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
