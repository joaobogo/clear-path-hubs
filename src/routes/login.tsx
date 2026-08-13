import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { FormShell } from "@/components/marketing/form-shell";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import {
  getSessionContext,
  getQaPersonaConfig,
  qaPersonaLogin,
  provisionClientMembershipForSelf,
  assertVerifiedSession,
} from "@/lib/auth.functions";
import {
  landingPathForRole,
  type MembershipRole,
  type SessionMembership,
} from "@/lib/roles";

import { sanitizeRedirect } from "@/lib/safe-redirect";

const searchSchema = z.object({ redirect: z.string().optional() });

const QA_DISABLED = { enabled: false, personas: [] as Array<{ key: Persona; label: string }> };
type Persona =
  | "platform_admin"
  | "operations"
  | "client_admin"
  | "client_editor"
  | "client_viewer";

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  ssr: false,
  // No loader here on purpose. The QA persona list is a convenience and is
  // fetched from the component after mount, so a slow or unauthorised call can
  // never hold the sign-in form behind a pending state.
  head: () => ({
    meta: [
      { title: "Sign in — TaaSFlow" },
      { name: "description", content: "Sign in to your TaaSFlow account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — TaaSFlow" },
      { property: "og:description", content: "Sign in to your TaaSFlow account." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://taasflow.com/login" },
    ],
    links: [{ rel: "canonical", href: "https://taasflow.com/login" }],
  }),
  component: LoginPage,
  pendingComponent: LoginFallback,
  errorComponent: LoginFallback,
  notFoundComponent: makeRouteNotFoundComponent("public"),
});

/**
 * Never show a blank screen on /login. While the route resolves — or if it
 * fails outright — render the same shell with a working recovery path.
 */
export function LoginFallback() {
  return (
    <FormShell exitTo="/" exitLabel="Exit" width="sm">
      <Card className="w-full space-y-3 p-6">
        <h1 className="text-xl font-semibold">Sign in to TaaSFlow</h1>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Loading the sign-in form…
        </p>
        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Link to="/" className="block text-xs text-muted-foreground hover:underline">
          ← Back home
        </Link>
      </Card>
    </FormShell>
  );
}


// Generic messages — never disclose whether an email exists.
const GENERIC_SIGNIN_ERROR = "Email or password is incorrect.";
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";
const GENERIC_CONFIRM_MESSAGE =
  "If that email needs confirming, we've sent a new confirmation link. It's valid for 24 hours.";


function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [qa, setQa] = useState<{
    enabled: boolean;
    personas: Array<{ key: Persona; label: string }>;
  }>(QA_DISABLED);
  const loadQa = useServerFn(getQaPersonaConfig);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await loadQa();
        if (!cancelled) setQa(cfg);
      } catch {
        /* QA personas are optional — stay disabled */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const runPersona = useServerFn(qaPersonaLogin);
  const runSession = useServerFn(getSessionContext);
  const runProvision = useServerFn(provisionClientMembershipForSelf);
  const runVerify = useServerFn(assertVerifiedSession);

  /**
   * A session alone is not a successful sign-in. The provider (Google
   * included) can return a session for an address it never confirmed, so we
   * check verification server-side and end the session when it fails.
   * Returns true only when the caller may continue.
   */
  const ensureVerified = async (): Promise<boolean> => {
    let result: Awaited<ReturnType<typeof assertVerifiedSession>>;
    try {
      result = await runVerify();
    } catch {
      await supabase.auth.signOut();
      toast.error("We couldn't confirm your account. Please try signing in again.");
      return false;
    }
    if (!result.verified) {
      await supabase.auth.signOut();
      toast.error(
        result.provider === "email"
          ? "Confirm your email address first — check your inbox for the confirmation link."
          : "Your Google account's email address isn't verified. Verify it with Google, then sign in again.",
      );
      setMode("confirm");
      return false;
    }
    if (!result.active) {
      await supabase.auth.signOut();
      toast.error("This account is no longer active. Contact your workspace admin.");
      return false;
    }
    return true;
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot" | "confirm">("signin");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pickerFor, setPickerFor] = useState<SessionMembership[] | null>(null);

  // Google sign-in. Same managed provider used at sign-up, so anyone who
  // created their account with Google can get back in the same way.
  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const safe = sanitizeRedirect(redirect);
      const returnTo = `${window.location.origin}/login${
        safe ? `?redirect=${encodeURIComponent(safe)}` : ""
      }`;
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: returnTo });
      if (result.error) {
        toast.error("Google sign-in didn't complete. Try again or use your email and password.");
        return;
      }
      if (result.redirected) return;
      if (!(await ensureVerified())) return;
      // Popup flow: the session is already set — reload so the signed-in
      // routing effect picks the right destination.
      window.location.href = returnTo;
    } catch {
      toast.error("Google sign-in didn't complete. Try again or use your email and password.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Already signed in? Route accordingly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      if (!(await ensureVerified())) return;
      if (cancelled) return;
      try {
        let ctx = await runSession();
        // If the user has no memberships yet (e.g. just accepted an invite by
        // clicking the email link), try to activate any invited memberships or
        // attach staff to the platform org. Never provisions new workspaces.
        if (!ctx.primary_role && ctx.memberships.length === 0) {
          try {
            await runProvision({ data: {} });
            ctx = await runSession();
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        routeToDest(ctx.memberships, ctx.primary_role);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function routeToDest(mems: SessionMembership[], primary: MembershipRole | null) {
    const dest = sanitizeRedirect(redirect);
    if (dest) {
      window.location.assign(dest);
      return;
    }
    const active = mems.filter((m) => m.status === "active");
    if (primary === "candidate") {
      window.location.assign("/me");
      return;
    }
    if (active.length === 0) {
      navigate({ to: "/access-denied" });
      return;
    }
    const clientOrgs = active.filter(
      (m) => m.role === "client_admin" || m.role === "client_editor" || m.role === "client_viewer",
    );
    if (primary === "client_admin" || primary === "client_editor" || primary === "client_viewer") {
      if (clientOrgs.length > 1) {
        setPickerFor(clientOrgs);
        return;
      }
      const org = clientOrgs[0];
      navigate({ to: "/client", search: org?.organization_id ? { org: org.organization_id } : {} });
      return;
    }
    window.location.assign(landingPathForRole(primary));
  }

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(GENERIC_SIGNIN_ERROR);
        return;
      }
      if (!(await ensureVerified())) return;
      const ctx = await runSession();
      // Best-effort membership activation for freshly-invited users.
      if (!ctx.primary_role && ctx.memberships.length === 0) {
        try {
          await runProvision({ data: {} });
        } catch {
          /* ignore */
        }
        const ctx2 = await runSession();
        routeToDest(ctx2.memberships, ctx2.primary_role);
        return;
      }
      routeToDest(ctx.memberships, ctx.primary_role);
    } catch {
      toast.error(GENERIC_SIGNIN_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      /* swallow — always return generic message */
    } finally {
      toast.success(GENERIC_RESET_MESSAGE);
      setMode("signin");
      setLoading(false);
    }
  };

  const onResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
    } catch {
      /* swallow — always return generic message */
    } finally {
      toast.success(GENERIC_CONFIRM_MESSAGE);
      setMode("signin");
      setLoading(false);
    }
  };


  const onPersona = async (
    key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer",
  ) => {
    setLoading(true);
    try {
      const { action_link } = await runPersona({ data: { persona: key } });
      window.location.href = action_link;
    } catch (err) {
      toastError(err, { fallback: "Persona login failed" });
      setLoading(false);
    }
  };

  return (
    <FormShell exitTo="/" exitLabel="Exit" width="sm">
      <div className="w-full space-y-4">
        <Card className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-semibold">
              {mode === "signin"
                ? "Sign in to TaaSFlow"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Resend your confirmation email"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in with the email your team invited."
                : mode === "forgot"
                  ? "We'll email you a secure reset link."
                  : "We'll send a new link to confirm your email address."}
            </p>
          </div>


          {pickerFor ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Choose a workspace</p>
              {pickerFor.map((m) => (
                <button
                  key={m.membership_id}
                  onClick={() =>
                    navigate({
                      to: "/client",
                      search: { org: m.organization_id ?? undefined },
                    })
                  }
                  className="w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{m.organization_name ?? "Workspace"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({m.role})</span>
                </button>
              ))}
            </div>
          ) : mode === "signin" ? (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={googleLoading || loading}
                onClick={onGoogle}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.8 2.7-2.3 3.8v3.2h3.7c2.2-2 3.5-5 3.5-8.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-3.2c-1 .7-2.4 1.2-4.2 1.2-3.3 0-6-2.2-7-5.2H1.2v3.3C3.2 21.3 7.3 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5 13.9c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.2H1.2A12 12 0 0 0 0 11.7c0 1.9.5 3.8 1.2 5.5L5 13.9z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.7c1.8 0 3.4.6 4.6 1.8l3.3-3.2C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.2L5 9.5c1-3 3.7-4.8 7-4.8z"
                  />
                </svg>
                {googleLoading ? "Opening Google…" : "Continue with Google"}
              </Button>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  or use your email
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={onSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setMode("confirm")}
              >
                Didn't get your confirmation email?
              </button>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                TaaSFlow is invitation-only for client workspaces. If you were invited, use the
                email address on the invitation. Employers can{" "}
                <Link to="/intake" className="underline">
                  start an intake
                </Link>{" "}
                to talk to our team.
              </p>
              </form>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={onForgot} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="femail">Email</Label>
                <Input
                  id="femail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset email"}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setMode("signin")}
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={onResendConfirmation} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cemail">Email</Label>
                <Input
                  id="cemail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send a new confirmation link"}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Already confirmed? Nothing will be sent — just sign in as normal.
              </p>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setMode("signin")}
              >
                ← Back to sign in
              </button>
            </form>
          )}


          <Link to="/" className="block text-xs text-muted-foreground hover:underline">
            ← Back home
          </Link>
        </Card>

        {qa.enabled && qa.personas.length > 0 && (
          <Card className="p-4 border-dashed">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              QA persona access (non-production)
            </p>
            <div className="mt-2 grid gap-2">
              {qa.personas.map(
                (p: {
                  key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer";
                  label: string;
                }) => (
                  <Button
                    key={p.key}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => onPersona(p.key)}
                  >
                    Continue as {p.label}
                  </Button>
                ),
              )}
            </div>
          </Card>
        )}
      </div>
    </FormShell>
  );
}
