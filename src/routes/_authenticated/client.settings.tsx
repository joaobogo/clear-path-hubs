import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getClientContext,
  getClientSettings,
  updateClientCompanyProfile,
  updateClientNotificationPreferences,
  updateClientTimezone,
} from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Info,
  LogOut,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load settings: {error.message}</div>
  ),
  component: SettingsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const NOTIF_KEYS = [
  { key: "candidate_delivered", label: "Candidate delivered", desc: "A new candidate has been delivered to your workspace." },
  { key: "interview_request", label: "Interview request", desc: "The TaaSFlow team requests an interview time." },
  { key: "new_message", label: "New message", desc: "Someone sends you a workspace message." },
  { key: "offer_update", label: "Offer update", desc: "An offer changes stage (extended, accepted, declined)." },
  { key: "hire_update", label: "Hire update", desc: "A candidate becomes a hire." },
] as const;

type NotifKey = (typeof NOTIF_KEYS)[number]["key"];

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function SettingsPage() {
  const ctxFn = useServerFn(getClientContext);
  const settingsFn = useServerFn(getClientSettings);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const readOnlySupport = support.readOnly;

  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const role = ctx?.active?.role;
  const isViewer = role === "client_viewer";
  const isAdmin = role === "client_admin" || role === "platform_admin" || role === "operations";

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["client-settings", orgId],
    queryFn: () => settingsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });

  if (ctxLoading || (!settings && isLoading)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </main>
    );
  }

  if (!orgId || !settings) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {error ? (error as Error).message : "No workspace selected."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <header>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Settings
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {settings.company.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace details, notifications, and account preferences.
        </p>
      </header>

      {readOnlySupport && (
        <BannerAmber>
          You are viewing as an administrator — settings changes are disabled.
        </BannerAmber>
      )}
      {isViewer && !readOnlySupport && (
        <BannerAmber>
          You have viewer access — ask a workspace admin to change these settings.
        </BannerAmber>
      )}

      <CompanyProfileSection
        orgId={orgId}
        initial={settings.company}
        approved={settings.approved}
        canEdit={!!isAdmin && !readOnlySupport}
      />

      <NotificationsSection
        orgId={orgId}
        initial={settings.notifications}
        canEdit={!isViewer && !readOnlySupport}
      />

      <CommunicationSection
        orgId={orgId}
        initial={settings.notifications}
        canEdit={!isViewer && !readOnlySupport}
      />

      <TimezoneSection
        orgId={orgId}
        initial={settings.account.timezone}
        canEdit={!isViewer && !readOnlySupport}
      />

      <SecuritySection email={settings.account.email} />

      <AccountSection
        email={settings.account.email}
        fullName={settings.account.full_name}
        role={role ?? "client_viewer"}
      />
    </main>
  );
}

function BannerAmber({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ─────────────────────── COMPANY PROFILE ─────────────────────── */

type Company = {
  id: string;
  name: string;
  website: string;
  industry: string;
  headquarters: string;
  phone: string;
};

function CompanyProfileSection({
  orgId,
  initial,
  approved,
  canEdit,
}: {
  orgId: string;
  initial: Company;
  approved: boolean;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<Company>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Company, string>>>({});
  const qc = useQueryClient();
  const fn = useServerFn(updateClientCompanyProfile);

  // Re-sync when server data refreshes (e.g. after org switch).
  useEffect(() => setForm(initial), [initial]);
  const dirty = useMemo(
    () =>
      (["name", "website", "industry", "headquarters", "phone"] as (keyof Company)[]).some(
        (k) => (form[k] ?? "") !== (initial[k] ?? ""),
      ),
    [form, initial],
  );

  const save = useMutation({
    mutationFn: () =>
      fn({
        data: {
          orgId,
          name: form.name,
          website: form.website || null,
          industry: form.industry || null,
          headquarters: form.headquarters || null,
          phone: form.phone || null,
        },
      }),
    onSuccess: () => {
      toast.success("Company profile saved");
      setErrors({});
      qc.invalidateQueries({ queryKey: ["client-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["client-context"] });
    },
    onError: (e: Error) => {
      setForm(initial); // restore previous values on failure
      const msg = e.message.replace(/^Error: /, "");
      toast.error(msg || "Could not save company profile");
    },
  });

  const validate = (): boolean => {
    const next: Partial<Record<keyof Company, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      next.name = "Company name must be at least 2 characters.";
    if (form.name.length > 200) next.name = "Company name must be under 200 characters.";
    if (form.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(form.website.trim()))
      next.website = "Include https:// and a valid domain.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <SectionCard
      icon={<Building2 className="h-5 w-5" />}
      title="Company profile"
      description="Shown to the TaaSFlow team on your account and used across communications."
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field
          id="cp-name"
          label="Company name"
          required
          error={errors.name}
        >
          <Input
            id="cp-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-invalid={!!errors.name}
            autoComplete="organization"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cp-website" label="Website" error={errors.website} hint="e.g. https://acme.com">
            <Input
              id="cp-website"
              type="url"
              inputMode="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
              aria-invalid={!!errors.website}
            />
          </Field>
          <Field id="cp-industry" label="Industry">
            <Input
              id="cp-industry"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g. Fintech"
            />
          </Field>
          <Field id="cp-hq" label="Headquarters">
            <Input
              id="cp-hq"
              value={form.headquarters}
              onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
              placeholder="City, Country"
              autoComplete="address-level2"
            />
          </Field>
          <Field id="cp-phone" label="Phone">
            <Input
              id="cp-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
            />
          </Field>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {approved ? (
            <>
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Company details approved by TaaSFlow.</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>Company details pending review.</span>
            </>
          )}
        </div>
      </fieldset>
      {canEdit && (
        <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setForm(initial);
              setErrors({});
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => {
              if (!validate()) return;
              save.mutate();
            }}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─────────────────────── NOTIFICATIONS ─────────────────────── */

type Notifications = {
  candidate_delivered: boolean;
  interview_request: boolean;
  new_message: boolean;
  offer_update: boolean;
  hire_update: boolean;
  email_enabled: boolean;
  digest: "immediate" | "daily" | "off";
};

function useNotifSave(orgId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(updateClientNotificationPreferences);
  return useMutation({
    mutationFn: (row: Notifications) =>
      fn({
        data: {
          orgId,
          ...row,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-settings", orgId] });
    },
  });
}

function NotificationsSection({
  orgId,
  initial,
  canEdit,
}: {
  orgId: string;
  initial: Notifications;
  canEdit: boolean;
}) {
  const [row, setRow] = useState<Notifications>(initial);
  useEffect(() => setRow(initial), [initial]);
  const save = useNotifSave(orgId);

  const toggle = async (key: NotifKey, value: boolean) => {
    if (!canEdit) return;
    const previous = row;
    const next = { ...row, [key]: value };
    setRow(next);
    try {
      await save.mutateAsync(next);
      toast.success("Preference saved");
    } catch (e) {
      setRow(previous); // restore previous value on failure
      toast.error((e as Error).message.replace(/^Error: /, "") || "Could not save preference");
    }
  };

  return (
    <SectionCard
      icon={<Bell className="h-5 w-5" />}
      title="Notifications"
      description="Choose which workspace events send you a notification."
    >
      <ul className="divide-y">
        {NOTIF_KEYS.map((n) => (
          <li key={n.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Label htmlFor={`n-${n.key}`} className="text-sm font-medium">
                {n.label}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.desc}</p>
            </div>
            <Switch
              id={`n-${n.key}`}
              checked={row[n.key]}
              onCheckedChange={(v) => toggle(n.key, !!v)}
              disabled={!canEdit || save.isPending}
              aria-label={n.label}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ─────────────────── COMMUNICATION PREFERENCES ─────────────────── */

function CommunicationSection({
  orgId,
  initial,
  canEdit,
}: {
  orgId: string;
  initial: Notifications;
  canEdit: boolean;
}) {
  const [row, setRow] = useState<Notifications>(initial);
  useEffect(() => setRow(initial), [initial]);
  const save = useNotifSave(orgId);

  const commit = async (patch: Partial<Notifications>) => {
    if (!canEdit) return;
    const previous = row;
    const next = { ...row, ...patch };
    setRow(next);
    try {
      await save.mutateAsync(next);
      toast.success("Communication preferences saved");
    } catch (e) {
      setRow(previous);
      toast.error((e as Error).message.replace(/^Error: /, "") || "Could not save preferences");
    }
  };

  return (
    <SectionCard
      icon={<Mail className="h-5 w-5" />}
      title="Communication preferences"
      description="How and when TaaSFlow reaches you for the notifications above."
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="cp-email" className="text-sm font-medium">
              Email delivery
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Send enabled notifications to {" "}
              <span className="font-medium text-foreground">your work email</span>.
              In-app notifications continue regardless.
            </p>
          </div>
          <Switch
            id="cp-email"
            checked={row.email_enabled}
            onCheckedChange={(v) => commit({ email_enabled: !!v })}
            disabled={!canEdit || save.isPending}
            aria-label="Email delivery"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-digest" className="text-sm font-medium">
            Delivery cadence
          </Label>
          <Select
            value={row.digest}
            onValueChange={(v) => commit({ digest: v as Notifications["digest"] })}
            disabled={!canEdit || save.isPending}
          >
            <SelectTrigger id="cp-digest" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediate — send each event as it happens</SelectItem>
              <SelectItem value="daily">Daily digest — one summary each morning</SelectItem>
              <SelectItem value="off">Off — no emails (in-app only)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            You can still see everything in the workspace and in Messages.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/* ─────────────────────── TIMEZONE ─────────────────────── */

function TimezoneSection({
  orgId,
  initial,
  canEdit,
}: {
  orgId: string;
  initial: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const qc = useQueryClient();
  const fn = useServerFn(updateClientTimezone);

  const detected = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);
  const options = useMemo(() => {
    const set = new Set<string>(COMMON_TIMEZONES);
    if (detected) set.add(detected);
    if (initial) set.add(initial);
    return Array.from(set).sort();
  }, [detected, initial]);

  const commit = async (next: string) => {
    if (!canEdit || next === initial) return;
    const previous = value;
    setValue(next);
    try {
      await fn({ data: { orgId, timezone: next } });
      toast.success("Timezone saved");
      qc.invalidateQueries({ queryKey: ["client-settings", orgId] });
    } catch (e) {
      setValue(previous);
      toast.error((e as Error).message.replace(/^Error: /, "") || "Could not save timezone");
    }
  };

  return (
    <SectionCard
      icon={<Clock className="h-5 w-5" />}
      title="Timezone"
      description="Interview times, digests, and activity timestamps use this timezone."
    >
      <div className="space-y-2">
        <Label htmlFor="tz-select" className="text-sm">
          Your timezone
        </Label>
        <Select value={value} onValueChange={commit} disabled={!canEdit}>
          <SelectTrigger id="tz-select" className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {detected && detected !== value && canEdit && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => commit(detected)}
          >
            Use detected timezone: {detected.replace(/_/g, " ")}
          </button>
        )}
      </div>
    </SectionCard>
  );
}

/* ─────────────────────── SECURITY ─────────────────────── */

function SecuritySection({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const sendReset = async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent — check your inbox.");
    } catch (e) {
      toast.error((e as Error).message || "Could not send password reset");
    } finally {
      setSending(false);
    }
  };

  return (
    <SectionCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Security"
      description="Manage sign-in credentials for your TaaSFlow account."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">Password</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We'll email you a secure link to set a new password.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={sendReset} disabled={!email || sending}>
          {sending ? "Sending…" : "Send reset email"}
        </Button>
      </div>
    </SectionCard>
  );
}

/* ─────────────────────── ACCOUNT ─────────────────────── */

function AccountSection({
  email,
  fullName,
  role,
}: {
  email: string;
  fullName: string;
  role: string;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      window.location.assign("/auth");
    } catch (e) {
      toast.error((e as Error).message || "Could not sign out");
      setSigningOut(false);
    }
  };

  return (
    <SectionCard
      icon={<User className="h-5 w-5" />}
      title="Account"
      description="Your personal account within this workspace."
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Name</dt>
          <dd className="mt-0.5 text-sm font-medium">{fullName || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="mt-0.5 text-sm font-medium">{email || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Workspace role</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {role.replace(/_/g, " ")}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex items-center justify-end border-t pt-4">
        <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
          <LogOut className="mr-1.5 h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </SectionCard>
  );
}
