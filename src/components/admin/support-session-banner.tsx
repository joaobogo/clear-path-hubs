/**
 * Persistent reminder that the current staff user still holds support access to
 * a customer workspace, rendered outside the client dashboard so the access
 * can't be forgotten after navigating away. Ending the session is one click.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Clock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { endSupportSession, listMySupportSessions } from "@/lib/support.functions";

/** Minutes:seconds left, recomputed every second. */
function useRemaining(expiresAt: string | null) {
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
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} left`;
}

function SessionRow({
  session,
  onEnded,
}: {
  session: {
    id: string;
    organization_id: string | null;
    organization_name: string;
    mode: string;
    session_ref: string;
    expires_at: string | null;
  };
  onEnded: () => void;
}) {
  const remaining = useRemaining(session.expires_at);
  const end = useServerFn(endSupportSession);
  const mutation = useMutation({
    mutationFn: () => end({ data: { session_id: session.id } }),
    onSuccess: () => {
      toast.success(`Support session ${session.session_ref} ended`);
      onEnded();
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "Could not end the session" }),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          Support session <span className="font-mono">{session.session_ref}</span> is active on{" "}
          <span className="font-semibold">{session.organization_name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
          <span>
            {session.mode === "interactive" ? "Interactive mode" : "Read-only"} — every action is
            recorded
          </span>
          {remaining ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {remaining === "expired" ? "Expired — end it to clear access" : remaining}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {session.organization_id ? (
          <Link
            to="/admin/clients/$id"
            params={{ id: session.organization_id }}
            className="inline-flex items-center gap-1 rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70"
          >
            <Building2 className="h-3 w-3" />
            Client record
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded border border-current/40 bg-background/40 px-2 py-1 text-xs hover:bg-background/70 disabled:opacity-60"
        >
          {mutation.isPending ? "Ending…" : "End session"}
        </button>
      </div>
    </div>
  );
}

export function SupportSessionBanner() {
  const list = useServerFn(listMySupportSessions);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-support-sessions"],
    queryFn: () => list({}),
    refetchInterval: 60_000,
    retry: false,
  });

  const sessions = q.data ?? [];
  if (sessions.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-2 border-b border-warning/50 bg-warning/15 px-4 py-2 text-sm"
    >
      {sessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          onEnded={() => {
            void qc.invalidateQueries({ queryKey: ["my-support-sessions"] });
            void qc.invalidateQueries({ queryKey: ["active-support-session"] });
          }}
        />
      ))}
    </div>
  );
}
