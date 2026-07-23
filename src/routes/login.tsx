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

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const qa = Route.useLoaderData();
  const runPersona = useServerFn(qaPersonaLogin);
  const runSession = useServerFn(getSessionContext);
  const runProvision = useServerFn(provisionClientMembershipForSelf);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [pickerFor, setPickerFor] = useState<SessionMembership[] | null>(null);

  // Already signed in? Redirect immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        const ctx = await runSession();
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
    // Candidate: no org membership, primary_role derived from candidate_profiles.
    if (primary === "candidate") {
      window.location.assign("/me");
      return;
    }
    if (active.length === 0) {
      navigate({ to: "/access-denied" });
      return;
    }
    // Multiple orgs of client-side roles → picker
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
      if (error) throw error;
      const ctx = await runSession();
      routeToDest(ctx.memberships, ctx.primary_role);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent (if the account exists).");
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      // Try immediate sign-in in case email confirmation is disabled.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        return;
      }
      try {
        const ctx = await runSession();
        routeToDest(ctx.memberships, ctx.primary_role);
      } catch {
        navigate({ to: "/access-denied" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const onPersona = async (key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer") => {
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
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"}
            </h1>
            <p className="text-sm text-muted-foreground">TaaSFlow admin & client portal</p>
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
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Create account
                </button>
              </div>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={onSignUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sname">Full name</Label>
                <Input id="sname" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semail">Email</Label>
                <Input id="semail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spassword">Password</Label>
                <Input id="spassword" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setMode("signin")}
              >
                ← Already have an account? Sign in
              </button>
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
              {qa.personas.map((p: { key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer"; label: string }) => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => onPersona(p.key)}
                >
                  Continue as {p.label}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </FormShell>
  );
}
