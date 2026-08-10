import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { inspectClientAccess, type AccessMember } from "@/lib/client-access.functions";
import { inviteClientMember, resendClientInvitation, updateClientMemberRole } from "@/lib/client-team.functions";
import { setSeatStatus } from "@/lib/authz.functions";
import {
  CLIENT_PERMISSIONS,
  CLIENT_PERMISSION_LABELS,
  CLIENT_ROLES,
  type ClientPermission,
} from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Minus, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";

const ROLE_LABEL: Record<string, string> = {
  client_admin: "Owner",
  client_editor: "Editor",
  client_viewer: "Viewer",
};

/**
 * Answers "what can this client user actually see?" by displaying the values
 * returned by the same database functions the RLS policies call.
 */
export function ClientAccessPanel({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const inspect = useServerFn(inspectClientAccess);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("client_editor");

  const q = useQuery({
    queryKey: ["client-access", organizationId],
    queryFn: () => inspect({ data: { organization_id: organizationId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-access", organizationId] });

  const invite = useMutation({
    mutationFn: () =>
      inviteClientMember({
        data: {
          orgId: organizationId,
          email: email.trim().toLowerCase(),
          role: inviteRole as "client_admin" | "client_editor" | "client_viewer",
        },
      }),
    onSuccess: async () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setEmail("");
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      updateClientMemberRole({
        data: {
          orgId: organizationId,
          userId: v.userId,
          role: v.role as "client_admin" | "client_editor" | "client_viewer",
        },
      }),
    onSuccess: async () => {
      toast.success("Role updated");
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const revoke = useMutation({
    mutationFn: (v: { membershipId: string; reason: string }) =>
      setSeatStatus({
        data: { membership_id: v.membershipId, status: "removed", reason: v.reason },
      }),
    onSuccess: async (_r, v) => {
      toast.success(v.reason === "seat_released" ? "Seat released" : "Access revoked");
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const resend = useMutation({
    mutationFn: (userId: string) =>
      resendClientInvitation({ data: { orgId: organizationId, userId } }),
    onSuccess: () => toast.success("Invitation resent"),
    onError: (e: Error) => toastError(e),
  });

  const d = q.data;
  const noMembers = !!d && d.members.length === 0 && d.pending.length === 0;

  return (
    <>
      <PanelState
        query={q}
        isEmpty={noMembers}
        skeletonRows={5}
        empty={
          <PanelEmpty
            title="No client members yet"
            description="Nobody from this account has access. Invite the first member to get them started."
          >
            <div className="mt-3">
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                Invite the first member
              </Button>
            </div>
          </PanelEmpty>
        }
      >
        {d ? (
          <ClientAccessBody
            data={d}
            setInviteOpen={setInviteOpen}
            changeRole={changeRole}
            revoke={revoke}
            resend={resend}
          />
        ) : null}
      </PanelState>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a client member</DialogTitle>
            <DialogDescription>
              They receive the permissions of the chosen role. The seat limit is enforced on the
              server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              aria-label="Email address"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!/.+@.+\..+/.test(email) || invite.isPending}
              onClick={() => invite.mutate()}
              data-qa-action="access-invite-confirm"
            >
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ClientAccessBody({
  data: d,
  setInviteOpen,
  changeRole,
  revoke,
  resend,
}: {
  data: NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof inspectClientAccess>>>>["data"]>;
  setInviteOpen: (v: boolean) => void;
  changeRole: ReturnType<typeof useMutation<unknown, Error, { userId: string; role: string }>>;
  revoke: ReturnType<typeof useMutation<unknown, Error, { membershipId: string; reason: string }>>;
  resend: ReturnType<typeof useMutation<unknown, Error, string>>;
}) {
  const totalSeats = d.seat_limit + 1;
  const atCap = d.seats_remaining === 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Seat usage</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {d.seats_used}
            <span className="text-base font-normal text-muted-foreground"> / {totalSeats}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner seat plus {d.seat_limit} recruiter seat{d.seat_limit === 1 ? "" : "s"} on the
            current plan. Pending invitations hold a seat.
          </p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          disabled={atCap}
          title={atCap ? "Seat limit reached — release a seat first" : undefined}
          data-qa-action="access-invite"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite member
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Resolved permissions
          <span className="font-normal text-muted-foreground">
            · read live from the database functions the policies use
          </span>
        </div>

        {/* The empty case is owned by PanelState above, so a failed read can
            never look like an account with no members. */}


          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Role</th>
                  {CLIENT_PERMISSIONS.map((p) => (
                    <th key={p} className="px-2 py-2 text-center">
                      {CLIENT_PERMISSION_LABELS[p]}
                    </th>
                  ))}
                  <th className="px-4 py-2">Last sign-in</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...d.members, ...d.pending].map((m) => (
                  <MemberRow
                    key={m.membership_id}
                    m={m}
                    busy={changeRole.isPending || revoke.isPending}
                    onRole={(role) => changeRole.mutate({ userId: m.user_id, role })}
                    onResend={() => resend.mutate(m.user_id)}
                    onRevoke={() =>
                      revoke.mutate({
                        membershipId: m.membership_id,
                        reason: m.status === "invited" ? "seat_released" : "access_revoked",
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Permissions follow the role. There is no per-permission editing on this tab, and access is
        never assumed on behalf of a client user.
      </p>
    </section>
  );
}

function MemberRow({
  m,
  busy,
  onRole,
  onResend,
  onRevoke,
}: {
  m: AccessMember;
  busy: boolean;
  onRole: (role: string) => void;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const pending = m.status === "invited";
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{m.full_name ?? m.email ?? "Unnamed member"}</div>
        <div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
        <div className="mt-1 flex gap-1">
          {pending && <Badge variant="outline">pending invite</Badge>}
          {m.status === "suspended" && <Badge variant="secondary">suspended</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Select value={m.role} onValueChange={onRole} disabled={busy}>
          <SelectTrigger className="h-8 w-28" aria-label={`Role for ${m.email ?? m.user_id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {CLIENT_PERMISSIONS.map((p) => (
        <PermissionCell key={p} m={m} perm={p} />
      ))}
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString() : "Never signed in"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1.5">
          {pending && (
            <Button size="sm" variant="outline" onClick={onResend} disabled={busy}>
              Resend
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRevoke} disabled={busy}>
            {pending ? "Release seat" : "Revoke access"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function PermissionCell({ m, perm }: { m: AccessMember; perm: ClientPermission }) {
  const allowed = m.effective[perm];
  const isDefault = m.role_defaults.includes(perm);
  const title = allowed
    ? isDefault
      ? `Granted by the ${ROLE_LABEL[m.role] ?? m.role} role`
      : "Granted on this seat, beyond the role default"
    : isDefault
      ? "Role default, but not currently granted on this seat"
      : "Not part of this role";
  return (
    <td className="px-2 py-3 text-center" title={title}>
      {allowed ? (
        <Check
          className={`mx-auto h-4 w-4 ${isDefault ? "text-success" : "text-warning"}`}
          aria-label="allowed"
        />
      ) : (
        <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="not allowed" />
      )}
    </td>
  );
}
