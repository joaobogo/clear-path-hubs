import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  SiteShell,
  PublicPage,
  PublicSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { z } from "zod";

export const Route = createFileRoute("/contact")({
  head: () =>
    marketingHead(undefined, "/contact", {
      title: "Contact TaaSFlow — talk to a hiring lead",
      description:
        "Get in touch with the TaaSFlow team. Ask about subscription recruiting, start a pilot, or reach support. We reply within one business day.",
    }),
  component: ContactPage,
});

const TOPICS = [
  { value: "hire_talent", label: "I want to hire talent" },
  { value: "candidate", label: "I am a candidate" },
  { value: "existing_client", label: "I am an existing client" },
  { value: "support", label: "I need support" },
  { value: "general", label: "General inquiry" },
] as const;

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.enum([
    "hire_talent",
    "candidate",
    "existing_client",
    "support",
    "general",
  ]),
  message: z.string().trim().min(10, "Please add at least a sentence").max(4000),
});

type FormState = z.infer<typeof clientSchema>;
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; traceId: string }
  | { kind: "error"; message: string; traceId?: string };

function ContactPage() {
  const mountedAt = useMemo(() => Date.now(), []);
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    company: "",
    topic: "hire_talent",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;

    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        company: flat.company?.[0],
        topic: flat.topic?.[0],
        message: flat.message?.[0],
      });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          source: "public_contact_form",
          website: honeypotRef.current?.value ?? "",
          elapsedMs: Date.now() - mountedAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        trace_id?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message:
            data.message ||
            data.error ||
            "We couldn't send your message. Please try again in a moment.",
          traceId: data.trace_id,
        });
        return;
      }
      setStatus({ kind: "success", traceId: data.trace_id ?? "" });
      setForm({
        name: "",
        email: "",
        company: "",
        topic: "hire_talent",
        message: "",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Network error. Please try again.",
      });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <SiteShell>
      <PublicSection className="pt-24">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
                Contact
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Talk to a hiring lead.
              </h1>
              <p className="mt-5 text-lg text-[color:var(--brand-navy)]/70">
                Ask about subscription recruiting, start a pilot, or reach out
                to our support team. We reply within one business day.
              </p>
              <ul className="mt-8 space-y-4 text-sm text-[color:var(--brand-navy)]/80">
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">
                    Hiring teams:
                  </span>{" "}
                  Share the role you&apos;re trying to fill and we&apos;ll show
                  you what a shortlist would look like.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">
                    Candidates:
                  </span>{" "}
                  Questions about an application, your profile, or your data —
                  we&apos;re happy to help.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--brand-navy)]">
                    Existing clients:
                  </span>{" "}
                  For anything urgent, use the messaging in your workspace so
                  it lands with your recruiter directly.
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/intake"
                  className="rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
                >
                  Start an intake
                </Link>
                <Link
                  to="/faq"
                  className="rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-3 text-sm font-semibold hover:bg-[color:var(--brand-sky)]/60"
                >
                  Read the FAQ
                </Link>
              </div>
            </div>

            <form
              noValidate
              onSubmit={onSubmit}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm sm:p-8"
              aria-describedby={
                status.kind === "success"
                  ? "contact-success"
                  : status.kind === "error"
                    ? "contact-error"
                    : undefined
              }
            >
              <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                Send us a message
              </h2>
              <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
                We&apos;ll reply within one business day.
              </p>

              {/* Honeypot — visually hidden but focusable for bots */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: "-10000px",
                  top: "auto",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                }}
              >
                <label>
                  Do not fill in this field
                  <input
                    ref={honeypotRef}
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-4">
                <Field
                  id="name"
                  label="Your name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(v) => update("name", v)}
                  error={errors.name}
                />
                <Field
                  id="email"
                  label="Work email"
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  error={errors.email}
                />
                <Field
                  id="company"
                  label="Company (optional)"
                  autoComplete="organization"
                  value={form.company ?? ""}
                  onChange={(v) => update("company", v)}
                  error={errors.company}
                />

                <div>
                  <label
                    htmlFor="topic"
                    className="mb-1.5 block text-sm font-medium text-[color:var(--brand-navy)]"
                  >
                    How can we help?
                    <span aria-hidden className="ml-1 text-[color:var(--brand-ocean)]">
                      *
                    </span>
                  </label>
                  <select
                    id="topic"
                    required
                    value={form.topic}
                    onChange={(e) =>
                      update("topic", e.target.value as FormState["topic"])
                    }
                    className="block w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2.5 text-sm text-[color:var(--brand-navy)] shadow-sm focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ocean)]/30"
                  >
                    {TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-1.5 block text-sm font-medium text-[color:var(--brand-navy)]"
                  >
                    Message
                    <span aria-hidden className="ml-1 text-[color:var(--brand-ocean)]">
                      *
                    </span>
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={
                      errors.message ? "message-error" : undefined
                    }
                    className="block w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2.5 text-sm text-[color:var(--brand-navy)] shadow-sm focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ocean)]/30"
                  />
                  {errors.message && (
                    <p
                      id="message-error"
                      className="mt-1.5 text-xs text-red-600"
                    >
                      {errors.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-navy-dark)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>

              <div className="mt-4 min-h-[1.25rem]" aria-live="polite">
                {status.kind === "success" && (
                  <p
                    id="contact-success"
                    className="rounded-md bg-[color:var(--brand-sky)]/60 px-3 py-2 text-sm text-[color:var(--brand-navy)]"
                  >
                    Thanks — your message is with the team. We&apos;ll reply
                    within one business day.
                    {status.traceId ? (
                      <span className="ml-1 text-xs text-[color:var(--brand-navy)]/60">
                        Reference: {status.traceId.slice(0, 8)}
                      </span>
                    ) : null}
                  </p>
                )}
                {status.kind === "error" && (
                  <p
                    id="contact-error"
                    role="alert"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
                  >
                    {status.message} You can also email us via the intake link
                    above.
                  </p>
                )}
              </div>

              <p className="mt-4 text-xs text-[color:var(--brand-navy)]/60">
                By sending this message you agree to be contacted about your
                enquiry. See our{" "}
                <Link to="/privacy" className="underline">
                  privacy policy
                </Link>
                .
              </p>
            </form>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  inputMode,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "search";
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-[color:var(--brand-navy)]"
      >
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-[color:var(--brand-ocean)]">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="block w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2.5 text-sm text-[color:var(--brand-navy)] shadow-sm focus:border-[color:var(--brand-ocean)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ocean)]/30"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
