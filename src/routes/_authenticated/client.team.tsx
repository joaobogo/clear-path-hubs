import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getClientContext,
  getClientTeam,
  inviteClientMember,
  resendClientInvitation,
  updateClientMemberRole,
  setClientMemberStatus,
  removeClientMember,
} from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Info,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

type ClientRoleId = "client_admin" | "client_editor" | "client_viewer";
type MemberStatus = "active" | "invited" | "suspended" | "removed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const ROLE_LABEL: Record<ClientRoleId, string> = {
  client_admin: "Workspace admin",
  client_editor: "Editor",
  client_viewer: "Viewer",
};

const ROLE_DESCRIPTION: Record<ClientRoleId, string> = {
  client_admin: "Full access — can manage team, positions, and candidates.",
  client_editor: "Can act on positions, candidates, and interviews.",
  client_viewer: "Read-only across the workspace.",
};

const STATUS_META: Record<
  MemberStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }
> = {
  active: { label: "Active", variant: "default", className: "" },
  invited: {
    label: "Invitation sent",
    variant: "outline",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  },
  suspended: {
    label: "Suspended",
    variant: "outline",
    className: "border-slate-500/40 text-muted-foreground",
  },
  removed: {
    label: "Removed",
    variant: "outline",
    className: "border-slate-500/40 text-muted-foreground line-through",
  },
};

export const Route = createFileRoute("/_authenticated/client/team")({
  head: () => ({
    meta: [
      { title: "Team · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load: {error.message}</div>
  ),
  component: TeamPage,
});

function TeamPage() {
  const ctxFn = useServerFn(getClientContext);
  const teamFn = useServerFn(getClientTeam);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const readOnly = support.readOnly;

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const orgName = ctx?.active?.name;
  const isAdmin =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";
  const canMutate = isAdmin && !readOnly;

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["client-team", orgId],
    queryFn: () => teamFn({ data: { orgId: orgId! } }),
    enabled: !!orgId && !!isAdmin,
    placeholderData: (prev) => prev,
  });

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Team management is admin-only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask a workspace admin for access to invite or manage teammates.
          </p>
        </div>
      </main>
    );
  }

  const visible = (rows as AnyRow[]).filter((r) => r.status !== "removed");
  const counts = useMemo(() => {
    const c = { total: 0, admin: 0, editor: 0, viewer: 0, invited: 0 };
    for (const r of visible) {
      c.total += 1;
      if (r.role === "client_admin") c.admin += 1;
      if (r.role === "client_editor") c.editor += 1;
      if (r.role === "client_viewer") c.viewer += 1;
      if (r.status === "invited") c.invited += 1;
    }
    return c;
  }, [visible]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Team
          </div>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {orgName ?? "Your workspace"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.total} member{counts.total === 1 ? "" : "s"}
            {counts.invited > 0 && ` · ${counts.invited} pending`}
          </p>
        </div>
        {canMutate && orgId && <InviteDialog orgId={orgId} />}
      </header>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-sm">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>You are viewing as an administrator — team changes are disabled.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Failed to load team: {(error as Error).message}
        </div>
      )}

      {/* Members */}
      <section className="rounded-xl border bg-card">
        {isLoading && visible.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="mt-3 text-base font-semibold">Just you so far</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Invite teammates so they can collaborate on positions and candidate decisions.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((m: AnyRow) => (
              <MemberRow
                key={m.user_id}
                orgId={orgId!}
                member={m}
                canMutate={!!canMutate}
                selfId={ctx?.userId}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Role legend */}
      <section className="rounded-xl border bg-card/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Roles
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(ROLE_LABEL) as ClientRoleId[]).map((r) => (
            <div key={r} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-sm font-medium">
                <RoleIcon role={r} />
                {ROLE_LABEL[r]}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function RoleIcon({ role }: { role: ClientRoleId }) {
  if (role === "client_admin") return <ShieldCheck className="h-3.5 w-3.5 text-primary" />;
  if (role === "client_editor") return <UserCog className="h-3.5 w-3.5 text-sky-600" />;
  return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name && name.trim()) || (email && email.split("@")[0]) || "?";
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function MemberRow({
  orgId,
  member,
  canMutate,
  selfId,
}: {
  orgId: string;
  member: AnyRow;
  canMutate: boolean;
  selfId?: string | null;
}) {
  const qc = useQueryClient();
  const roleFn = useServerFn(updateClientMemberRole);
  const statusFn = useServerFn(setClientMemberStatus);
  const removeFn = useServerFn(removeClientMember);
  const resendFn = useServerFn(resendClientInvitation);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-team", orgId] });
  const handleErr = (e: unknown) =>
    toast.error((e instanceof Error ? e.message : String(e)).replace(/^Error: /, ""));

  const changeRole = useMutation({
    mutationFn: (role: ClientRoleId) =>
      roleFn({ data: { orgId, userId: member.user_id, role } }),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: handleErr,
  });
  const changeStatus = useMutation({
    mutationFn: (status: "active" | "suspended") =>
      statusFn({ data: { orgId, userId: member.user_id, status } }),
    onSuccess: (_, s) => {
      toast.success(s === "active" ? "Member reactivated" : "Member suspended");
      invalidate();
    },
    onError: handleErr,
  });
  const remove = useMutation({
    mutationFn: () => removeFn({ data: { orgId, userId: member.user_id } }),
    onSuccess: () => {
      toast.success("Member removed");
      setConfirmRemove(false);
      invalidate();
    },
    onError: handleErr,
  });
  const resend = useMutation({
    mutationFn: () => resendFn({ data: { orgId, userId: member.user_id } }),
    onSuccess: () => toast.success("Invitation resent"),
    onError: handleErr,
  });

  const name: string = member.profiles?.full_name || member.profiles?.email || "Team member";
  const email: string | null = member.profiles?.email ?? null;
  const status = (member.status as MemberStatus) ?? "active";
  const role = member.role as ClientRoleId;
  const statusMeta = STATUS_META[status];
  const isSelf = selfId && selfId === member.user_id;
  const busy =
    changeRole.isPending || changeStatus.isPending || remove.isPending || resend.isPending;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initials(member.profiles?.full_name, email)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {isSelf && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              You
            </span>
          )}
        </div>
        {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
          <RoleIcon role={role} />
          <span>{ROLE_LABEL[role] ?? role}</span>
          <span>·</span>
          <Badge variant={statusMeta.variant} className={`${statusMeta.className} h-4 px-1.5 py-0 text-[10px]`}>
            {statusMeta.label}
          </Badge>
        </div>
      </div>

      {/* Desktop: role + status columns */}
      <div className="hidden items-center gap-2 sm:flex">
        {canMutate && !isSelf && status !== "invited" ? (
          <Select
            value={role}
            onValueChange={(v) => changeRole.mutate(v as ClientRoleId)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as ClientRoleId[]).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <RoleIcon role={r} />
                    {ROLE_LABEL[r]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RoleIcon role={role} />
            {ROLE_LABEL[role] ?? role}
          </span>
        )}
        <Badge variant={statusMeta.variant} className={statusMeta.className}>
          {statusMeta.label}
        </Badge>
      </div>

      {/* Row menu (uncommon actions) */}
      <div className="shrink-0">
        {canMutate && !isSelf ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Member actions" className="min-h-11 min-w-11" disabled={busy}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Member actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {status === "invited" && (
                <DropdownMenuItem onSelect={() => resend.mutate()}>
                  <Mail className="mr-2 h-4 w-4" /> Resend invitation
                </DropdownMenuItem>
              )}
              {status === "active" && (
                <DropdownMenuItem onSelect={() => changeStatus.mutate("suspended")}>
                  <Shield className="mr-2 h-4 w-4" /> Suspend access
                </DropdownMenuItem>
              )}
              {status === "suspended" && (
                <DropdownMenuItem onSelect={() => changeStatus.mutate("active")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmRemove(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <UserMinus className="mr-2 h-4 w-4" /> Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="block h-11 w-11" aria-hidden />
        )}
        <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {name}?</DialogTitle>
              <DialogDescription>
                They will lose access to this workspace immediately. Their account is not
                deleted and they can be re-invited later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? "Removing…" : "Remove member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  );
}

function InviteDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClientRoleId>("client_editor");
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteClientMember);
  const invite = useMutation({
    mutationFn: () => inviteFn({ data: { orgId, email, role } }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setEmail("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["client-team", orgId] });
    },
    onError: (e: Error) =>
      toast.error(e.message.replace(/^Error: /, "") || "Failed to invite"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="min-h-11">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite team member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            We'll email them a secure link to join this workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            invite.mutate();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Work email
            </label>
            <Input
              id="invite-email"
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="invite-role">
              Role
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as ClientRoleId)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as ClientRoleId[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex flex-col">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <RoleIcon role={r} />
                        {ROLE_LABEL[r]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTION[r]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email.trim() || invite.isPending}>
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
