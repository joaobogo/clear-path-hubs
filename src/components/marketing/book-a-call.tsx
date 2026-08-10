/**
 * BookACall — dual-purpose marketing component.
 *
 *  <BookACallDialog trigger={<Button>Book a call</Button>} />
 *      Opens a modal with two tabs:
 *        • Book a call — captures the brief, then opens our real Calendly
 *          scheduler so the slot the prospect picks is a slot we actually
 *          hold. The brief lands in public.marketing_inquiries.
 *        • Send us a message — plain contact form.
 *
 *  <BookACallSection industrySlug="tech" industryName="Technology" />
 *      Inline landing-page section with the same tabbed UI.
 *
 * Both variants submit through the `submitInquiry` server function so the
 * lead is captured even if the prospect abandons the scheduler.
 */
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { CalendarDays, MessageSquare, Phone, Loader2, Check, Clock, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { submitInquiry } from "@/lib/inquiry.functions";
import { BOOKING_ROUTE } from "@/config/booking";
import { submitToCrm } from "@/lib/crm/submit-form";
import { FGV_EVENTS, trackConfirmedConversion, trackFgv } from "@/lib/tracking/fgv-events";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type CommonProps = {
  industrySlug?: string;
  industryName?: string;
  /** Prefill the "role_title" field, e.g. from an industry role explorer. */
  roleTitle?: string;
};

/* -------------------------------------------------------------------------- */
/*                                Modal / Dialog                              */
/* -------------------------------------------------------------------------- */

export function BookACallDialog({
  trigger,
  defaultTab = "call",
  ...common
}: CommonProps & {
  trigger: React.ReactNode;
  defaultTab?: "call" | "message";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/50 px-6 py-5">
          <DialogTitle className="font-[family-name:var(--brand-font-display)] text-xl">
            {common.industryName
              ? `Talk to us about ${common.industryName} hiring`
              : "Talk to a TaaSFlow recruiter"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[color:var(--brand-navy)]/80">
            Pick a call slot or send a message — we reply within one business day.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
          <BookACallTabs
            defaultTab={defaultTab}
            onSuccess={() => setOpen(false)}
            {...common}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Inline Section                                */
/* -------------------------------------------------------------------------- */

export function BookACallSection({
  eyebrow,
  title,
  description,
  ...common
}: CommonProps & {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section
      id="book-a-call"
      className="relative overflow-hidden bg-[color:var(--brand-navy)] text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, color-mix(in oklab, var(--brand-ocean) 55%, transparent), transparent 70%), radial-gradient(50% 50% at 90% 90%, color-mix(in oklab, var(--brand-ocean) 40%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-20">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            {title ??
              (common.industryName
                ? `Ready to hire in ${common.industryName}?`
                : "Ready to hire?")}
          </h2>
          <p className="mt-4 max-w-lg text-white/80">
            {description ??
              "Book a 20-minute call with a TaaSFlow recruiter or send us a short brief. We'll confirm the role, timeline, and shortlist plan before you commit to anything."}
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light)]" />
              <span>
                20-minute discovery call — role, must-haves, timeline, budget.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light)]" />
              <span>
                Ranked shortlist in days — with evidence quoted from every CV.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light)]" />
              <span>
                Flat subscription — no percentage-of-salary fees, ever.
              </span>
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white p-5 text-[color:var(--brand-navy)] shadow-2xl sm:p-6">
          <BookACallTabs {...common} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Tabs                                     */
/* -------------------------------------------------------------------------- */

function BookACallTabs({
  defaultTab = "call",
  onSuccess,
  ...common
}: CommonProps & {
  defaultTab?: "call" | "message";
  onSuccess?: () => void;
}) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="call" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Book a call
        </TabsTrigger>
        <TabsTrigger value="message" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Send a message
        </TabsTrigger>
      </TabsList>
      <TabsContent value="call" className="mt-5">
        <CallForm {...common} onSuccess={onSuccess} />
      </TabsContent>
      <TabsContent value="message" className="mt-5">
        <MessageForm {...common} onSuccess={onSuccess} />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Call form                                 */
/* -------------------------------------------------------------------------- */

function CallForm({
  industrySlug,
  industryName,
  roleTitle,
  onSuccess,
}: CommonProps & { onSuccess?: () => void }) {
  const [pending, setPending] = useState(false);
  const submit = useServerFn(submitInquiry);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const formEl = e.currentTarget;
    setPending(true);
    try {
      await submit({
        data: {
          kind: "call",
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          company: String(form.get("company") ?? ""),
          role_title: roleTitle ?? String(form.get("role_title") ?? ""),
          role_count: String(form.get("role_count") ?? ""),
          message: String(form.get("message") ?? ""),
          preferred_slot: "",
          industry_slug: industrySlug ?? "",
          source_path: typeof window !== "undefined" ? window.location.pathname : "",
          website: String(form.get("website") ?? ""),
        },
      });
      trackFgv(FGV_EVENTS.formSubmit, { form_type: "consultation" });
      void submitToCrm({
        formId: "book-a-call",
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("name") ?? ""),
        jobTitle: roleTitle ?? String(form.get("role_title") ?? ""),
        companyName: String(form.get("company") ?? "") || null,
        answers: {
          "Roles to hire": String(form.get("role_count") ?? ""),
          Industry: industrySlug ?? "",
          Message: String(form.get("message") ?? ""),
        },
        consentStatus: "requested_call",
        honeypot: String(form.get("website") ?? ""),
      }).then((result) => {
        if (result.ok) {
          trackConfirmedConversion({
            formType: "consultation",
            serviceInterest: "recruiting_subscription",
            destinationBrand: "taasflow",
            submissionId: result.submissionId,
          });
        } else {
          trackFgv(FGV_EVENTS.formError, {
            form_type: "consultation",
            error_code: result.error,
          });
        }
      });
      // One booking mechanism only: the prospect picks a real slot on the
      // native TaaSFlow scheduler. Nothing here invents availability.
      toast.success("Brief received — now pick a time that suits you.");
      window.location.assign(`${BOOKING_ROUTE}?cta=book_a_call_form`);
      formEl.reset();
      onSuccess?.();
    } catch (err) {
      toastError(err, { fallback: "Something went wrong." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-mist)]/50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--brand-navy)]">
          <Clock className="h-4 w-4" /> 20-minute discovery call
        </p>
        <p className="mt-1 text-[13px] text-[color:var(--brand-navy)]/80">
          Tell us about the role, then choose a live slot in our calendar. You get the
          calendar invite immediately.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Full name" required autoComplete="name" />
        <Field
          name="email"
          type="email"
          label="Work email"
          required
          autoComplete="email"
        />
        <Field
          name="company"
          label="Company"
          required
          autoComplete="organization"
        />
        <Field
          name="role_count"
          label={industryName ? `${industryName} roles to hire` : "Roles to hire"}
          placeholder="e.g. 1–3 roles"
        />
      </div>
      {!roleTitle ? (
        <Field
          name="role_title"
          label="Primary role"
          placeholder={
            industryName ? `e.g. Senior ${industryName} lead` : "e.g. Head of Engineering"
          }
        />
      ) : null}
      <div>
        <Label htmlFor="call-message" className="text-sm font-medium">
          Anything we should know? <span className="text-[color:var(--brand-navy)]/80">(optional)</span>
        </Label>
        <Textarea
          id="call-message"
          name="message"
          rows={3}
          maxLength={4000}
          placeholder="Timeline, budget, must-haves, hard-nos…"
          className="mt-1"
        />
      </div>
      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <Button
        type="submit"
        disabled={pending}
        data-no-calendly
        className="w-full bg-[color:var(--brand-navy)] text-white hover:opacity-90"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening calendar…
          </>
        ) : (
          <>
            <Phone className="mr-2 h-4 w-4" />
            Choose a time
          </>
        )}
      </Button>
      <p className="text-center text-[11px] text-[color:var(--brand-navy)]/80">
        Times shown are real openings in our calendar, in your local timezone.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Message form                                   */
/* -------------------------------------------------------------------------- */

function MessageForm({
  industrySlug,
  industryName,
  roleTitle,
  onSuccess,
}: CommonProps & { onSuccess?: () => void }) {
  const [pending, setPending] = useState(false);
  const submit = useServerFn(submitInquiry);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      await submit({
        data: {
          kind: "message",
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          company: String(form.get("company") ?? ""),
          role_title: roleTitle ?? String(form.get("role_title") ?? ""),
          role_count: String(form.get("role_count") ?? ""),
          message: String(form.get("message") ?? ""),
          industry_slug: industrySlug ?? "",
          source_path: typeof window !== "undefined" ? window.location.pathname : "",
          website: String(form.get("website") ?? ""),
        },
      });
      void submitToCrm({
        formId: "website-message",
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("name") ?? ""),
        jobTitle: roleTitle ?? String(form.get("role_title") ?? ""),
        companyName: String(form.get("company") ?? "") || null,
        answers: {
          "Roles to hire": String(form.get("role_count") ?? ""),
          Industry: industrySlug ?? "",
          Message: String(form.get("message") ?? ""),
        },
        consentStatus: "submitted_message",
        honeypot: String(form.get("website") ?? ""),
      }).then((result) => {
        if (result.ok) {
          trackConfirmedConversion({
            formType: "consultation",
            serviceInterest: "recruiting_subscription",
            destinationBrand: "taasflow",
            submissionId: result.submissionId,
          });
        } else {
          trackFgv(FGV_EVENTS.formError, {
            form_type: "consultation",
            error_code: result.error,
          });
        }
      });
      toast.success("Message sent — we'll reply within one business day.");
      (e.currentTarget as HTMLFormElement).reset();
      onSuccess?.();
    } catch (err) {
      toastError(err, { fallback: "Something went wrong." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Full name" required autoComplete="name" />
        <Field
          name="email"
          type="email"
          label="Work email"
          required
          autoComplete="email"
        />
        <Field name="company" label="Company" autoComplete="organization" />
        <Field
          name="role_count"
          label="Roles to hire"
          placeholder="e.g. 1–3 roles"
        />
      </div>
      {!roleTitle ? (
        <Field
          name="role_title"
          label={industryName ? `${industryName} role` : "Role"}
          placeholder={
            industryName ? `e.g. Senior ${industryName} lead` : "e.g. Head of Engineering"
          }
        />
      ) : null}
      <div>
        <Label htmlFor="msg-message" className="text-sm font-medium">
          Your message
        </Label>
        <Textarea
          id="msg-message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder={
            industryName
              ? `Tell us about your ${industryName} hiring need — timeline, must-haves, anything unusual.`
              : "Tell us about the role — timeline, must-haves, anything unusual."
          }
          className="mt-1"
        />
      </div>
      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-[color:var(--brand-navy)] text-white hover:opacity-90"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" /> Send message
          </>
        )}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Field helper                                  */
/* -------------------------------------------------------------------------- */

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <Label htmlFor={`inq-${name}`} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-[color:var(--brand-ocean-text)]">*</span> : null}
      </Label>
      <Input
        id={`inq-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={254}
        className="mt-1"
      />
    </div>
  );
}
