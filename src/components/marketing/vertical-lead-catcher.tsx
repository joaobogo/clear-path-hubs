/**
 * Vertical lead catcher — Part 7, prompt 47.
 *
 * Four ways into a conversation, matched to how each industry actually buys,
 * all feeding the one lead pipeline with vertical, page and source recorded:
 *
 *   1. Scoped enquiry   — six fields, no essay box required.
 *   2. Estimator        — role cost and time-to-shortlist from our own
 *                         published pricing and delivery commitment.
 *   3. Sector briefing  — a print-ready briefing for this vertical.
 *   4. Book a call      — hands off to the existing call flow.
 *
 * Anything the visitor types here is handed to the intake form later
 * (prompt 48) so nobody types the same thing twice.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calculator, CalendarDays, Check, Download, Loader2, Send } from "lucide-react";

import { PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { BookACallDialog } from "@/components/marketing/book-a-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { submitInquiry } from "@/lib/inquiry.functions";
import { storeLeadPrefill } from "@/lib/marketing/lead-prefill";
import {
  SENIORITY_LABEL,
  URGENCY_LABEL,
  VOLUME_LABEL,
  type LeadSeniority,
  type LeadUrgency,
  type LeadVolume,
} from "@/lib/marketing/lead-routing";
import {
  PRICE_MULTI_USD,
  PRICE_PILOT_USD,
  PRICE_SPRINT_USD,
  PRICE_SUB_GOLD_FROM_USD,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

type Props = {
  verticalSlug: string;
  verticalName: string;
};

type Shared = {
  name: string;
  email: string;
  company: string;
  roleTitle: string;
  seniority: LeadSeniority;
  volume: LeadVolume;
  urgency: LeadUrgency;
  message: string;
  website: string;
};

const EMPTY: Shared = {
  name: "",
  email: "",
  company: "",
  roleTitle: "",
  seniority: "senior",
  volume: "one",
  urgency: "this_quarter",
  message: "",
  website: "",
};

const SENIORITIES: LeadSeniority[] = ["junior", "mid", "senior", "executive"];
const VOLUMES: LeadVolume[] = ["one", "two_to_five", "six_to_ten", "eleven_plus"];
const URGENCIES: LeadUrgency[] = ["immediate", "this_quarter", "exploring"];

function packageFor(volume: LeadVolume): { label: string; usd: number | null; note: string } {
  if (volume === "one") return { label: "Pilot — 1 active role", usd: PRICE_PILOT_USD, note: "One role, full workflow." };
  if (volume === "two_to_five") return { label: "Multi Role — 2–5 roles", usd: PRICE_MULTI_USD, note: "One package covering the set." };
  if (volume === "six_to_ten") return { label: "Sprint — 6–10 roles", usd: PRICE_SPRINT_USD, note: "Concurrent mandates, one desk." };
  return { label: "Subscription — 11+ roles", usd: PRICE_SUB_GOLD_FROM_USD, note: "From this level, priced as a monthly subscription." };
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function VerticalLeadCatcher({ verticalSlug, verticalName }: Props) {
  const [form, setForm] = useState<Shared>(EMPTY);
  const [tab, setTab] = useState("enquiry");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "enquiry" | "estimate" | "briefing">(null);
  const send = useServerFn(submitInquiry);

  // Estimator inputs the visitor controls — labelled as theirs, not ours.
  const [salary, setSalary] = useState(90_000);
  const [agencyPct, setAgencyPct] = useState(20);

  const set = <K extends keyof Shared>(k: K, v: Shared[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pkg = useMemo(() => packageFor(form.volume), [form.volume]);
  const roles = form.volume === "one" ? 1 : form.volume === "two_to_five" ? 3 : form.volume === "six_to_ten" ? 8 : 12;
  const agencyCost = Math.round((salary * agencyPct) / 100) * roles;

  async function submit(kind: "enquiry" | "estimate" | "briefing") {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Your name and work email, and we can take it from there.");
      return;
    }
    setBusy(true);
    try {
      const res = await send({
        data: {
          kind,
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          role_title: form.roleTitle.trim(),
          role_count: VOLUME_LABEL[form.volume as Exclude<LeadVolume, "unknown">],
          message: form.message.trim(),
          industry_slug: verticalSlug,
          source_path: typeof window !== "undefined" ? window.location.pathname : `/industries/${verticalSlug}`,
          seniority: form.seniority as Exclude<LeadSeniority, "unknown">,
          volume: form.volume as Exclude<LeadVolume, "unknown">,
          urgency: form.urgency as Exclude<LeadUrgency, "unknown">,
          details:
            kind === "estimate"
              ? { salary, agencyPct, roles, agencyCost, package: pkg.label }
              : { vertical: verticalName },
          website: form.website,
        },
      });
      storeLeadPrefill({
        token: res.prefillToken,
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        roleTitle: form.roleTitle.trim(),
        verticalSlug,
      });
      setDone(kind);
      toast.success(
        kind === "briefing"
          ? "Briefing unlocked below — and sent to your inbox record."
          : "Got it. A person will reply, not an autoresponder.",
      );
    } catch {
      toast.error("That didn't send. Try again, or email hello@taasflow.com.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <span id="talk" className="sr-only" aria-hidden />
      <PublicPage>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/70">
            {verticalName} · get started
          </p>
          <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)] sm:text-3xl">
            Four ways in. Pick whichever suits how you buy.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            Whatever you tell us here is carried into your brief, so you never
            type the same thing twice.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-white/70 p-1">
            <TabsTrigger value="enquiry" className="gap-2 text-sm"><Send className="h-4 w-4" />Scoped enquiry</TabsTrigger>
            <TabsTrigger value="estimate" className="gap-2 text-sm"><Calculator className="h-4 w-4" />Cost &amp; time estimate</TabsTrigger>
            <TabsTrigger value="briefing" className="gap-2 text-sm"><Download className="h-4 w-4" />Sector briefing</TabsTrigger>
            <TabsTrigger value="call" className="gap-2 text-sm"><CalendarDays className="h-4 w-4" />Book a call</TabsTrigger>
          </TabsList>

          {/* ---------------- Shared scoped fields ---------------- */}
          <TabsContent value="enquiry" className="mt-6">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <ScopedFields form={form} set={set} verticalName={verticalName} />
              <div className="mt-4">
                <Label htmlFor="lead-message" className="text-sm">Anything else worth knowing (optional)</Label>
                <Textarea
                  id="lead-message"
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  rows={3}
                  className="mt-1.5"
                  placeholder="What has stopped this hire so far?"
                />
              </div>
              <Honeypot form={form} set={set} />
              <Button className="mt-5" disabled={busy} onClick={() => void submit("enquiry")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send enquiry
              </Button>
              {done === "enquiry" && <Confirmation />}
            </div>
          </TabsContent>

          {/* ---------------- Estimator ---------------- */}
          <TabsContent value="estimate" className="mt-6">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="est-salary" className="text-sm">Typical base salary for this role</Label>
                  <Input
                    id="est-salary"
                    type="number"
                    min={20000}
                    step={5000}
                    value={salary}
                    onChange={(e) => setSalary(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="est-pct" className="text-sm">Agency fee you pay today (%)</Label>
                  <Input
                    id="est-pct"
                    type="number"
                    min={0}
                    max={40}
                    value={agencyPct}
                    onChange={(e) => setAgencyPct(Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div className="mt-4">
                <ScopedFields form={form} set={set} verticalName={verticalName} compact />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat label="Your current fee model" value={money(agencyCost)} note={`${roles} role${roles > 1 ? "s" : ""} at ${agencyPct}% of ${money(salary)} — your numbers, not ours.`} />
                <Stat label="TaaSFlow package" value={pkg.usd ? money(pkg.usd) : "Custom"} note={`${pkg.label}. ${pkg.note}`} />
                <Stat
                  label="Time to first shortlist"
                  value={TURNAROUND_LABEL}
                  note="Our published commitment for every tier. Actual delivery per role is tracked against it in your workspace."
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--brand-navy)]/70">
                Prices are our published list prices. The comparison uses the
                salary and fee percentage you entered — we don't assume what
                you pay today.
              </p>

              <Honeypot form={form} set={set} />
              <Button className="mt-5" disabled={busy} onClick={() => void submit("estimate")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send me this estimate
              </Button>
              {done === "estimate" && <Confirmation />}
            </div>
          </TabsContent>

          {/* ---------------- Sector briefing ---------------- */}
          <TabsContent value="briefing" className="mt-6">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
                The {verticalName} hiring briefing
              </h3>
              <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                The role families we cover, the evidence we score against, the
                certifications that matter in this sector, and what a shortlist
                looks like. Print-ready, no gated video, no drip sequence.
              </p>
              <div className="mt-4">
                <ScopedFields form={form} set={set} verticalName={verticalName} compact />
              </div>
              <Honeypot form={form} set={set} />
              {done === "briefing" ? (
                <div className="mt-5">
                  <Button asChild>
                    <Link to="/industries/$slug/briefing" params={{ slug: verticalSlug }}>
                      Open the briefing
                    </Link>
                  </Button>
                  <Confirmation />
                </div>
              ) : (
                <Button className="mt-5" disabled={busy} onClick={() => void submit("briefing")}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Get the briefing
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ---------------- Book a call ---------------- */}
          <TabsContent value="call" className="mt-6">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
                Speak to the person who would run your {verticalName.toLowerCase()} search
              </h3>
              <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                Twenty minutes, no deck. We'll tell you if we're not the right fit.
              </p>
              <BookACallDialog
                industrySlug={verticalSlug}
                industryName={verticalName}
                roleTitle={form.roleTitle || undefined}
                trigger={<Button className="mt-5">Pick a time</Button>}
              />
            </div>
          </TabsContent>
        </Tabs>
      </PublicPage>
    </PublicSection>
  );
}

function ScopedFields({
  form,
  set,
  verticalName,
  compact = false,
}: {
  form: Shared;
  set: <K extends keyof Shared>(k: K, v: Shared[K]) => void;
  verticalName: string;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="lead-name" label="Your name" value={form.name} onChange={(v) => set("name", v)} />
      <Field id="lead-email" label="Work email" type="email" value={form.email} onChange={(v) => set("email", v)} />
      {!compact && (
        <>
          <Field id="lead-company" label="Company" value={form.company} onChange={(v) => set("company", v)} />
          <Field
            id="lead-role"
            label="Role you're hiring"
            value={form.roleTitle}
            onChange={(v) => set("roleTitle", v)}
            placeholder={`e.g. Head of ${verticalName}`}
          />
        </>
      )}
      <Choice
        label="Seniority"
        value={form.seniority}
        options={SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABEL[s as Exclude<LeadSeniority, "unknown">] }))}
        onChange={(v) => set("seniority", v as LeadSeniority)}
      />
      <Choice
        label="How many roles"
        value={form.volume}
        options={VOLUMES.map((v) => ({ value: v, label: VOLUME_LABEL[v as Exclude<LeadVolume, "unknown">] }))}
        onChange={(v) => set("volume", v as LeadVolume)}
      />
      <Choice
        label="Timing"
        value={form.urgency}
        options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u as Exclude<LeadUrgency, "unknown">] }))}
        onChange={(v) => set("urgency", v as LeadUrgency)}
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1.5" />
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-[color:var(--brand-navy)]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              value === o.value
                ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-[color:var(--brand-cream)]"
                : "border-[color:var(--brand-navy)]/20 text-[color:var(--brand-navy)]/75 hover:border-[color:var(--brand-navy)]/50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/50 p-4">
      <p className="text-xs uppercase tracking-[0.1em] text-[color:var(--brand-navy)]/70">{label}</p>
      <p className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--brand-navy)]/65">{note}</p>
    </div>
  );
}

function Confirmation() {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-[color:var(--brand-navy)]/75">
      <Check className="h-4 w-4" /> Received. We reply within one business day — sooner if you said it's urgent.
    </p>
  );
}

function Honeypot({
  form,
  set,
}: {
  form: Shared;
  set: <K extends keyof Shared>(k: K, v: Shared[K]) => void;
}) {
  return (
    <div className="hidden" aria-hidden>
      <label htmlFor="lead-website">Website</label>
      <input
        id="lead-website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
      />
    </div>
  );
}
