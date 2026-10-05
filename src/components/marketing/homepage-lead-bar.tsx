import * as React from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { submitToCrm } from "@/lib/crm/submit-form";

type LeadState = {
  bestTime: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
};

const EMPTY: LeadState = {
  bestTime: "",
  name: "",
  email: "",
  phone: "",
  linkedin: "",
};

export function HomepageLeadBar() {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<LeadState>(EMPTY);
  const [status, setStatus] = React.useState<"idle" | "sending" | "done" | "error">("idle");

  const set = (key: keyof LeadState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    if (!values.name.trim() || !values.email.trim() || !values.bestTime.trim()) {
      setStatus("error");
      return;
    }

    setStatus("sending");
    const result = await submitToCrm({
      formId: "website-message",
      email: values.email.trim(),
      fullName: values.name.trim(),
      phone: values.phone.trim() || null,
      linkedin: values.linkedin.trim() || null,
      serviceInterest: "recruiting_subscription",
      answers: {
        best_time_to_contact: values.bestTime,
        source: "homepage_sticky_lead_bar",
      },
      consentStatus: "contact_requested",
    });

    if (result.ok) {
      setStatus("done");
      setValues(EMPTY);
    } else {
      setStatus("error");
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 hidden border-t border-[color:var(--brand-navy)]/15 bg-white/95 shadow-[0_-12px_30px_rgba(10,32,52,0.12)] backdrop-blur lg:block">
        <div className="mx-auto max-w-[1200px] px-6 py-3">
          {status === "done" ? (
            <div className="flex min-h-12 items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[color:var(--brand-navy)]">You're in.</p>
                <p className="text-sm text-[color:var(--brand-navy)]/75">
                  Expect to hear from us within 4 hours — usually within 1 hour.
                </p>
              </div>
              <button type="button" onClick={() => setStatus("idle")} className="text-sm font-semibold text-[color:var(--brand-ocean-text)]">
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid grid-cols-[1.15fr_1fr_1.25fr_1fr_1.25fr_auto] items-end gap-2" aria-label="Talk to TaaSFlow">
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
                Best time
                <select value={values.bestTime} onChange={set("bestTime")} required className="h-10 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 text-sm font-normal normal-case tracking-normal">
                  <option value="">Choose a time</option>
                  <option value="As soon as possible">As soon as possible</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
                Name
                <input value={values.name} onChange={set("name")} required autoComplete="name" className="h-10 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
                Work email
                <input value={values.email} onChange={set("email")} required type="email" autoComplete="email" className="h-10 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
                Phone
                <input value={values.phone} onChange={set("phone")} type="tel" autoComplete="tel" className="h-10 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/70">
                LinkedIn <span className="font-normal normal-case tracking-normal">(optional)</span>
                <input value={values.linkedin} onChange={set("linkedin")} type="url" placeholder="linkedin.com/in/..." className="h-10 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <button type="submit" disabled={status === "sending"} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white disabled:opacity-60">
                {status === "sending" ? "Sending..." : "Talk to us"}
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          )}
          {status === "error" && (
            <p className="mt-1 text-xs text-[color:var(--brand-danger)]">
              Add your name, work email and best contact time, then try again.
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white shadow-xl"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Talk to TaaSFlow
          </button>
        ) : (
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/15 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[color:var(--brand-navy)]">Talk to TaaSFlow</p>
                <p className="text-xs text-[color:var(--brand-navy)]/70">Usually answered within 1 hour.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close contact form" className="p-1">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {status === "done" ? (
              <p className="mt-4 rounded-xl bg-[color:var(--brand-mist)] p-4 text-sm text-[color:var(--brand-navy)]">
                You're in. Expect to hear from us within 4 hours — usually within 1 hour.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="mt-4 grid gap-3">
                <select aria-label="Best time to contact" value={values.bestTime} onChange={set("bestTime")} required className="h-11 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 text-sm">
                  <option value="">Best time to contact</option>
                  <option value="As soon as possible">As soon as possible</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                </select>
                <input aria-label="Name" value={values.name} onChange={set("name")} required placeholder="Name" autoComplete="name" className="h-11 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm" />
                <input aria-label="Work email" value={values.email} onChange={set("email")} required type="email" placeholder="Work email" autoComplete="email" className="h-11 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm" />
                <input aria-label="Phone" value={values.phone} onChange={set("phone")} type="tel" placeholder="Phone" autoComplete="tel" className="h-11 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm" />
                <input aria-label="LinkedIn URL optional" value={values.linkedin} onChange={set("linkedin")} type="url" placeholder="LinkedIn URL (optional)" className="h-11 rounded-md border border-[color:var(--brand-navy)]/15 px-3 text-sm" />
                <button type="submit" disabled={status === "sending"} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white disabled:opacity-60">
                  {status === "sending" ? "Sending..." : "Send"}
                  <Send className="h-4 w-4" aria-hidden />
                </button>
                {status === "error" && <p className="text-xs text-[color:var(--brand-danger)]">Check the required fields and try again.</p>}
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}
