import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  listClients,
} from "@/lib/admin.functions";
import {
  createUserByAdmin,
  listOrganizationTeam,
  deactivateMember,
  reactivateMember,
  removeMember,
  resetMemberPassword,
} from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirmAction } from "@/components/ds";
import { WorkloadTable } from "@/components/admin/workload-table";
import { OwnershipCoveragePanel } from "@/components/admin/ownership-coverage-panel";

const searchSchema = z.object({ org: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/team")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Team — Admin · TaaSFlow" }, { name: "robots", content: "noindex" }],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { org } = Route.useSearch();
  const navigate = Route.useNavigate();
  const clients = useQuery({
    queryKey: ["admin-clients", ""],
    queryFn: () => listClients({ data: { q: "" } }),
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Team management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create platform, operations, and client users. Manage memberships per
          organization.
        </p>
      </header>

      <WorkloadTable />

      <OwnershipCoveragePanel />

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <Card className="p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Scope</p>
          <button
            className={`w-full rounded px-2 py-1.5 text-left text-sm ${!org ? "bg-muted font-medium" : "hover:bg-muted"}`}
            onClick={() => navigate({ search: {} })}
          >
            Platform staff
          </button>
          <div className="my-2 h-px bg-border" />
          <p className="mb-1 text-xs font-medium text-muted-foreground">Client organizations</p>
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(clients.data?.items ?? []).map((c: any) => (
              <button
                key={c.id}
                className={`w-full truncate rounded px-2 py-1.5 text-left text-sm ${org === c.id ? "bg-muted font-medium" : "hover:bg-muted"}`}
                onClick={() => navigate({ search: { org: c.id } })}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <CreateUserPanel organizationId={org ?? null} />
          {org ? (
            <OrgTeamList organizationId={org} />
          ) : (
            <PlatformStaffList />
          )}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
function CreateUserPanel({ organizationId }: { organizationId: string | null }) {
  const run = useServerFn(createUserByAdmin);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<
    "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer"
  >(organizationId ? "client_admin" : "platform_admin");
  const [tempPw, setTempPw] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  const mut = useMutation({
    mutationFn: (input: {
      email: string;
      full_name: string;
      role: typeof role;
      organization_id: string | null;
      temporary_password: string | null;
    }) => run({ data: input }),
    onSuccess: (r) => {
      setResult({ email: r.email, password: r.temporary_password });
      setEmail("");
      setFullName("");
      setTempPw("");
      toast.success("User created — copy the password now.");
      qc.invalidateQueries({ queryKey: ["org-team"] });
      qc.invalidateQueries({ queryKey: ["platform-staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Create user</h2>
      <p className="text-xs text-muted-foreground">
        Creates a real account. Skips email verification. The temporary password
        is shown once — copy it before leaving this screen.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate({
            email,
            full_name: fullName,
            role,
            organization_id: organizationId,
            temporary_password: tempPw || null,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <select
            className="w-full rounded border bg-background px-2 py-1.5 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            {!organizationId && (
              <>
                <option value="platform_admin">Platform admin</option>
                <option value="operations">Operations</option>
              </>
            )}
            {organizationId && (
              <>
                <option value="client_admin">Client admin</option>
                <option value="client_editor">Client editor</option>
                <option value="client_viewer">Client viewer</option>
              </>
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Temporary password (optional)</Label>
          <Input
            type="text"
            placeholder="Auto-generate if empty"
            value={tempPw}
            onChange={(e) => setTempPw(e.target.value)}
          />
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>

      {result && (
        <Card className="mt-4 border-success/40 bg-success/5 p-4">
          <p className="text-sm font-medium">Account ready</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The password below will not be shown again. Copy it now and share
            it with the new user through a secure channel.
          </p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono">{result.email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd className="font-mono">{result.password}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Login URL</dt>
              <dd className="font-mono text-xs">
                {typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Email: ${result.email}\nPassword: ${result.password}\nLogin: ${window.location.origin}/login`,
                )
              }
            >
              Copy all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
function OrgTeamList({ organizationId }: { organizationId: string }) {
  const runList = useServerFn(listOrganizationTeam);
  const runDeact = useServerFn(deactivateMember);
  const runReact = useServerFn(reactivateMember);
  const runRemove = useServerFn(removeMember);
  const runReset = useServerFn(resetMemberPassword);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["org-team", organizationId],
    queryFn: () => runList({ data: { organization_id: organizationId } }),
  });

  const mut = <T,>(fn: (input: T) => Promise<unknown>, msg: string) =>
    useMutation({
      mutationFn: (i: T) => fn(i),
      onSuccess: () => {
        toast.success(msg);
        qc.invalidateQueries({ queryKey: ["org-team", organizationId] });
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const deact = mut((i: { membership_id: string }) => runDeact({ data: i }), "Deactivated");
  const react = mut((i: { membership_id: string }) => runReact({ data: i }), "Reactivated");
  const rem = mut((i: { membership_id: string }) => runRemove({ data: i }), "Removed");

  const { confirm, confirmDialog } = useConfirmAction();
  const [resetShown, setResetShown] = useState<{ email: string; password: string } | null>(null);
  const reset = useMutation({
    mutationFn: (i: { auth_user_id: string; email: string }) =>
      runReset({ data: { auth_user_id: i.auth_user_id } }).then((r) => ({ ...r, email: i.email })),
    onSuccess: (r) => setResetShown({ email: r.email, password: r.temporary_password }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Team members</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((m) => (
              <tr key={m.membership_id} className="border-t">
                <td className="py-2">{m.full_name ?? "—"}</td>
                <td className="text-muted-foreground">{m.email}</td>
                <td>
                  <Badge variant="outline">{m.role}</Badge>
                </td>
                <td>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>
                    {m.status}
                  </Badge>
                </td>
                <td className="text-right space-x-1">
                  {m.auth_user_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reset.mutate({ auth_user_id: m.auth_user_id!, email: m.email ?? "" })
                      }
                    >
                      Reset password
                    </Button>
                  )}
                  {m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deact.mutate({ membership_id: m.membership_id })}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => react.mutate({ membership_id: m.membership_id })}
                    >
                      Reactivate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={rem.isPending}
                    onClick={async () => {
                      const r = await confirm({
                        title: "Remove member",
                        object: `${m.full_name ?? m.email} · ${m.role}`,
                        description:
                          "This person loses access to this client workspace immediately.",
                        impact: [
                          "Their seat is freed for another teammate",
                          "Shortlists, decisions and comments they made are kept",
                          "You can invite them again at any time",
                        ],
                        confirmLabel: "Remove member",
                        tone: "destructive",
                      });
                      if (r.confirmed) rem.mutate({ membership_id: m.membership_id });
                    }}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDialog}
      {resetShown && (
        <Card className="mt-4 border-warning/40 bg-warning/5 p-4">
          <p className="text-sm font-medium">New temporary password</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown once. Share it securely.
          </p>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono">{resetShown.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Password</dt>
              <dd className="font-mono">{resetShown.password}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Email: ${resetShown.email}\nPassword: ${resetShown.password}`,
                )
              }
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResetShown(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
    </Card>
  );
}

function PlatformStaffList() {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium">Platform staff</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use the create form above to add platform_admin or operations users.
        Existing platform staff can be managed from the database or by resetting
        their password from their client-organization team if they hold one.
      </p>
    </Card>
  );
}
