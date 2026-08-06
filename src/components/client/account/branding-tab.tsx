import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getClientContext, updateClientBranding } from "@/lib/client-context.functions";
import { getClientSettings } from "@/lib/client-settings.functions";
import { ClientBrandHeader } from "@/components/client/client-brand-header";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, BadgeCheck } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { BannerAmber, SectionCard, Field } from "@/components/client/account/shared";

type BrandingInitial = {
 logo_url: string | null;
 brand_display_name: string | null;
 brand_primary_color: string | null;
 brand_accent_color: string | null;
 fallbackName: string;
};

export function BrandingTab() {
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
 <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
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

 <BrandingSection
 orgId={orgId}
 initial={{
 logo_url: ctx?.active?.logo_url ?? null,
 brand_display_name: ctx?.active?.brand_display_name ?? null,
 brand_primary_color: ctx?.active?.brand_primary_color ?? null,
 brand_accent_color: ctx?.active?.brand_accent_color ?? null,
 fallbackName: settings.company.name,
 }}
 canEdit={!!isAdmin && !readOnlySupport}
 />
 </div>
 );
}

function BrandingSection({
 orgId,
 initial,
 canEdit,
}: {
 orgId: string;
 initial: BrandingInitial;
 canEdit: boolean;
}) {
 const qc = useQueryClient();
 const fn = useServerFn(updateClientBranding);
 const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? "");
 const [displayName, setDisplayName] = useState(initial.brand_display_name ?? "");
 const [primary, setPrimary] = useState(initial.brand_primary_color ?? "");
 const [accent, setAccent] = useState(initial.brand_accent_color ?? "");
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 setLogoUrl(initial.logo_url ?? "");
 setDisplayName(initial.brand_display_name ?? "");
 setPrimary(initial.brand_primary_color ?? "");
 setAccent(initial.brand_accent_color ?? "");
 }, [initial.logo_url, initial.brand_display_name, initial.brand_primary_color, initial.brand_accent_color]);

 const hex = /^#[0-9a-fA-F]{6}$/;
 const save = useMutation({
 mutationFn: async () => {
 if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
 throw new Error("Logo URL must start with https://");
 }
 if (primary && !hex.test(primary)) throw new Error("Primary color must be a #RRGGBB hex value.");
 if (accent && !hex.test(accent)) throw new Error("Accent color must be a #RRGGBB hex value.");
 return fn({
 data: {
 orgId,
 logo_url: logoUrl.trim() || null,
 brand_display_name: displayName.trim() || null,
 brand_primary_color: primary.trim() || null,
 brand_accent_color: accent.trim() || null,
 },
 });
 },
 onSuccess: () => {
 setError(null);
 toast.success("Branding saved");
 qc.invalidateQueries({ queryKey: ["client-context"] });
 qc.invalidateQueries({ queryKey: ["client-settings", orgId] });
 },
 onError: (e: Error) => setError(e.message.replace(/^Error: /, "")),
 });

 return (
 <SectionCard
 icon={<BadgeCheck className="h-5 w-5" />}
 title="Workspace branding"
 description="Your logo and colors appear on the workspace header — TaaSFlow product framing stays intact."
 >
 <fieldset disabled={!canEdit} className="space-y-4">
 <div className="min-w-0 rounded-xl border bg-muted/30 p-3">
 <ClientBrandHeader
 name={initial.fallbackName}
 displayName={displayName || null}
 logoUrl={logoUrl || null}
 primaryColor={hex.test(primary) ? primary : null}
 accentColor={hex.test(accent) ? accent : null}
 parentName={null}
 role="client_admin"
 />
 <p className="mt-2 text-xs text-muted-foreground">Live preview</p>
 </div>

 <Field id="br-name" label="Display name" hint="Overrides the company name shown in the header. Optional.">
 <Input
 id="br-name"
 value={displayName}
 onChange={(e) => setDisplayName(e.target.value)}
 placeholder={initial.fallbackName}
 maxLength={120}
 />
 </Field>
 <Field id="br-logo" label="Logo URL" hint="Public https URL to a PNG or SVG. Square/round crops look best.">
 <Input
 id="br-logo"
 type="url"
 inputMode="url"
 value={logoUrl}
 onChange={(e) => setLogoUrl(e.target.value)}
 placeholder="https://cdn.example.com/logo.png"
 />
 </Field>
 <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
 <Field id="br-primary" label="Primary color" hint="#RRGGBB">
 <div className="flex items-center gap-2">
 <input
 type="color"
 aria-label="Pick primary color"
 value={hex.test(primary) ? primary : "#000000"}
 onChange={(e) => setPrimary(e.target.value)}
 className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-background"
 />
 <Input
 id="br-primary"
 value={primary}
 onChange={(e) => setPrimary(e.target.value)}
 placeholder="#0F172A"
 maxLength={7}
 className="min-w-0"
 />
 </div>
 </Field>
 <Field id="br-accent" label="Accent color" hint="#RRGGBB">
 <div className="flex items-center gap-2">
 <input
 type="color"
 aria-label="Pick accent color"
 value={hex.test(accent) ? accent : "#000000"}
 onChange={(e) => setAccent(e.target.value)}
 className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-background"
 />
 <Input
 id="br-accent"
 value={accent}
 onChange={(e) => setAccent(e.target.value)}
 placeholder="#3B82F6"
 maxLength={7}
 className="min-w-0"
 />
 </div>
 </Field>
 </div>

 {error && (
 <div className="flex items-start gap-2 rounded-md border taas-bd-danger taas-bg-danger-solid/[0.05] px-3 py-2 text-sm">
 <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 taas-fg-danger" />
 <span>{error}</span>
 </div>
 )}

 <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
 <Button
 variant="ghost"
 onClick={() => {
 setLogoUrl("");
 setDisplayName("");
 setPrimary("");
 setAccent("");
 }}
 >
 Clear
 </Button>
 <Button onClick={() => save.mutate()} disabled={save.isPending}>
 {save.isPending ? "Saving…" : "Save branding"}
 </Button>
 </div>
 </fieldset>
 </SectionCard>
 );
}
