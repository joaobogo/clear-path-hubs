import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";

type Intent = "hire" | "candidate" | "existing_client" | "support" | "general";

const INTENTS: Array<{
  id: Intent;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string;
}> = [
  { id: "hire", label: "I want to hire", icon: Briefcase, body: "Start a role, request a consultation, or talk to sales." },
  { id: "candidate", label: "I am a candidate", icon: UserCircle2, body: "Browse open roles or sign in to your candidate workspace." },
  { id: "existing_client", label: "I am an existing Client", icon: Building2, body: "Sign in to your workspace or reach your account team." },
  { id: "support", label: "I need support", icon: LifeBuoy, body: "Report an issue with your account, workspace, or an application." },
  { id: "general", label: "General inquiry", icon: MessageSquare, body: "Press, partnerships, or anything else." },
];

export const Route = createFileRoute("/contact")({
  head: () =>
    marketingHead(undefined, "/contact", {
      title: "Contact — TaaSFlow",
      description:
        "Contact TaaSFlow. Start hiring, ask about a role, reach your account team, request support, or send a general inquiry.",
    }),
  component: ContactPage,
});

function ContactPage() {
  const [intent, setIntent] = useState<Intent>("hire");
  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Contact
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Pick the path that fits. We route each request to the right team so you don&rsquo;t
            wait behind the wrong queue.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Intent selector ─────────────────────────────────────── */}
      <PublicSection className="pb-4">
        <PublicPage>
          <div
            role="tablist"
            aria-label="Contact intent"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {INTENTS.map((opt) => {
              const active = intent === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${opt.id}`}
                  id={`tab-${opt.id}`}
                  onClick={() => setIntent(opt.id)}
                  className={
                    "flex min-h-16 items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-navy)]/40 " +
                    (active
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white hover:border-[color:var(--brand-navy)]/40")
                  }
                >
                  <opt.icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold leading-snug">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Context-aware panel ─────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <div
            role="tabpanel"
            id={`panel-${intent}`}
            aria-labelledby={`tab-${intent}`}
            className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-10"
          >
            {intent === "hire" && <HirePanel />}
            {intent === "candidate" && <CandidatePanel />}
            {intent === "existing_client" && <ExistingClientPanel />}
            {intent === "support" && <ContactForm topic="support" heading="Support request" description="Tell us what went wrong. Include your account email and the URL where you hit the issue." />}
            {intent === "general" && <ContactForm topic="general" heading="General inquiry" description="Press, partnerships, or anything else. We'll route it to the right team." />}
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}

/* ── Panels ─────────────────────────────────────────────────────── */

function HirePanel() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
          Start hiring with TaaSFlow
        </h2>
        <p className="mt-3 text-[color:var(--brand-navy)]/70">
          The fastest path is to submit the role directly. If you&rsquo;d prefer a conversation
          first, book a consultation with sales.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/intake"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Start Hiring
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <a
            href="#hire-form"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
          >
            Contact sales
          </a>
        </div>
      </div>
      <div id="hire-form">
        <ContactForm
          topic="hire_talent"
          heading="Talk to sales"
          description="Share a few details and we'll be in touch."
        />
      </div>
    </div>
  );
}

function CandidatePanel() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
          For candidates
        </h2>
        <p className="mt-3 text-[color:var(--brand-navy)]/70">
          Looking for a role? Browse what&rsquo;s open today. Already applied or joined the
          network? Sign in to your candidate workspace.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/jobs"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Search className="mr-2 h-4 w-4" />
            Browse Jobs
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Candidate Sign In
          </Link>
        </div>
      </div>
      <div>
        <ContactForm
          topic="candidate"
          heading="Have a question?"
          description="If you can't find what you're looking for, send us a note."
        />
      </div>
    </div>
  );
}

function ExistingClientPanel() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
          For existing clients
        </h2>
        <p className="mt-3 text-[color:var(--brand-navy)]/70">
          The fastest way to reach us is inside your workspace — messages there route directly
          to your account team.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Client Sign In
          </Link>
          <a
            href="#client-form"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
          >
            Send a message
          </a>
        </div>
      </div>
      <div id="client-form">
        <ContactForm
          topic="existing_client"
          heading="Message your account team"
          description="Use the email tied to your workspace so we can find the right account."
        />
      </div>
    </div>
  );
}

/* ── Shared form ────────────────────────────────────────────────── */

type Topic = "hire_talent" | "candidate" | "existing_client" | "support" | "general";

function ContactForm({
  topic,
  heading,
  description,
}: {
  topic: Topic;
  heading: string;
  description: string;
}) {
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
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      topic,
      source: "public_contact_form",
      website: String(fd.get("website") ?? ""),
      elapsedMs: Date.now() - mountedAt,
    };

    // Client-side validation
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
      <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-6">
        <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
          Thanks — we&rsquo;ve got it.
        </h3>
        <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
          We&rsquo;ll reply to the email you provided. Reference:{" "}
          <span className="font-mono text-xs">{done.traceId.slice(0, 8) || "—"}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
          {heading}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">{description}</p>
      </div>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`hp-${topic}`}>Website</label>
        <input id={`hp-${topic}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`name-${topic}`}>Name</Label>
          <Input id={`name-${topic}`} name="name" required autoComplete="name" maxLength={120} />
        </div>
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
      </div>
      <div>
        <Label htmlFor={`company-${topic}`}>Company (optional)</Label>
        <Input id={`company-${topic}`} name="company" autoComplete="organization" maxLength={160} />
      </div>
      <div>
        <Label htmlFor={`message-${topic}`}>Message</Label>
        <Textarea
          id={`message-${topic}`}
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder="A few lines about what you need."
        />
      </div>

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
        <span className="text-xs text-[color:var(--brand-navy)]/50">
          We reply to the email you provide.
        </span>
      </div>
    </form>
  );
}
