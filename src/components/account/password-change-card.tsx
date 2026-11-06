import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import {
  passwordChangeErrors,
  type PasswordChangeFields as Fields,
} from "@/lib/account/password-change";
import { toastError } from "@/lib/toast-error";
import { toast } from "sonner";

const EMPTY: Fields = { current: "", next: "", confirm: "" };

/**
 * The fields of the password change. The current password is checked with a
 * fresh sign-in (which also leaves a recent session, so the update is never
 * refused for an old one), then the new password is saved. No email.
 */
function PasswordChangeForm({
  email: emailProp,
  onDone,
  onCancel,
}: {
  email?: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = passwordChangeErrors(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      let email = emailProp ?? null;
      if (!email) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        email = user?.email ?? null;
      }
      if (!email) throw new Error("We couldn't find your sign-in email. Sign in again and retry.");
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
      setFields(EMPTY);
      setErrors({});
      toast.success("Password updated. Use your new password next time you sign in.");
      onDone();
    } catch (err) {
      toastError(err, { fallback: "Could not update your password" });
    } finally {
      setSaving(false);
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
          autoFocus
          aria-invalid={!!errors.current}
          value={fields.current}
          onChange={set("current")}
        />
        <FieldError message={errors.current} />
      </div>
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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save new password"}
        </Button>
      </div>
    </form>
  );
}

/** "Change password" button that opens the change in a pop-up. */
export function PasswordChangeButton({
  email,
  size = "default",
}: {
  email?: string | null;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  // A new form each time the pop-up opens, so nothing typed lingers.
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        Change password
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. It takes effect straight away.
            </DialogDescription>
          </DialogHeader>
          <PasswordChangeForm
            key={formKey}
            email={email}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PasswordChangeCard() {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Security</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Change the password you sign in with. It takes effect straight away.
      </p>
      <div className="mt-4">
        <PasswordChangeButton />
      </div>
    </section>
  );
}
