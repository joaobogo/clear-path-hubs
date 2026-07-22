import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  getClient,
  updateOrganization,
  getClientActivity,
  getClientCandidatesForOrg,
} from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const TABS = [
  "overview",
  "company",
  "team",
  "positions",
  "candidates",
  "activity",
  "settings",
] as const;
type TabKey = (typeof TABS)[number];

const searchSchema = z.object({
  tab: z.enum(TABS).optional().default("overview"),
});

export const Route = createFileRoute("/_authenticated/admin/clients/$id")({
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-client", params.id],
      queryFn: () => getClient({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => <div className="p-8">Organization not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{error.message}</div>
  ),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client", id],
    queryFn: () => getClient({ data: { id } }),
  });
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = data.organization as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = data.members as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positions = data.positions as any[];

  const setTab = (t: TabKey) => navigate({ search: { tab: t } });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6" data-qa-action={`admin-client-${id}`}>
      <div>
        <Link
          to="/admin/clients"
          className="text-sm text-muted-foreground hover:underline"
          data-qa-action="back-to-clients"
        >
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <Badge variant="outline">{org.status}</Badge>
          <Link
            to="/client"
            search={{ org: org.id, preview: "client_admin" }}
            className="ml-auto inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-muted"
            title="Open this tenant's dashboard as an administrator (read-only)"
            data-qa-action="view-client-dashboard"
          >
            View Client Dashboard →
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {org.domain ?? "—"} · {org.industry ?? "—"} · {org.headquarters ?? "—"}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            data-qa-action={`tab-${t}`}
            className={`px-3 py-2 text-sm capitalize border-b-2 ${
              tab === t
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab org={org} members={members} positions={positions} />}
      {tab === "company" && <CompanyTab org={org} />}
      {tab === "team" && <TeamTab members={members} />}
      {tab === "positions" && <PositionsTab positions={positions} />}
      {tab === "candidates" && <CandidatesTab id={id} />}
      {tab === "activity" && <ActivityTab id={id} />}
      {tab === "settings" && <SettingsTab org={org} />}
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OverviewTab({ org, members, positions }: { org: any; members: any[]; positions: any[] }) {
  const active = positions.filter((p) => p.status === "active").length;
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard label="Positions" value={positions.length} />
      <StatCard label="Active positions" value={active} />
      <StatCard label="Client users" value={members.length} />
      <div className="md:col-span-3 rounded-lg border p-4 text-sm">
        <div className="font-medium mb-2">Organization at a glance</div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
          <dt>Name</dt><dd className="text-foreground">{org.name}</dd>
          <dt>Status</dt><dd className="text-foreground capitalize">{org.status}</dd>
          <dt>Website</dt><dd className="text-foreground">{org.website ?? "—"}</dd>
          <dt>Domain</dt><dd className="text-foreground">{org.domain ?? "—"}</dd>
          <dt>Industry</dt><dd className="text-foreground">{org.industry ?? "—"}</dd>
          <dt>Headquarters</dt><dd className="text-foreground">{org.headquarters ?? "—"}</dd>
          <dt>Created</dt><dd className="text-foreground">{new Date(org.created_at).toLocaleString()}</dd>
          <dt>Updated</dt><dd className="text-foreground">{new Date(org.updated_at).toLocaleString()}</dd>
        </dl>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompanyTab({ org }: { org: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: org.name ?? "",
    website: org.website ?? "",
    domain: org.domain ?? "",
    industry: org.industry ?? "",
    headquarters: org.headquarters ?? "",
    status: org.status as string,
  });
  useEffect(() => {
    setForm({
      name: org.name ?? "",
      website: org.website ?? "",
      domain: org.domain ?? "",
      industry: org.industry ?? "",
      headquarters: org.headquarters ?? "",
      status: org.status,
    });
  }, [org.id, org.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    form.name !== (org.name ?? "") ||
    form.website !== (org.website ?? "") ||
    form.domain !== (org.domain ?? "") ||
    form.industry !== (org.industry ?? "") ||
    form.headquarters !== (org.headquarters ?? "") ||
    form.status !== org.status;

  const m = useMutation({
    mutationFn: () =>
      updateOrganization({
        data: {
          id: org.id,
          patch: {
            name: form.name.trim(),
            website: form.website.trim() || null,
            domain: form.domain.trim() || null,
            industry: form.industry.trim() || null,
            headquarters: form.headquarters.trim() || null,
            status: form.status as "prospect" | "active" | "paused" | "closed",
          },
        },
      }),
    onSuccess: async () => {
      toast.success("Company profile saved");
      await qc.invalidateQueries({ queryKey: ["admin-client", org.id] });
      await qc.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="grid gap-4 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) m.mutate();
      }}
    >
      <Field label="Company name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Website">
        <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
      </Field>
      <Field label="Email domain">
        <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
      </Field>
      <Field label="Industry">
        <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
      </Field>
      <Field label="Headquarters">
        <Input value={form.headquarters} onChange={(e) => setForm({ ...form, headquarters: e.target.value })} />
      </Field>
      <Field label="Organization status">
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger className="max-w-xs" data-qa-action="org-status-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["prospect", "active", "paused", "closed"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div>
        <Button type="submit" disabled={!dirty || m.isPending} data-qa-action="save-company">
          {m.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TeamTab({ members }: { members: any[] }) {
  return (
    <section className="space-y-3">
      <div className="rounded-md border p-3 text-xs text-muted-foreground bg-muted/40">
        User invite / role edit / password reset / deactivate are managed via the master
        admin team console; wire-through actions land in a follow-up. Read view below is
        canonical.
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2">{m.profiles?.full_name ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.profiles?.email ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{m.role}</td>
                <td className="px-3 py-2 capitalize">{m.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PositionsTab({ positions }: { positions: any[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Visibility</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link to="/admin/positions/$id" params={{ id: p.id }} className="text-primary hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="px-3 py-2"><Badge>{p.status}</Badge></td>
              <td className="px-3 py-2 capitalize">{p.visibility}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.location ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(p.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {positions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No positions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CandidatesTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client-candidates", id],
    queryFn: () => getClientCandidatesForOrg({ data: { id } }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium">Position</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Parse</th>
            <th className="px-3 py-2 font-medium">Score</th>
            <th className="px-3 py-2 font-medium">Fit</th>
            <th className="px-3 py-2 font-medium">Admin</th>
            <th className="px-3 py-2 font-medium">Client visible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link to="/admin/candidates/$id" params={{ id: r.id }} className="text-primary hover:underline">
                  {r.candidate_profiles?.full_name ?? "—"}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.positions?.title ?? "—"}</td>
              <td className="px-3 py-2 capitalize">{r.current_stage ?? "—"}</td>
              <td className="px-3 py-2 capitalize text-xs">{r.processing_state ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{r.fit_score_final ?? "—"}</td>
              <td className="px-3 py-2 capitalize">{r.fit_band ?? "—"}</td>
              <td className="px-3 py-2 capitalize text-xs">{r.admin_status ?? "—"}</td>
              <td className="px-3 py-2 capitalize text-xs">{r.client_visibility ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                No candidates yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client-activity", id],
    queryFn: () => getClientActivity({ data: { id, limit: 100 } }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Entity</th>
            <th className="px-3 py-2 font-medium">Trace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-2 text-xs">{r.entity_type}:{String(r.entity_id).slice(0, 8)}</td>
              <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.trace_id ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                No activity recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SettingsTab({ org }: { org: any }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border p-4 text-sm">
        <div className="font-medium">Identifiers</div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground font-mono text-xs">
          <dt>Organization ID</dt><dd className="text-foreground break-all">{org.id}</dd>
        </dl>
      </div>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="font-medium text-destructive">Archive organization</div>
        <p className="mt-1 text-muted-foreground">
          Archiving is a destructive multi-tenant operation. It requires: platform-admin
          verification, dry-run affected-record counts, typed company-name confirmation,
          retention-policy check, and an audit event. This flow is not wired in this
          screen — it will land as a dedicated modal to keep the safety gates first-class.
          Do not use the browser back button to attempt deletion.
        </p>
        <Button variant="outline" disabled className="mt-2" data-qa-action="archive-org-placeholder">
          Archive… (not available in this workspace)
        </Button>
      </div>
    </section>
  );
}
