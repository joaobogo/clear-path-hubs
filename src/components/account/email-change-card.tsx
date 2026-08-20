import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Change the address used to sign in. Supabase sends a confirmation link to
 * both the old and the new address; nothing changes until the new one is
 * confirmed, so nobody can be locked out of an account they paid for.
 */
export function EmailChangeCard({ focus = false }: { focus?: boolean }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setCurrent(data.user?.email ?? null);
      setPending(data.user?.new_email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus and expand the workspace tab when the user is sent here from the
  // notification "Update your email" action.
  useEffect(() => {
    if (!focus) return;
    // Give the collapsible workspace tab a moment to expand before focusing.
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, [focus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = next.trim().toLowerCase();
    if (!value || value === (current ?? "").toLowerCase()) {
      toast.error("Enter a different email address.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: value },
      { emailRedirectTo: `${window.location.origin}/login` },
    );
    setSaving(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("registered")
          ? "That email is already in use on another account."
          : "We couldn't start the email change. Please try again.",
      );
      return;
    }
    setPending(value);
    setSent(true);
    setNext("");
    toast.success("Confirmation links sent to both addresses.");
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Sign-in email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {current ? (
          <>
            You sign in as <span className="font-medium text-foreground">{current}</span>.
          </>
        ) : (
          "Loading your account…"
        )}
      </p>

      {pending && pending !== current ? (
        <p className="mt-3 rounded-md border bg-muted/40 p-3 text-sm">
          Change to <span className="font-medium">{pending}</span> is waiting on confirmation.
          Open the link we sent to both addresses. Until then, keep signing in with{" "}
          {current ?? "your current email"}.
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-email">New email address</Label>
          <Input
            ref={inputRef}
            id="new-email"
            type="email"
            autoComplete="email"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <Button type="submit" disabled={saving || !next.trim()}>
          {saving ? "Sending…" : sent ? "Send again" : "Send confirmation"}
        </Button>
      </form>

      <p className="mt-2 text-xs text-muted-foreground">
        Nothing changes until you confirm from the new inbox. Notifications keep going to your
        current address in the meantime.
      </p>
    </section>
  );
}
