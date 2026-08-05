import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { DecisionBacklogPanel } from "@/components/admin/decision-backlog-panel";
import { UpdateReadinessPanel } from "@/components/admin/update-readiness-panel";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  getClient,
  updateOrganization,
  archiveOrganization,
  getClientActivity,
  getClientCandidatesForOrg,
  getClientDocuments,
  updateClientNotes,
  restoreOrganization,
} from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Users2,
  Contact2,
  Briefcase,
  UserCheck,
  StickyNote,
  FileText,
  Activity,
  ShieldCheck,
  Settings,
  ExternalLink,
  MessagesSquare,
  ClipboardCheck,
} from "lucide-react";

const TABS = [
  "overview",
  "company",
  "contacts",
  "team",
  "positions",
  "candidates",
  "readiness",
  "messages",
  "notes",
  "documents",
  "activity",
  "audit",
  "settings",
] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, { label: string; icon: typeof Building2 }> = {
  overview: { label: "Overview", icon: Building2 },
  company: { label: "Company", icon: Building2 },
  contacts: { label: "Contacts", icon: Contact2 },
  team: { label: "Team", icon: Users2 },
  positions: { label: "Positions", icon: Briefcase },
  candidates: { label: "Candidates", icon: UserCheck },
  readiness: { label: "Update readiness", icon: ClipboardCheck },
  messages: { label: "Messages", icon: MessagesSquare },
  notes: { label: "Notes", icon: StickyNote },
  documents: { label: "Documents", icon: FileText },
  activity: { label: "Activity", icon: Activity },
  audit: { label: "Audit", icon: ShieldCheck },
  settings: { label: "Settings", icon: Settings },
};

const searchSchema = z.object({
  tab: z
    .preprocess((value) => {
      if (typeof value === "string" && TABS.includes(value as TabKey)) return value;
      return "overview";
    }, z.enum(TABS))
    .default("overview"),
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
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.clients.$id.tsx"),
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
    <div className="space-y-6" data-qa-action={`admin-client-${id}`}>
      <div>
        <Link
          to="/admin/clients"
          className="text-xs text-muted-foreground hover:underline"
          data-qa-action="back-to-clients"
        >
          ← All clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
            {String(org.name).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{org.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {org.domain ?? "—"} · {org.industry ?? "—"} · {org.headquarters ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {org.status}
            </Badge>
            {org.archived_at && <Badge variant="secondary">archived</Badge>}
            <Link
              to="/client"
              search={{ org: org.id, preview: "client_admin" }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              title="Open this tenant's dashboard as an administrator (read-only)"
              data-qa-action="view-client-workspace"
            >
              View Client Workspace <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-0.5 border-b" role="tablist">
        {TABS.map((t) => {
          const Icon = TAB_LABELS[t].icon;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              data-qa-action={`tab-${t}`}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                tab === t
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {TAB_LABELS[t].label}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && <OverviewTab org={org} members={members} positions={positions} />}
      {tab === "company" && <CompanyTab org={org} />}
      {tab === "contacts" && <ContactsTab org={org} members={members} />}
      {tab === "team" && <TeamTab members={members} org={org} />}
      {tab === "positions" && <PositionsTab positions={positions} />}
      {tab === "candidates" && <CandidatesTab id={id} />}
      {tab === "readiness" && <UpdateReadinessPanel organizationId={org.id} />}
      {tab === "messages" && <MessagesTab orgId={org.id} />}
      {tab === "notes" && <NotesTab org={org} />}
      {tab === "documents" && <DocumentsTab id={id} />}
      {tab === "activity" && <ActivityTab id={id} />}
      {tab === "audit" && <ActivityTab id={id} audit />}
      {tab === "settings" && <SettingsTab org={org} />}
    </div>
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
          <dt>Onboarding</dt><dd className="text-foreground capitalize">{(org.onboarding_status ?? "not_started").replace("_"," ")}</dd>
          <dt>Dashboard</dt><dd className="text-foreground capitalize">{(org.dashboard_status ?? "inactive").replace("_"," ")}</dd>
          <dt>Website</dt><dd className="text-foreground">{org.website ?? "—"}</dd>
          <dt>Domain</dt><dd className="text-foreground">{org.domain ?? "—"}</dd>
          <dt>Industry</dt><dd className="text-foreground">{org.industry ?? "—"}</dd>
          <dt>Headquarters</dt><dd className="text-foreground">{org.headquarters ?? "—"}</dd>
          <dt>Locations</dt><dd className="text-foreground whitespace-pre-wrap">{org.locations ?? "—"}</dd>
          <dt>Primary contact</dt><dd className="text-foreground">{org.primary_contact_name ?? "—"}</dd>
          <dt>Contact email</dt><dd className="text-foreground">{org.primary_contact_email ?? "—"}</dd>
          <dt>Phone</dt><dd className="text-foreground">{org.phone ?? "—"}</dd>
          <dt>Created</dt><dd className="text-foreground">{new Date(org.created_at).toLocaleString()}</dd>
          <dt>Updated</dt><dd className="text-foreground">{new Date(org.updated_at).toLocaleString()}</dd>
        </dl>
      </div>
      <DecisionBacklogPanel organizationId={org.id} className="md:col-span-3" />
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
  const disabled = Boolean(org.archived_at);

  const initial = {
    name: org.name ?? "",
    website: org.website ?? "",
    domain: org.domain ?? "",
    industry: org.industry ?? "",
    headquarters: org.headquarters ?? "",
    locations: org.locations ?? "",
    phone: org.phone ?? "",
    primary_contact_name: org.primary_contact_name ?? "",
    primary_contact_email: org.primary_contact_email ?? "",
    internal_notes: org.internal_notes ?? "",
    status: org.status as string,
    onboarding_status: (org.onboarding_status ?? "not_started") as string,
    dashboard_status: (org.dashboard_status ?? "inactive") as string,
  };
  const [form, setForm] = useState(initial);
  useEffect(() => {
    setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, org.updated_at]);

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => form[k] !== initial[k],
  );

  const m = useMutation({
    mutationFn: () =>
      updateOrganization({
        data: {
          id: org.id,
          patch: {
            name: form.name.trim(),
            website: form.website,
            domain: form.domain,
            industry: form.industry,
            headquarters: form.headquarters,
            locations: form.locations,
            phone: form.phone,
            primary_contact_name: form.primary_contact_name,
            primary_contact_email: form.primary_contact_email,
            internal_notes: form.internal_notes,
            status: form.status as "prospect" | "active" | "paused" | "closed",
            onboarding_status: form.onboarding_status as
              | "not_started" | "in_progress" | "live" | "on_hold",
            dashboard_status: form.dashboard_status as
              | "inactive" | "active" | "maintenance",
          },
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Saved · ${res.trace_id}`);
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
        if (dirty && !disabled) m.mutate();
      }}
    >
      {disabled && (
        <div className="rounded border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground dark:text-warning-foreground">
          This organization is archived. Editing is disabled.
        </div>
      )}
      <Field label="Company name">
        <Input value={form.name} disabled={disabled} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website">
          <Input value={form.website} disabled={disabled} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="Email domain">
          <Input value={form.domain} disabled={disabled} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
        </Field>
        <Field label="Industry">
          <Input value={form.industry} disabled={disabled} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
        </Field>
        <Field label="Headquarters">
          <Input value={form.headquarters} disabled={disabled} onChange={(e) => setForm({ ...form, headquarters: e.target.value })} />
        </Field>
      </div>
      <Field label="Locations (comma-separated)">
        <Input value={form.locations} disabled={disabled} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Lisbon, London, Remote-EU" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Primary contact">
          <Input value={form.primary_contact_name} disabled={disabled} onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })} />
        </Field>
        <Field label="Contact email">
          <Input type="email" value={form.primary_contact_email} disabled={disabled} onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} disabled={disabled} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Organization status">
          <Select value={form.status} disabled={disabled} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger data-qa-action="org-status-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["prospect","active","paused","closed"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Onboarding status">
          <Select value={form.onboarding_status} disabled={disabled} onValueChange={(v) => setForm({ ...form, onboarding_status: v })}>
            <SelectTrigger data-qa-action="org-onboarding-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["not_started","in_progress","live","on_hold"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dashboard status">
          <Select value={form.dashboard_status} disabled={disabled} onValueChange={(v) => setForm({ ...form, dashboard_status: v })}>
            <SelectTrigger data-qa-action="org-dashboard-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["inactive","active","maintenance"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Internal notes (not visible to the client)">
        <Textarea
          value={form.internal_notes}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
          rows={4}
          placeholder="Ops notes, key context, escalation info…"
        />
      </Field>
      <div>
        <Button type="submit" disabled={!dirty || m.isPending || disabled} data-qa-action="save-company">
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
function TeamTab({ members, org }: { members: any[]; org: any }) {
  const archived = Boolean(org.archived_at);
  const workspaceHref = `/client?org=${encodeURIComponent(org.id)}&preview=client_admin&tab=team`;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/30 p-3 text-xs">
        <div className="max-w-2xl text-muted-foreground">
          Invitations, role changes, reactivation and removal are performed inside
          the Client Workspace so every mutation is audited under an interactive
          support session. Click <strong>Manage team</strong> to open this
          tenant&rsquo;s team console as an administrator.
        </div>
        <a
          href={workspaceHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-disabled={archived}
          data-qa-action="manage-team-in-workspace"
        >
          Manage team <ExternalLink className="h-3 w-3" />
        </a>
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

function ActivityTab({ id, audit = false }: { id: string; audit?: boolean }) {
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
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const alreadyArchived = Boolean(org.archived_at);

  const m = useMutation({
    mutationFn: () =>
      archiveOrganization({ data: { id: org.id, confirm_name: confirm } }),
    onSuccess: async (res) => {
      toast.success(`Client archived · ${res.trace_id}`);
      setOpen(false);
      setConfirm("");
      await qc.invalidateQueries({ queryKey: ["admin-client", org.id] });
      await qc.invalidateQueries({ queryKey: ["admin-clients"] });
      router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: () => restoreOrganization({ data: { id: org.id } }),
    onSuccess: async (res) => {
      toast.success(`Client restored · ${res.trace_id ?? "ok"}`);
      await qc.invalidateQueries({ queryKey: ["admin-client", org.id] });
      await qc.invalidateQueries({ queryKey: ["admin-clients"] });
      router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <div className="rounded-lg border p-4 text-sm">
        <div className="font-medium">Identifiers</div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground font-mono text-xs">
          <dt>Organization ID</dt><dd className="text-foreground break-all">{org.id}</dd>
          {org.archived_at && (
            <>
              <dt>Archived at</dt>
              <dd className="text-foreground break-all">{new Date(org.archived_at).toLocaleString()}</dd>
            </>
          )}
        </dl>
      </div>
      {alreadyArchived ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <div className="font-medium text-warning-foreground dark:text-warning-foreground">Restore client</div>
          <p className="mt-1 text-muted-foreground">
            This client is archived. Restoring returns it to active client lists,
            reactivates any suspended memberships, and re-enables the workspace.
            The action is audited.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            disabled={restore.isPending}
            onClick={() => restore.mutate()}
            data-qa-action="restore-client"
          >
            {restore.isPending ? "Restoring…" : "Restore client"}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="font-medium text-destructive">Archive client</div>
          <p className="mt-1 text-muted-foreground">
            Archiving hides the organization from active client lists and sets its
            dashboard to inactive. Data is retained for audit and can be restored by
            the platform team. Type the exact company name to confirm.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setOpen(true)}
            data-qa-action="open-archive-dialog"
          >
            Archive client…
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {org.name}?</DialogTitle>
            <DialogDescription>
              This is a soft archive. Type <strong>{org.name}</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={org.name}
            data-qa-action="archive-confirm-input"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} data-qa-action="archive-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                confirm.trim().toLowerCase() !== String(org.name).trim().toLowerCase() ||
                m.isPending
              }
              onClick={() => m.mutate()}
              data-qa-action="archive-confirm"
            >
              {m.isPending ? "Archiving…" : "Archive client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Contacts tab ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ContactsTab({ org, members }: { org: any; members: any[] }) {
  const primary = {
    name: org.primary_contact_name as string | null,
    email: org.primary_contact_email as string | null,
    phone: org.phone as string | null,
  };
  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Primary contact
        </div>
        {primary.name || primary.email || primary.phone ? (
          <div className="mt-2 grid gap-1 text-sm">
            <div className="font-medium">{primary.name ?? "—"}</div>
            {primary.email && (
              <a href={`mailto:${primary.email}`} className="text-primary hover:underline">
                {primary.email}
              </a>
            )}
            {primary.phone && <div className="text-muted-foreground">{primary.phone}</div>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No primary contact set. Edit on the Company tab.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <header className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team members with email ({members.filter((m) => m.profiles?.email).length})
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members
              .filter((m) => m.profiles?.email)
              .map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{m.profiles?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`mailto:${m.profiles.email}`}
                      className="text-primary hover:underline"
                    >
                      {m.profiles.email}
                    </a>
                  </td>
                  <td className="px-3 py-2 capitalize">{m.role}</td>
                  <td className="px-3 py-2 capitalize text-xs text-muted-foreground">
                    {m.status}
                  </td>
                </tr>
              ))}
            {members.filter((m) => m.profiles?.email).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No team contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotesTab({ org }: { org: any }) {
  const qc = useQueryClient();
  const [text, setText] = useState<string>(org.internal_notes ?? "");
  useEffect(() => setText(org.internal_notes ?? ""), [org.id, org.updated_at]);

  const m = useMutation({
    mutationFn: () =>
      updateClientNotes({ data: { id: org.id, internal_notes: text } }),
    onSuccess: async () => {
      toast.success("Notes saved");
      await qc.invalidateQueries({ queryKey: ["admin-client", org.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = (text ?? "") !== (org.internal_notes ?? "");

  return (
    <section className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Internal notes are never visible to the client. Use for context, escalation info,
        and ops history.
      </div>
      <Textarea
        rows={14}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add notes for the platform team…"
        data-qa-action="client-notes-editor"
      />
      <div className="flex items-center gap-2">
        <Button
          disabled={!dirty || m.isPending}
          onClick={() => m.mutate()}
          data-qa-action="save-notes"
        >
          {m.isPending ? "Saving…" : "Save notes"}
        </Button>
        {dirty && (
          <button
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setText(org.internal_notes ?? "")}
          >
            Discard changes
          </button>
        )}
      </div>
    </section>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────
function DocumentsTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client-documents", id],
    queryFn: () => getClientDocuments({ data: { id, limit: 100 } }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <header className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Documents linked to this client's candidates ({rows.length})
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">File</th>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium tabular-nums">Size</th>
            <th className="px-3 py-2 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((f) => (
            <tr key={f.id} className="hover:bg-muted/30">
              <td className="px-3 py-2">
                <div className="font-medium">{f.filename}</div>
                <div className="text-[10px] text-muted-foreground">
                  status: {f.file_status}
                </div>
              </td>
              <td className="px-3 py-2">
                {f.candidate_profiles?.full_name ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {f.mime_type ?? "—"}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                {f.size ? `${(Number(f.size) / 1024).toFixed(0)} KB` : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(f.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No documents uploaded by this client's candidates yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Messages tab (pointer view; full thread lives in workspace) ──────────
function MessagesTab({ orgId }: { orgId: string }) {
  return (
    <section className="space-y-3">
      <div className="rounded-lg border bg-card p-6 text-sm">
        <div className="flex items-start gap-3">
          <MessagesSquare className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Messages</h2>
            <p className="mt-1 text-muted-foreground">
              Client conversations live inside the workspace so context, candidates, and
              positions stay linked. Open the workspace to read or reply.
            </p>
            <Link
              to="/client"
              search={{ org: orgId, preview: "client_admin" }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open messages in workspace <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
