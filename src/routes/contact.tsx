import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { submitToCrm } from "@/lib/crm/submit-form";
import { toast } from "sonner";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  UserCircle2,
  Building2,
  LifeBuoy,
  MessageSquare,
  ArrowRight,
  LogIn,
  Search,
  Clock,
  CheckCircle2,
  Mail,
} from "lucide-react";

type Intent = "hire" | "candidate" | "existing_client" | "support" | "general";

type IntentSpec = {
  id: Intent;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  responseSla: string;
  respondsFrom: string;
  primaryCta: { label: string; to?: string; anchor?: string; icon?: React.ComponentType<{ className?: string }> };
  secondaryCta?: { label: string; to?: string; anchor?: string; icon?: React.ComponentType<{ className?: string }> };
  backup: string;
  fields: Array<"name" | "email" | "company" | "role" | "url" | "message">;
  formHeading: string;
  formDescription: string;
  topic: "hire_talent" | "candidate" | "existing_client" | "support" | "general";
};

const INTENTS: IntentSpec[] = [
  {
    id: "hire",
    label: "Hire talent",
    tagline: "Start a role or talk to sales.",
    icon: Briefcase,
    responseSla: "Same business day",
    respondsFrom: "Sales team",
    primaryCta: { label: "Start Hiring", to: "/intake", icon: ArrowRight },
    secondaryCta: { label: "Contact sales", anchor: "#contact-form" },
    backup: "Prefer email? sales@taasflow.com",
    fields: ["name", "email", "company", "role", "message"],
    formHeading: "Talk to sales",
    formDescription: "Tell us who you are and the role you need to fill. We reply within one business day.",
    topic: "hire_talent",
  },
  {
    id: "candidate",
    label: "Candidate",
    tagline: "Browse roles or manage your application.",
    icon: UserCircle2,
    responseSla: "Within 2 business days",
    respondsFrom: "Talent team",
    primaryCta: { label: "Browse Jobs", to: "/jobs", icon: Search },
    secondaryCta: { label: "Candidate Sign In", to: "/login", icon: LogIn },
    backup: "Application questions: talent@taasflow.com",
    fields: ["name", "email", "url", "message"],
    formHeading: "Ask the talent team",
    formDescription: "Share your LinkedIn or a link to your work, and the question you'd like answered.",
    topic: "candidate",
  },
  {
    id: "existing_client",
    label: "Existing client",
    tagline: "Reach your account team.",
    icon: Building2,
    responseSla: "Within 4 business hours",
    respondsFrom: "Your account manager",
    primaryCta: { label: "Client Sign In", to: "/login", icon: LogIn },
    secondaryCta: { label: "Send a message", anchor: "#contact-form" },
    backup: "Fastest route: message us inside your workspace.",
    fields: ["name", "email", "company", "message"],
    formHeading: "Message your account team",
    formDescription: "Use the email tied to your workspace so we can find the right account.",
    topic: "existing_client",
  },
  {
    id: "support",
    label: "Support",
    tagline: "Report an issue with your account or workspace.",
    icon: LifeBuoy,
    responseSla: "Within 4 business hours",
    respondsFrom: "Support team",
    primaryCta: { label: "Report an issue", anchor: "#contact-form", icon: ArrowRight },
    secondaryCta: { label: "Sign in first", to: "/login", icon: LogIn },
    backup: "Urgent workspace outage? support@taasflow.com",
    fields: ["name", "email", "url", "message"],
    formHeading: "Support request",
    formDescription: "Include your account email and the URL where you hit the issue. Screenshots welcome — reply to the confirmation email to attach.",
    topic: "support",
  },
  {
    id: "general",
    label: "General inquiry",
    tagline: "Press, partnerships, anything else.",
    icon: MessageSquare,
    responseSla: "Within 3 business days",
    respondsFrom: "Comms team",
    primaryCta: { label: "Send a message", anchor: "#contact-form", icon: ArrowRight },
    secondaryCta: { label: "See our journey", to: "/journey" },
    backup: "Press: press@taasflow.com · Partnerships: partners@taasflow.com",
    fields: ["name", "email", "company", "message"],
    formHeading: "General inquiry",
    formDescription: "Press, partnerships, or anything else. We'll route it to the right team.",
    topic: "general",
  },
];

export const Route = createFileRoute("/contact")({
  head: () =>
    marketingHead(undefined, "/contact", {
      title: "Contact TaaSFlow — Sales, Support, Candidates, Partnerships",
      description:
        "Pick the path that fits: hire talent, candidate questions, existing client, support, or general inquiry. Each route has its own SLA and the right team on the other end.",
    }),
  component: ContactPage,
});

function ContactPage() {
  const [intentId, setIntentId] = useState<Intent>("hire");
  const intent = INTENTS.find((i) => i.id === intentId)!;

  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Contact
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Pick your path. We route from there.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            Five paths, five teams. Choose the one that fits and you'll see the right CTA,
            an honest response time, and a backup channel — before you fill a single field.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Intent selector */}
      <PublicSection className="pb-4">
        <PublicPage>
          <div role="tablist" aria-label="Contact path" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {INTENTS.map((opt) => {
              const active = intentId === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${opt.id}`}
                  id={`tab-${opt.id}`}
                  onClick={() => setIntentId(opt.id)}
                  className={
                    "flex min-h-20 flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-navy)]/40 " +
                    (active
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white hover:border-[color:var(--brand-navy)]/40")
                  }
                >
                  <opt.icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold leading-snug">{opt.label}</span>
                  <span className={"text-xs leading-snug " + (active ? "text-white/75" : "text-[color:var(--brand-navy)]/80")}>
                    {opt.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Context panel: spec + form */}
      <PublicSection className="py-10">
        <PublicPage>
          <div
            role="tabpanel"
            id={`panel-${intent.id}`}
            aria-labelledby={`tab-${intent.id}`}
            className="grid gap-6 lg:grid-cols-5"
          >
            {/* Left: spec card */}
            <aside className="lg:col-span-2">
              <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  <intent.icon className="h-5 w-5 text-[color:var(--brand-navy)]" />
                  <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                    {intent.label}
                  </h2>
                </div>
                <p className="mt-3 text-[color:var(--brand-navy)]/80">{intent.tagline}</p>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {intent.primaryCta.to ? (
                    <Link
                      to={intent.primaryCta.to}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {intent.primaryCta.icon ? <intent.primaryCta.icon className="mr-2 h-4 w-4" /> : null}
                      {intent.primaryCta.label}
                    </Link>
                  ) : (
                    <a
                      href={intent.primaryCta.anchor}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {intent.primaryCta.icon ? <intent.primaryCta.icon className="mr-2 h-4 w-4" /> : null}
                      {intent.primaryCta.label}
                    </a>
                  )}
                  {intent.secondaryCta ? (
                    intent.secondaryCta.to ? (
                      <Link
                        to={intent.secondaryCta.to}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                      >
                        {intent.secondaryCta.icon ? <intent.secondaryCta.icon className="mr-2 h-4 w-4" /> : null}
                        {intent.secondaryCta.label}
                      </Link>
                    ) : (
                      <a
                        href={intent.secondaryCta.anchor}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                      >
                        {intent.secondaryCta.icon ? <intent.secondaryCta.icon className="mr-2 h-4 w-4" /> : null}
                        {intent.secondaryCta.label}
                      </a>
                    )
                  ) : null}
                </div>

                <dl className="mt-8 space-y-4 border-t border-[color:var(--brand-navy)]/10 pt-6 text-sm">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 text-[color:var(--brand-navy)]/80" />
                    <div>
                      <dt className="font-semibold text-[color:var(--brand-navy)]">Expected response</dt>
                      <dd className="text-[color:var(--brand-navy)]/80">{intent.responseSla}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--brand-navy)]/80" />
                    <div>
                      <dt className="font-semibold text-[color:var(--brand-navy)]">Responded to by</dt>
                      <dd className="text-[color:var(--brand-navy)]/80">{intent.respondsFrom}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-[color:var(--brand-navy)]/80" />
                    <div>
                      <dt className="font-semibold text-[color:var(--brand-navy)]">Backup channel</dt>
                      <dd className="text-[color:var(--brand-navy)]/80">{intent.backup}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            </aside>

            {/* Right: form */}
            <div id="contact-form" className="lg:col-span-3">
              <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
                <ContactForm intent={intent} />
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}

/* ── Shared form ────────────────────────────────────────────────── */

function ContactForm({ intent }: { intent: IntentSpec }) {
  const { topic, formHeading, formDescription, fields } = intent;
  const mountedAt = useMemo(() => Date.now(), []);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { traceId: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittedRef.current || submitting) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const roleExtra = fields.includes("role") ? String(fd.get("role") ?? "").trim() : "";
    const urlExtra = fields.includes("url") ? String(fd.get("url") ?? "").trim() : "";
    const rawMessage = String(fd.get("message") ?? "").trim();
    const composedMessage = [
      roleExtra ? `Role: ${roleExtra}` : null,
      urlExtra ? `Link: ${urlExtra}` : null,
      rawMessage,
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      message: composedMessage,
      topic,
      source: "public_contact_form",
      website: String(fd.get("website") ?? ""),
      elapsedMs: Date.now() - mountedAt,
    };

    if (payload.name.length < 1 || payload.name.length > 120) {
      setError("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 255) {
      setError("Please enter a valid email address.");
      return;
    }
    if (payload.message.length < 10) {
      setError("Please add a short message (at least 10 characters).");
      return;
    }
    if (payload.message.length > 4000) {
      setError("Message is too long (4000 character limit).");
      return;
    }

    setSubmitting(true);
    submittedRef.current = true;
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        trace_id?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        submittedRef.current = false;
        setError(
          json.error === "validation_failed"
            ? "Please check the form and try again."
            : "We couldn't send your message. Please try again.",
        );
        toast.error("Message failed to send.");
        return;
      }
      if (topic !== "support" && topic !== "candidate") {
        void submitToCrm({
          formId: "contact-page",
          email: payload.email,
          fullName: payload.name,
          companyName: payload.company || null,
          companyDomain: payload.company || null,
          answers: {
            Topic: topic,
            Role: roleExtra,
            Link: urlExtra,
            Message: rawMessage,
          },
          consentStatus: "submitted_contact_form",
          honeypot: payload.website,
        });
      }
      setDone({ traceId: json.trace_id ?? "" });
      toast.success("Message sent. We'll be in touch.");
      form.reset();
    } catch {
      submittedRef.current = false;
      setError("Network error. Please try again.");
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
          Thanks — we've got it.
        </h3>
        <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
          Expected response: <span className="font-semibold">{intent.responseSla}</span>, from{" "}
          <span className="font-semibold">{intent.respondsFrom}</span>. We'll reply to the email
          you provided.
        </p>
        <p className="mt-2 text-xs text-[color:var(--brand-navy)]/80">
          Reference: <span className="font-mono">{done.traceId.slice(0, 8) || "—"}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
          {formHeading}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">{formDescription}</p>
      </div>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`hp-${topic}`}>Website</label>
        <input id={`hp-${topic}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {(fields.includes("name") || fields.includes("email")) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.includes("name") && (
            <div>
              <Label htmlFor={`name-${topic}`}>Name</Label>
              <Input id={`name-${topic}`} name="name" required autoComplete="name" maxLength={120} />
            </div>
          )}
          {fields.includes("email") && (
            <div>
              <Label htmlFor={`email-${topic}`}>Email</Label>
              <Input
                id={`email-${topic}`}
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={255}
              />
            </div>
          )}
        </div>
      )}

      {fields.includes("company") && (
        <div>
          <Label htmlFor={`company-${topic}`}>Company{intent.id === "hire" ? "" : " (optional)"}</Label>
          <Input id={`company-${topic}`} name="company" autoComplete="organization" maxLength={160} />
        </div>
      )}

      {fields.includes("role") && (
        <div>
          <Label htmlFor={`role-${topic}`}>Role you need to fill</Label>
          <Input
            id={`role-${topic}`}
            name="role"
            placeholder="e.g. Senior Backend Engineer, Head of Sales"
            maxLength={200}
          />
        </div>
      )}

      {fields.includes("url") && (
        <div>
          <Label htmlFor={`url-${topic}`}>
            {intent.id === "support" ? "URL where the issue happened" : "Link (LinkedIn, portfolio, or job URL)"}
          </Label>
          <Input id={`url-${topic}`} name="url" type="url" placeholder="https://" maxLength={400} />
        </div>
      )}

      {fields.includes("message") && (
        <div>
          <Label htmlFor={`message-${topic}`}>
            {intent.id === "support" ? "What went wrong?" : "Message"}
          </Label>
          <Textarea
            id={`message-${topic}`}
            name="message"
            required
            rows={5}
            maxLength={4000}
            placeholder={
              intent.id === "hire"
                ? "A few lines on the role, timeline, and where you are today."
                : intent.id === "support"
                  ? "Steps to reproduce, what you expected, and what happened instead."
                  : "A few lines about what you need."
            }
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={submitting}
          className="min-h-11 bg-[color:var(--brand-navy)] text-white hover:opacity-90"
        >
          {submitting ? "Sending…" : "Send message"}
        </Button>
        <span className="text-xs text-[color:var(--brand-navy)]/80">
          Expected reply: {intent.responseSla.toLowerCase()}.
        </span>
      </div>
    </form>
  );
}
