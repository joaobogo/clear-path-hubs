import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import {
  getSessionContext,
  getQaPersonaConfig,
  qaPersonaLogin,
  provisionClientMembershipForSelf,
} from "@/lib/auth.functions";
import {
  landingPathForRole,
  type MembershipRole,
  type SessionMembership,
} from "@/lib/roles";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  ssr: false,
  loader: async () => await getQaPersonaConfig(),
  head: () => ({
    meta: [
      { title: "Sign in — TaaSFlow" },
      { name: "description", content: "Sign in to your TaaSFlow account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — TaaSFlow" },
      { property: "og:description", content: "Sign in to your TaaSFlow account." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LoginPage,
});

// Generic messages — never disclose whether an email exists.
const GENERIC_SIGNIN_ERROR = "Email or password is incorrect.";
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const qa = Route.useLoaderData();
  const runPersona = useServerFn(qaPersonaLogin);
  const runSession = useServerFn(getSessionContext);
  const runProvision = useServerFn(provisionClientMembershipForSelf);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [pickerFor, setPickerFor] = useState<SessionMembership[] | null>(null);

  // Already signed in? Route accordingly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
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
    if (redirect && redirect.startsWith("/")) {
      window.location.assign(redirect);
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

  const onPersona = async (
    key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer",
  ) => {
    setLoading(true);
    try {
      const { action_link } = await runPersona({ data: { persona: key } });
      window.location.href = action_link;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Persona login failed");
      setLoading(false);
    }
  };

  return (
    <FormShell exitTo="/" exitLabel="Exit" width="sm">
      <div className="w-full space-y-4">
        <Card className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-semibold">
              {mode === "signin" ? "Sign in to TaaSFlow" : "Reset your password"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in with the email your team invited or your candidate account."
                : "We'll email you a secure reset link."}
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
                <Link
                  to="/candidate-join"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Apply as a candidate →
                </Link>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                TaaSFlow is invitation-only for client workspaces. If you were invited, use the
                email address on the invitation. Employers can{" "}
                <Link to="/intake" className="underline">
                  start an intake
                </Link>{" "}
                to talk to our team.
              </p>
            </form>
          ) : (
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
