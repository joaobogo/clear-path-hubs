import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";

/** Shown when the recovery link is missing, already used, or expired. */
const EXPIRED_LINK_MESSAGE =
  "This reset link is invalid or has expired. Request a new one from the sign-in page.";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Listen for PASSWORD_RECOVERY event (fires when Supabase auto-processes
    // the recovery link hash on load).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (session) setHasRecoverySession(true);
      }
    });

    (async () => {
      const url = new URL(window.location.href);

      // Supabase surfaces link errors in the URL hash (e.g. #error=access_denied&error_code=otp_expired).
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setErrorMsg(hashError.replace(/\+/g, " "));
      }

      // PKCE flow: recovery link redirects with ?code=... — must be exchanged
      // for a session before updateUser({ password }) can run.
      const code = url.searchParams.get("code");
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg(error.message);
          } else {
            // Clean the code out of the URL so a refresh doesn't re-exchange.
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          }
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Invalid or expired reset link");
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setHasRecoverySession(true);
        return;
      }
      // No session, no error in the hash: the link was already used, has
      // expired, or the page was opened directly. Say so instead of leaving
      // the form disabled under a permanent "Verifying…" label.
      setErrorMsg((prev) => prev ?? EXPIRED_LINK_MESSAGE);
    })();


    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/login" });
    } catch (err) {
      toastError(err, { fallback: "Update failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormShell exitTo="/login" exitLabel="Back to sign in" width="sm">
      <Card className="w-full p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Set a new password</h1>
          {errorMsg && (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-destructive">{errorMsg}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/login", search: { reset: "1" } as never })}
              >
                Send me a new link
              </Button>
            </div>
          )}
          {!errorMsg && !hasRecoverySession && (
            <p className="text-xs text-muted-foreground mt-1">
              Verifying reset link…
            </p>
          )}
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirm password</Label>
            <Input
              id="pw2"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !hasRecoverySession}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </FormShell>
  );
}
