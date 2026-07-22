import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Building2, Users } from "lucide-react";
import { useSupportView } from "@/lib/support-view";

/**
 * Persistent banner rendered by the client layout whenever a platform staff
 * member is viewing a client workspace via ?org=<uuid>. Explains context and
 * offers the escape hatches required by the spec (§4).
 */
export function SupportViewBanner() {
  const support = useSupportView();
  const navigate = useNavigate();
  if (!support.active) return null;
  const color =
    support.mode === "interactive"
      ? "bg-amber-500/15 border-amber-500/50 text-amber-950 dark:text-amber-100"
      : "bg-primary/10 border-primary/40 text-foreground";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-40 border-b px-4 py-2 text-sm ${color}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            Viewing the dashboard for{" "}
            <span className="font-semibold">
              {support.organizationName ?? "this client"}
            </span>
          </div>
          <div className="text-xs opacity-80">
            {support.mode === "interactive"
              ? "Interactive support mode is active. Actions will be recorded as performed by a TaaSFlow administrator."
              : "You are viewing this workspace as a TaaSFlow administrator. Client actions are disabled."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="inline-flex items-center gap-1 rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70"
          >
            <ArrowLeft className="h-3 w-3" />
            Return to Admin
          </button>
          {support.organizationId && (
            <Link
              to="/admin/clients/$id"
              params={{ id: support.organizationId }}
              className="inline-flex items-center gap-1 rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70"
            >
              <Building2 className="h-3 w-3" />
              Open Client Record
            </Link>
          )}
          <Link
            to="/admin/clients"
            className="inline-flex items-center gap-1 rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70"
          >
            <Users className="h-3 w-3" />
            Change Client
          </Link>
        </div>
      </div>
    </div>
  );
}
