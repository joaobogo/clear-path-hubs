import { createFileRoute, Link } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BLUEPRINT_STAGES, MIN_ACCOUNT_PASSWORD } from "@/lib/express-intake-schema";
import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { DeliveryCommitmentBlock } from "@/components/client/delivery-commitment";
import { buildDeliveryCommitment, type StoredCommitment } from "@/lib/delivery-commitment";
import { KickoffBookingCard } from "@/components/booking/kickoff-booking-card";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/tracking/pixels";
import { trackDashboardSignup } from "@/lib/tracking/conversions";

const searchSchema = z.object({
  intake_id: fallback(z.string().uuid().optional(), undefined),
  pending_id: fallback(z.string().uuid().optional(), undefined),
});

type StatusBody = {
  ok: boolean;
  intakeId: string;
  companyName: string;
  roleTitle: string;
  positionId: string | null;
  workspaceStatus: string | null;
  blueprintStatus: string;
  blueprintFailed: boolean;
  summary: { mustHaves: number; screeningQuestions: number; confidence: number } | null;
  commitment: StoredCommitment | null;
  contactName: string | null;
  createdAt: string;
};

type PendingContext = {
  email?: string;
  companyName?: string;
  roleTitle?: string;
};

export const Route = createFileRoute("/intake_/confirmation")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Role brief received — TaaSFlow" },
      {
        name: "description",
        content: "Your role brief is safe. Secure the workspace with the same work email, then TaaSFlow prepares the role blueprint.",
      },
      { property: "og:title", content: "Role brief received — TaaSFlow" },
      {
        property: "og:description",
        content: "Your role brief is safe. Account setup comes after submission, not before it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { intake_id, pending_id } = Route.useSearch();

  if (pending_id && !intake_id) {
    return <PendingAccountSetup pendingId={pending_id} />;
  }

  return <WorkspacePreparation intakeId={intake_id} />;
}

function PendingAccountSetup({ pendingId }: { pendingId: string }) {
  const [context, setContext] = useState<PendingContext>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`tf_pending_intake_${pendingId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingContext;
      setContext(parsed);
      if (parsed.email) setEmail(parsed.email);
    } catch {
      /* A refreshed page can simply ask for the same work email again. */
    }
  }, [pendingId]);

  async function finalizeWorkspace() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("We could not verify the signed-in session.");

    const pendingRes = await fetch(`/api/public/pending-intake/${pendingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pending = await pendingRes.json();
    if (!pendingRes.ok || !pending?.ok) {
      throw new Error(
        pending?.message ??
          (pending?.error === "email_mismatch"
            ? "Sign in with the same work email you used for the role brief."
            : "We could not reopen the saved role brief."),
      );
    }

    if (pending.status === "finalized" && pending.finalizedIntakeId) {
      window.location.replace(
        `/intake/confirmation?intake_id=${encodeURIComponent(pending.finalizedIntakeId)}`,
      );
      return;
    }

    const finalRes = await fetch("/api/public/express-intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pending.payload),
    });
    const finalBody = await finalRes.json();
    if (!finalRes.ok || !finalBody?.ok || !finalBody.intakeId) {
      throw new Error(
        finalBody?.message ??
          "Your account is secure, but we could not activate the workspace yet. Your role brief is still saved.",
      );
    }

    await fetch(`/api/public/pending-intake/${pendingId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "finalized", intakeId: finalBody.intakeId }),
    }).catch(() => undefined);

    try {
      sessionStorage.removeItem(`tf_pending_intake_${pendingId}`);
    } catch {
      /* no-op */
    }

    trackEvent("role_created", { flow: "post_submit_account_setup" });
    window.location.replace(
      `/intake/confirmation?intake_id=${encodeURIComponent(finalBody.intakeId)}`,
    );
  }

  async function submitAccount() {
    const cleanEmail = email.trim().toLowerCase();
    setMessage(null);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setMessage("Use the same valid work email you submitted with the role.");
      return;
    }
    if (password.length < MIN_ACCOUNT_PASSWORD) {
      setMessage(`Use at least ${MIN_ACCOUNT_PASSWORD} characters for your password.`);
      return;
    }
    if (mode === "create" && password !== confirmPassword) {
      setMessage("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      let createdNow = false;
      if (mode === "create") {
        const createRes = await fetch("/api/public/intake-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "create",
            email: cleanEmail,
            password,
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok || !created?.ok) {
          if (created?.error === "account_exists") {
            setMode("signin");
            setMessage("That email already has an account. Enter its password and sign in — your role brief is still safe.");
            return;
          }
          throw new Error(created?.message ?? "We could not create the account.");
        }
        createdNow = true;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) {
        throw new Error(
          mode === "signin"
            ? "That email and password do not match. Try again or use the password reset from Sign in."
            : "The account was created, but we could not sign you in. Try signing in with the password you just chose.",
        );
      }

      if (createdNow) {
        trackEvent("account_created_after_intake", { flow: "post_submit_account_setup" });
        trackDashboardSignup({ method: "email_password", plan: "pilot" });
      }

      await finalizeWorkspace();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong. Your role brief is still saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell exitTo="/" exitLabel="Back to home" width="md" eyebrow="Role brief received">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Your role is in. Now secure the workspace.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-950">The conversion is already complete.</p>
            <p className="mt-1 text-emerald-950/80">
              {context.roleTitle ? <strong>{context.roleTitle}</strong> : "Your role brief"}{" "}
              {context.companyName ? <>for <strong>{context.companyName}</strong></> : null} has been safely received.
              You will not have to type it again.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Create your secure workspace account" : "Sign in to your existing account"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Use the same work email from the role brief. Once authenticated, we attach the saved brief to your workspace and start preparing it.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pending-email">Work email</Label>
              <Input
                id="pending-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pending-password">
                {mode === "create" ? "Choose a password" : "Password"}
              </Label>
              <Input
                id="pending-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                className="mt-1.5"
              />
              {mode === "create" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  At least {MIN_ACCOUNT_PASSWORD} characters.
                </p>
              )}
            </div>
            {mode === "create" && (
              <div>
                <Label htmlFor="pending-confirm">Confirm password</Label>
                <Input
                  id="pending-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1.5"
                />
              </div>
            )}
          </div>

          {message && (
            <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
              {message}
            </p>
          )}

          <Button type="button" onClick={() => void submitAccount()} disabled={busy} className="w-full min-h-11">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Securing your workspace…
              </>
            ) : mode === "create" ? (
              "Create account and activate workspace"
            ) : (
              "Sign in and activate workspace"
            )}
          </Button>

          <button
            type="button"
            className="text-sm underline text-muted-foreground"
            onClick={() => {
              setMode((m) => (m === "create" ? "signin" : "create"));
              setMessage(null);
              setConfirmPassword("");
            }}
          >
            {mode === "create" ? "I already have a TaaSFlow account" : "I need to create an account"}
          </button>

          <p className="text-xs text-muted-foreground">
            Your saved brief remains on file even if you leave this page. Account setup controls access to the workspace; it no longer blocks the initial submission.
          </p>
        </CardContent>
      </Card>
    </FormShell>
  );
}

function WorkspacePreparation({ intakeId }: { intakeId?: string }) {
  const [status, setStatus] = useState<StatusBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(intakeId));
  const retriedRef = useRef(false);

  useEffect(() => {
    if (!intakeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(`/api/public/blueprint-status/${intakeId}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body?.ok) {
          setError(body?.error || "lookup_failed");
        } else {
          setError(null);
          setStatus(body as StatusBody);
          const done = body.blueprintStatus === "ready" || body.blueprintStatus === "failed";
          if (!done && body.blueprintStatus === "queued" && !retriedRef.current) {
            retriedRef.current = true;
            void fetch("/api/public/blueprint-run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ intakeId }),
            }).catch(() => undefined);
          }
          if (!done) timer = setTimeout(load, 4000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "network_error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intakeId]);

  const stageIndex = status
    ? BLUEPRINT_STAGES.findIndex((stage) => stage.key === status.blueprintStatus)
    : -1;
  const ready = status?.blueprintStatus === "ready";
  const failed = status?.blueprintFailed === true;

  return (
    <FormShell exitTo="/" exitLabel="Back to home" width="md" eyebrow="Your workspace is live">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {ready
              ? "Your role blueprint is ready"
              : failed
                ? "Your role is saved — a specialist is finishing the brief"
                : "Preparing your role"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {!intakeId && (
            <p className="text-muted-foreground">
              We did not receive a submission reference. If you just submitted and see this page, email{" "}
              <a className="underline" href="mailto:hello@taasflow.com">hello@taasflow.com</a>.
            </p>
          )}

          {intakeId && loading && !status && (
            <>
              <p className="text-muted-foreground">Loading status…</p>
              <DeliveryCommitmentBlock commitment={null} loading />
            </>
          )}

          {intakeId && error && !status && (
            <>
              <p className="text-destructive">We could not load your status ({error}).</p>
              <DeliveryCommitmentBlock commitment={null} reference={intakeId} datesFollowByEmail />
              <p className="text-muted-foreground">
                Email <a className="underline" href="mailto:hello@taasflow.com">hello@taasflow.com</a> and include your reference.
              </p>
            </>
          )}

          {status && (
            <>
              <p>
                <strong>{status.roleTitle}</strong> is live in the {status.companyName} workspace. You can
                open it right now — we will keep filling in the details.
              </p>

              <DeliveryCommitmentBlock
                commitment={buildDeliveryCommitment({
                  commitment: status.commitment,
                  positionId: status.positionId,
                  contactName: status.contactName,
                })}
                reference={status.intakeId}
              />

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {failed ? "Handed to a TaaSFlow specialist" : "System progress"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {ready
                      ? "All stages complete"
                      : stageIndex > -1
                        ? `Stage ${stageIndex + 1} of ${BLUEPRINT_STAGES.length}`
                        : "Queued"}
                  </span>
                </div>
                <ol className="flex gap-1.5" aria-hidden>
                  {BLUEPRINT_STAGES.map((stage, i) => (
                    <li
                      key={`bar-${stage.key}`}
                      className={
                        "h-1.5 flex-1 rounded-full " +
                        (ready || (stageIndex > -1 && i < stageIndex)
                          ? "bg-primary"
                          : !ready && !failed && i === stageIndex
                            ? "bg-primary/50"
                            : "bg-muted")
                      }
                    />
                  ))}
                </ol>
                <ol className="space-y-2">
                  {BLUEPRINT_STAGES.map((stage, i) => {
                    const complete = ready || (stageIndex > -1 && i < stageIndex);
                    const active = !ready && !failed && i === stageIndex;
                    return (
                      <li key={stage.key} className="flex items-start gap-2">
                        {complete ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        ) : active ? (
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-foreground" aria-hidden />
                        ) : failed ? (
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                        ) : (
                          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className={complete || active ? "text-foreground" : "text-muted-foreground"}>
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {failed && (
                  <p className="text-muted-foreground">
                    We could not finish the automated brief from what was provided. Your role and job
                    description are safe — a TaaSFlow specialist is completing it, and you can edit every
                    field yourself in the meantime.
                  </p>
                )}
              </div>

              {ready && status.summary && (
                <dl className="grid grid-cols-3 gap-3 rounded-lg border p-4 text-center">
                  <div>
                    <dt className="text-xs text-muted-foreground">Must-haves</dt>
                    <dd className="text-lg font-semibold">{status.summary.mustHaves}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Screening questions</dt>
                    <dd className="text-lg font-semibold">{status.summary.screeningQuestions}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Confidence</dt>
                    <dd className="text-lg font-semibold">{Math.round(status.summary.confidence * 100)}%</dd>
                  </div>
                </dl>
              )}

              <p className="text-muted-foreground">
                We have emailed {ready ? "your blueprint summary" : "your workspace details"} to the address
                you used. Every generated answer is editable by you and by our team.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {status.positionId ? (
                  <Button asChild>
                    <Link to="/client/positions/$id" params={{ id: status.positionId }}>Open the role</Link>
                  </Button>
                ) : (
                  <Button asChild><Link to="/client">Open your workspace</Link></Button>
                )}
                {intakeId && (
                  <Button asChild variant="outline">
                    <Link to="/intake" search={{ carry: intakeId }}>Add another role</Link>
                  </Button>
                )}
                <Button asChild variant="outline"><a href="/">Back to home</a></Button>
              </div>
            </>
          )}

          {!status && (
            <div className="pt-2">
              <Button asChild variant="outline"><a href="/">Back to home</a></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {intakeId && status && (
        <div className="mt-4">
          <KickoffBookingCard
            intakeId={intakeId}
            positionId={status.positionId}
            roleTitle={status.roleTitle}
          />
        </div>
      )}
    </FormShell>
  );
}
