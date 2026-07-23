/**
 * BookACall — dual-purpose marketing component.
 *
 *  <BookACallDialog trigger={<Button>Book a call</Button>} />
 *      Opens a modal with two tabs:
 *        • Book a call — Calendly-style date/time picker (mock — real
 *          Calendly gets wired up later; submissions land in
 *          public.marketing_inquiries).
 *        • Send us a message — plain contact form.
 *
 *  <BookACallSection industrySlug="tech" industryName="Technology" />
 *      Inline landing-page section with the same tabbed UI.
 *
 * Both variants submit through the `submitInquiry` server function so no
 * lead is lost while the real Calendly account is being connected.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MessageSquare, Phone, Loader2, Check, Clock, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { submitInquiry } from "@/lib/inquiry.functions";
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
          <DialogDescription className="text-sm text-[color:var(--brand-navy)]/70">
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
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light,#7ec9f0)]" />
              <span>
                20-minute discovery call — role, must-haves, timeline, budget.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light,#7ec9f0)]" />
              <span>
                Ranked shortlist in 14 days — with evidence quoted from every CV.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-ocean-light,#7ec9f0)]" />
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
/*                              Call form (mock)                              */
/* -------------------------------------------------------------------------- */

function useNextBusinessDays(count = 5) {
  return useMemo(() => {
    const out: Date[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    while (out.length < count) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [count]);
}

const CALL_SLOTS = ["09:00", "10:30", "13:00", "14:30", "16:00"];

function CallForm({
  industrySlug,
  industryName,
  roleTitle,
  onSuccess,
}: CommonProps & { onSuccess?: () => void }) {
  const days = useNextBusinessDays(5);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = useServerFn(submitInquiry);

  const chosenIso = useMemo(() => {
    if (!slot) return "";
    const [h, m] = slot.split(":").map(Number);
    const dt = new Date(days[dayIdx]);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  }, [days, dayIdx, slot]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) {
      toast.error("Pick a time slot first.");
      return;
    }
    const form = new FormData(e.currentTarget);
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
          preferred_slot: chosenIso,
          industry_slug: industrySlug ?? "",
          source_path: typeof window !== "undefined" ? window.location.pathname : "",
          website: String(form.get("website") ?? ""),
        },
      });
      toast.success("Call requested — we'll confirm within one business day.");
      (e.currentTarget as HTMLFormElement).reset();
      setSlot(null);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const dayFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/60">
          Pick a day
        </Label>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {days.map((d, i) => (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => setDayIdx(i)}
              className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-all ${
                i === dayIdx
                  ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-navy)]"
                  : "border-[color:var(--brand-navy)]/15 text-[color:var(--brand-navy)]/70 hover:border-[color:var(--brand-navy)]/40"
              }`}
            >
              {dayFmt.format(d)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/60">
          Available time
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-navy)]/5 px-2 py-0.5 text-[10px] font-medium text-[color:var(--brand-navy)]/60">
            <Clock className="h-3 w-3" /> 20 min
          </span>
        </Label>
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {CALL_SLOTS.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSlot(s)}
              className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                slot === s
                  ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                  : "border-[color:var(--brand-navy)]/15 text-[color:var(--brand-navy)]/85 hover:border-[color:var(--brand-navy)]/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
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
          Anything we should know? <span className="text-[color:var(--brand-navy)]/50">(optional)</span>
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
        className="w-full bg-[color:var(--brand-navy)] text-white hover:opacity-90"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting…
          </>
        ) : (
          <>
            <Phone className="mr-2 h-4 w-4" />
            {slot
              ? `Confirm ${dayFmt.format(days[dayIdx])} · ${slot}`
              : "Pick a time to continue"}
          </>
        )}
      </Button>
      <p className="text-center text-[11px] text-[color:var(--brand-navy)]/55">
        We reply within one business day. You'll get a calendar invite once confirmed.
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
      toast.success("Message sent — we'll reply within one business day.");
      (e.currentTarget as HTMLFormElement).reset();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
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
        {required ? <span className="ml-0.5 text-[color:var(--brand-ocean)]">*</span> : null}
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
