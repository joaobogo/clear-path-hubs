/**
 * Repeat pilot attempts, for staff.
 *
 * The pilot is a one-time introduction per company. When the same company comes
 * back — often under a new account or a different email — the platform refuses
 * the second pilot and records the attempt. This panel shows those records and
 * lets staff grant the narrow exception that genuinely separate hiring entities
 * deserve: a different location, a franchise, or a subsidiary.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { listPilotWarnings, grantPilotException } from "@/lib/pilot-eligibility.functions";
import { PILOT_EXCEPTION_KINDS, exceptionKindLabel } from "@/lib/pilot-eligibility";

type Props = {
  /** Limit to one workspace, e.g. on an intake or organisation page. */
  organizationId?: string | null;
  /** Hide the whole card when there is nothing to show (detail pages). */
  hideWhenEmpty?: boolean;
  limit?: number;
};

export function PilotWarningsPanel({ organizationId = null, hideWhenEmpty, limit }: Props) {
  const list = useServerFn(listPilotWarnings);
  const grant = useServerFn(grantPilotException);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("multi_location");
  const [reason, setReason] = useState("");

  const key = ["admin", "pilot-warnings", organizationId ?? "all", limit ?? 25];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      list({ data: { organization_id: organizationId, limit: limit ?? 25 } }),
  });

  const grantM = useMutation({
    mutationFn: (claimId: string) =>
      grant({ data: { claim_id: claimId, kind: kind as never, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pilot-warnings"] });
      setOpenId(null);
      setReason("");
      toast.success("Pilot exception granted.");
    },
    onError: (e) => toastError(e, { fallback: "Could not grant the exception." }),
  });

  const rows = q.data ?? [];

  // hideWhenEmpty only hides the loading/empty chrome; a failed read must
  // still be visible so a broken read is never mistaken for "nothing to show".
  if (hideWhenEmpty && !q.isError && (q.isPending || rows.length === 0)) return null;

  return (
    <PanelState
      query={q}
      isEmpty={rows.length === 0}
      empty={
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-primary" /> No repeat pilot attempts
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Every pilot on record is a company's first.
          </p>
        </section>
      }
    >
    <section className="rounded-lg border border-warning/60 bg-warning/10 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" /> Repeat pilot attempt
        <Badge variant="outline">{rows.length}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The pilot runs once per company. These companies came back for a second one — the role was
        created on a paid footing instead. Grant an exception only for a genuinely separate hiring
        entity.
      </p>

      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border bg-card p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{r.company_name}</span>
              {r.exception_granted && (
                <Badge variant="secondary">
                  Exception · {exceptionKindLabel(r.exception_kind)}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{r.blocked_line}</p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Company domain</dt>
                <dd>{r.company_domain ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email domain</dt>
                <dd>{r.email_domain ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">First pilot</dt>
                <dd>
                  {r.first_claim
                    ? `${r.first_claim.organization_name ?? r.first_claim.company_name} · ${new Date(
                        r.first_claim.created_at,
                      ).toLocaleDateString()}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">This workspace</dt>
                <dd>{r.organization_name ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {r.position_id && (
                <Link
                  to="/admin/positions/$id"
                  params={{ id: r.position_id }}
                  className="font-medium text-primary hover:underline"
                >
                  Open role
                </Link>
              )}
              {r.intake_submission_id && (
                <Link
                  to="/admin/intake/$id"
                  params={{ id: r.intake_submission_id }}
                  className="font-medium text-primary hover:underline"
                >
                  Open intake
                </Link>
              )}
              {!r.exception_granted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  {openId === r.id ? "Cancel" : "Grant exception"}
                </Button>
              )}
            </div>

            {r.exception_granted && r.exception_reason && (
              <p className="mt-2 text-muted-foreground">Reason: {r.exception_reason}</p>
            )}

            {openId === r.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex flex-wrap gap-2">
                  {PILOT_EXCEPTION_KINDS.map((k) => (
                    <Button
                      key={k.value}
                      size="sm"
                      variant={kind === k.value ? "default" : "outline"}
                      onClick={() => setKind(k.value)}
                    >
                      {k.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why this is a separate hiring entity (at least 10 characters)"
                />
                <Button
                  size="sm"
                  disabled={reason.trim().length < 10 || grantM.isPending}
                  onClick={() => grantM.mutate(r.id)}
                >
                  {grantM.isPending ? "Granting…" : "Grant pilot exception"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
    </PanelState>
  );
}
