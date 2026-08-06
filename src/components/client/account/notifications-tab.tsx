import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { NotificationPreferences } from "@/components/client/notification-preferences";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { BannerAmber } from "@/components/client/account/shared";

export function NotificationsTab() {
 const ctxFn = useServerFn(getClientContext);
 const orgSearch = useClientOrgSearch();
 const support = useSupportView();
 const readOnlySupport = support.readOnly;

 const ctxQuery = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const ctxState = useQueryState(ctxQuery);
 const ctx = ctxState.data;
 const orgId = ctx?.active?.organization_id;
 const role = ctx?.active?.role;
 const isViewer = role === "client_viewer";

 if (ctxState.isError) {
 return (
 <div className="space-y-6">
 <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
 </div>
 );
 }

 if (ctxState.isLoading) {
 return (
 <div className="space-y-4">
 <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
 </div>
 );
 }

 if (!orgId) {
 return (
 <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
 No workspace selected.
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <header>
 <h2 className="text-base font-semibold">Notifications</h2>
 <p className="mt-0.5 text-sm text-muted-foreground">
 Choose how you'd like to be notified for each workspace event.
 </p>
 </header>

 {isViewer && !readOnlySupport && (
 <BannerAmber>
 You have viewer access — ask a workspace admin to change these settings.
 </BannerAmber>
 )}

 <NotificationPreferences orgId={orgId} canEdit={!isViewer && !readOnlySupport} />
 </div>
 );
}
