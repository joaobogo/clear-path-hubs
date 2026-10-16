import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { runButtonClass } from "@/components/system/run-button";
import { CTA_RUN_ROLE } from "@/config/cta";
import { submitInquiry } from "@/lib/inquiry.functions";
import { storeLeadPrefill } from "@/lib/marketing/lead-prefill";
import { trackEvent } from "@/lib/tracking/pixels";
import { cn } from "@/lib/utils";

const Schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(120),
  email: z.string().trim().email("Enter a valid work email.").max(254),
  linkedin: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /linkedin\.com\//i.test(v), "Paste a LinkedIn profile link, or leave it blank."),
});

type Errors = Partial<Record<"name" | "email" | "linkedin" | "form", string>>;

/** Opens after "Run this role": captures who is hiring, then continues to the full intake. */
export function RunRoleDialog({
  open,
  onOpenChange,
  role,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  source: string;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", linkedin: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const goToIntake = () => {
    onOpenChange(false);
    void navigate({ to: CTA_RUN_ROLE.to, search: role ? { role } : {} });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await submitInquiry({
        data: {
          kind: "enquiry",
          name: parsed.data.name,
          email: parsed.data.email,
          role_title: role,
          source_path: window.location.pathname,
          details: { linkedin: parsed.data.linkedin || null, capture: "run_this_role" },
          website: form.website,
        },
      });
      storeLeadPrefill({ token: res.prefillToken, name: parsed.data.name, email: parsed.data.email, roleTitle: role });
      trackEvent("lead_submitted", { source, kind: "run_role" });
      goToIntake();
    } catch {
      setErrors({ form: "We couldn't save that just now. Try again, or skip straight to the full intake." });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: "name" | "email" | "linkedin", label: string, type: string, placeholder: string, optional = false) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`run-role-${key}`} className="text-sm font-medium text-[color:var(--ink)]">
        {label}
        {optional ? <span className="font-normal text-[color:var(--faint)]"> (optional)</span> : null}
      </label>
      <input
        id={`run-role-${key}`}
        type={type}
        value={form[key]}
        placeholder={placeholder}
        autoComplete={key === "name" ? "name" : key === "email" ? "email" : "url"}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `run-role-${key}-error` : undefined}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={cn(
          "h-11 rounded-[var(--r-2)] border bg-white px-3 text-[color:var(--ink)] focus:border-[color:var(--blue-600)] focus:outline-none",
          errors[key] ? "border-destructive" : "border-[color:var(--rule-2)]",
        )}
      />
      {errors[key] ? (
        <p id={`run-role-${key}-error`} className="text-sm text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? `Let's run your ${role} role` : "Let's run your role"}</DialogTitle>
          <DialogDescription>Tell us who you are. We'll carry it into the full intake.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {field("name", "Your name", "text", "Alex Morgan")}
          {field("email", "Work email", "email", "alex@company.com")}
          {field("linkedin", "LinkedIn", "url", "linkedin.com/in/…", true)}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className={cn(runButtonClass("primary", "md"), "w-full bg-[color:var(--blue-600)] text-white hover:bg-[color:var(--blue-700)]")}
          >
            {busy ? "Saving…" : "Continue to intake"}
          </button>
          <button
            type="button"
            onClick={goToIntake}
            className="text-sm font-medium text-[color:var(--blue-600)] underline-offset-4 hover:underline"
          >
            Skip — go straight to the full intake
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
