import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Building2, Users, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { useSupportView } from "@/lib/support-view";
import { endSupportSession } from "@/lib/support.functions";

/** Minutes:seconds left on a support session, recomputed every second. */
function useTimeRemaining(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "expired";
  const total = Math.round(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")} left`;
}

/**
 * Persistent banner rendered by the client layout whenever a platform staff
 * member is viewing a client workspace via ?org=<uuid>. Explains context and
 * offers the escape hatches required by the spec (§4).
 */
export function SupportViewBanner() {
  const support = useSupportView();
  const navigate = useNavigate();
  const remaining = useTimeRemaining(support.sessionExpiresAt);
  const qc = useQueryClient();
  const end = useServerFn(endSupportSession);
  // Staff should be able to hand access back from the workspace they are in,
  // not only from Admin.
  const endSession = useMutation({
    mutationFn: (sessionId: string) => end({ data: { session_id: sessionId } }),
    onSuccess: () => {
      toast.success("Support session ended");
      void qc.invalidateQueries({ queryKey: ["active-support-session"] });
      void qc.invalidateQueries({ queryKey: ["my-support-sessions"] });
      navigate({ to: "/admin" });
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "Could not end the session" }),
  });
  if (!support.active) return null;
  const color =
    support.mode === "interactive"
      ? "bg-warning/15 border-warning/50 text-warning-foreground dark:text-warning-foreground"
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
            {support.sessionRef ? (
              <span>
                Support session <span className="font-mono">{support.sessionRef}</span>
              </span>
            ) : null}
            {remaining ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {remaining === "expired" ? "Session expired — reopen from Admin" : remaining}
              </span>
            ) : null}
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
          {support.sessionId ? (
            <button
              onClick={() => endSession.mutate(support.sessionId!)}
              disabled={endSession.isPending}
              className="inline-flex items-center gap-1 rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70 disabled:opacity-60"
            >
              {endSession.isPending ? "Ending…" : "End session"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
