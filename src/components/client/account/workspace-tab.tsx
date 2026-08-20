import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientSettings, updateClientCompanyProfile, updateClientTimezone } from "@/lib/client-settings.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 Building2,
 CheckCircle2,
 Clock,
 LogOut,
 MessagesSquare,
 ShieldCheck,
 User,
} from "lucide-react";
import { TeamsConnectionCard } from "@/components/client/teams-connection-card";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { BannerAmber, SectionCard, Field } from "@/components/client/account/shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

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

export function WorkspaceTab() {
 const ctxFn = useServerFn(getClientContext);
 const settingsFn = useServerFn(getClientSettings);
 const orgSearch = useClientOrgSearch();
 const support = useSupportView();
 const readOnlySupport = support.readOnly;

 const ctxQuery = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const ctxState = useQueryState(ctxQuery);
 const ctx = ctxState.data;
 const ctxLoading = ctxState.isLoading;
 const orgId = ctx?.active?.organization_id;
 const role = ctx?.active?.role;
 const isViewer = role === "client_viewer";
 const isAdmin = role === "client_admin" || role === "platform_admin" || role === "operations";

 const settingsQuery = useQuery({
 queryKey: ["client-settings", orgId],
 queryFn: () => settingsFn({ data: { orgId: orgId! } }),
 enabled: !!orgId,
 placeholderData: (prev) => prev,
 });
 const settingsState = useQueryState(settingsQuery);
 const settings = settingsState.data;
 const isLoading = settingsState.isLoading;

 if (ctxState.isError) {
 return (
 <div className="space-y-6">
 <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
 </div>
 );
 }

 if (ctxLoading || (!settings && isLoading)) {
 return (
 <div className="space-y-4">
 <div className="h-8 w-40 animate-pulse rounded bg-muted" />
 {[0, 1, 2, 3].map((i) => (
 <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
 ))}
 </div>
 );
 }

 if (settingsState.isError) {
 return (
 <div className="space-y-6">
 <QueryErrorCard error={settingsState.error} onRetry={settingsState.retry} retrying={settingsState.retrying} />
 </div>
 );
 }

 if (!orgId || !settings) {
 return (
 <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
 No workspace selected.
 </div>
 );
 }

 return (
 <div className="space-y-6">
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
 </div>
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

const FIELD_ID: Record<keyof Company, string> = {
 id: "",
 name: "cp-name",
 website: "cp-website",
 industry: "cp-industry",
 headquarters: "cp-hq",
 phone: "cp-phone",
};

function normalizeWebsite(s: string) {
 const t = s.trim();
 if (t === "") return "";
 if (/^https?:\/\//i.test(t)) return t;
 return `https://${t}`;
}

function focusField(field: keyof Company) {
 const id = FIELD_ID[field];
 if (!id) return;
 const el = document.getElementById(id) as HTMLElement | null;
 if (!el) return;
 el.scrollIntoView({ behavior: "smooth", block: "center" });
 const focusable = el.querySelector<HTMLElement>("input, textarea, select") ?? el;
 focusable.focus();
}

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
 const [form, setForm] = useState<Company>(() => ({
   ...initial,
   website: normalizeWebsite(initial.website),
 }));
 const [errors, setErrors] = useState<Partial<Record<keyof Company, string>>>({});
 const [retainInput, setRetainInput] = useState(false);
 const qc = useQueryClient();
 const fn = useServerFn(updateClientCompanyProfile);

 // Re-sync when server data refreshes (e.g. after org switch), but never
 // overwrite a user's failed edit — they need to see the error and fix it.
 useEffect(() => {
   if (!retainInput) {
     setForm({ ...initial, website: normalizeWebsite(initial.website) });
   }
 }, [initial, retainInput]);
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
          website: normalizeWebsite(form.website) || null,
          industry: form.industry || null,
          headquarters: form.headquarters || null,
          phone: form.phone || null,
        },
      }),
    onSuccess: () => {
      toast.success("Company profile saved");
      setErrors({});
      setRetainInput(false);
      qc.invalidateQueries({ queryKey: ["client-settings", orgId] });
      qc.invalidateQueries({ queryKey: ["client-context"] });
    },
    onError: (e: unknown) => {
      setRetainInput(true);
      // Field-level validation is handled before submit; if the server still
      // rejects the input, surface it on the field and focus it.
      const msg = e instanceof Error ? e.message.replace(/^Error: /, "") : "";
      if (msg.startsWith("[") && msg.includes('"path"')) {
        try {
          const parsed = JSON.parse(msg) as Array<{ message: string; path: (string | number)[] }>;
          const next: Partial<Record<keyof Company, string>> = {};
          parsed.forEach((issue) => {
            const key = issue.path[0] as keyof Company;
            if (key) next[key] = issue.message;
          });
          setErrors(next);
          const first = (Object.keys(next) as (keyof Company)[])[0];
          if (first) setTimeout(() => focusField(first), 0);
          return;
        } catch {
          // fall through to generic toast
        }
      }
      toastError(e, { fallback: "Could not save company profile", tone: "client" });
    },
  });

  const validate = (): { ok: boolean; errors: Partial<Record<keyof Company, string>> } => {
    const next: Partial<Record<keyof Company, string>> = {};
    const name = form.name.trim();
    if (!name || name.length < 2)
      next.name = "Company name must be at least 2 characters.";
    if (name.length > 200) next.name = "Company name must be under 200 characters.";
    const website = form.website.trim();
    const normalized = normalizeWebsite(website);
    if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(normalized))
      next.website = "Website must start with http:// or https://.";
    setErrors(next);
    return { ok: Object.keys(next).length === 0, errors: next };
  };

  const handleSave = () => {
    const { ok, errors: validationErrors } = validate();
    if (!ok) {
      const first = (Object.keys(validationErrors) as (keyof Company)[])[0];
      if (first) setTimeout(() => focusField(first), 0);
      return;
    }
    save.mutate();
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
 <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
 <BadgeCheck className="h-3.5 w-3.5 taas-fg-success" />
 <span>Company details approved by TaaSFlow.</span>
 </>
 ) : (
 <>
 <Clock className="h-3.5 w-3.5 taas-fg-warning" />
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
    toastError(e, { fallback: "Could not save timezone", tone: "client" });
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
 <SelectTrigger id="tz-select" className="w-full max-w-sm">
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
    toastError(e, { fallback: "Could not send password reset", tone: "client" });
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
    toastError(e, { fallback: "Could not sign out", tone: "client" });
    setSigningOut(false);
  }
 };

 return (
 <SectionCard
 icon={<User className="h-5 w-5" />}
 title="Account"
 description="Your personal account within this workspace."
 >
 <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
 <div className="min-w-0">
 <dt className="text-xs text-muted-foreground">Name</dt>
 <dd className="mt-0.5 truncate text-sm font-medium">{fullName || "—"}</dd>
 </div>
 <div className="min-w-0">
 <dt className="text-xs text-muted-foreground">Email</dt>
 <dd className="mt-0.5 truncate text-sm font-medium">{email || "—"}</dd>
 </div>
 <div className="min-w-0">
 <dt className="text-xs text-muted-foreground">Workspace role</dt>
 <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium">
 <CheckCircle2 className="h-3.5 w-3.5 taas-fg-success" />
 {role.replace(/_/g, " ")}
 </dd>
 </div>
 </dl>
 <div className="mt-5 flex items-center justify-end border-t pt-4">
 <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut} aria-label="Sign out of account">
 <LogOut className="mr-1.5 h-4 w-4" />
 {signingOut ? "Signing out…" : "Sign out"}
 </Button>
 </div>
 </SectionCard>
 );
}
