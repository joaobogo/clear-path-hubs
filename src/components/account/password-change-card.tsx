import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  passwordChangeErrors,
  type PasswordChangeFields as Fields,
} from "@/lib/account/password-change";
import { toastError } from "@/lib/toast-error";
import { toast } from "sonner";

/**
 * Change the password right here: the current password is checked, then the
 * new one is saved. No email round trip. "Forgot your current password?"
 * stays as a fallback and sends a link to the working /reset-password page.
 */
export function PasswordChangeForm({ email: emailProp }: { email?: string | null }) {
  const [fields, setFields] = useState<Fields>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const resolveEmail = async (): Promise<string | null> => {
    if (emailProp) return emailProp;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = passwordChangeErrors(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const email = await resolveEmail();
      if (!email) throw new Error("We couldn't find your sign-in email. Sign in again and retry.");
      // Confirms the current password, and leaves a fresh session so the
      // update below is accepted.
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password: fields.current,
      });
      if (checkError) {
        setErrors({ current: "That isn't your current password." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: fields.next });
      if (error) throw error;
      setFields({ current: "", next: "", confirm: "" });
      setErrors({});
      toast.success("Password updated. Use your new password next time you sign in.");
    } catch (err) {
      toastError(err, { fallback: "Could not update your password" });
    } finally {
      setSaving(false);
    }
  };

  const sendResetLink = async () => {
    if (sendingLink) return;
    setSendingLink(true);
    try {
      const email = await resolveEmail();
      if (!email) throw new Error("We couldn't find your sign-in email.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("We've emailed you a link to set a new password.");
    } catch (err) {
      toastError(err, { fallback: "Could not send the reset link" });
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.current}
          value={fields.current}
          onChange={set("current")}
        />
        <FieldError message={errors.current} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.next}
            value={fields.next}
            onChange={set("next")}
          />
          <FieldError message={errors.next} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            value={fields.confirm}
            onChange={set("confirm")}
          />
          <FieldError message={errors.confirm} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
        <button
          type="button"
          onClick={sendResetLink}
          disabled={sendingLink}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
        >
          {sendingLink ? "Sending link…" : "Forgot your current password? Email me a reset link"}
        </button>
      </div>
    </form>
  );
}

export function PasswordChangeCard() {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Security</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Change your password. You'll use the new one next time you sign in.
      </p>
      <div className="mt-4">
        <PasswordChangeForm />
      </div>
    </section>
  );
}
