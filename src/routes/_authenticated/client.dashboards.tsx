/**
 * Personalised dashboards.
 *
 * A paid entitlement: annual subscribers and accounts with an add-on get to
 * compose their own view. Everyone else sees exactly what it is, what it
 * costs, and how to get it — no teasing, no half-loaded charts.
 */
import { useMemo, useState } from "react";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, LayoutDashboard, Plus, Download, CalendarClock } from "lucide-react";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import {
  DEFAULT_DASHBOARD_BLOCKS,
  exportDashboardRows,
  getDashboardBlocks,
  getDashboardWorkspace,
  listDashboardDeliveries,
  requestCustomDashboard,
  saveDashboard,
  saveDashboardDelivery,
  stopDashboardDelivery,
} from "@/lib/dashboards.functions";
import { BLOCK_LIBRARY, BLOCK_LIST, type BlockId } from "@/lib/dashboards/blocks";
import { DashboardBlock } from "@/components/client/dashboards/dashboard-block";
import { SkeletonRows } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/client/dashboards")({
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.dashboards.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "Your dashboards — build the view you actually use | TaaSFlow" },
      {
        name: "description",
        content:
          "Compose a dashboard from live hiring blocks: pipeline, decisions waiting, time to shortlist, offers, outreach, spend per hire, talent pool and team activity.",
      },
      { property: "og:title", content: "Your dashboards | TaaSFlow" },
      {
        property: "og:description",
        content: "Pick the blocks that matter to you, export them, and have them land in your inbox each week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardsPage,
});

function DashboardsPage() {
  const ctxFn = useServerFn(getClientContext);
  const workspaceFn = useServerFn(getDashboardWorkspace);
  const blocksFn = useServerFn(getDashboardBlocks);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const queryClient = useQueryClient();

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id as string | undefined;

  const workspaceQuery = useQuery({
    queryKey: ["dashboard-workspace", orgId],
    queryFn: () => workspaceFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const { data: workspace, isLoading } = workspaceQuery;
  const workspaceState = useQueryState(workspaceQuery);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<BlockId[] | null>(null);

  const active = useMemo(() => {
    if (!workspace?.dashboards.length) return null;
    return workspace.dashboards.find((d) => d.id === activeId) ?? workspace.dashboards[0];
  }, [workspace, activeId]);

  const blocks: BlockId[] = draftBlocks ?? active?.blocks ?? DEFAULT_DASHBOARD_BLOCKS;
  const allowed = workspace?.entitlement.allowed ?? false;
  const canEdit = (workspace?.canEdit ?? false) && !support.readOnly;

  const blocksQuery = useQuery({
    queryKey: ["dashboard-blocks", orgId, blocks.join(",")],
    queryFn: () => blocksFn({ data: { orgId: orgId!, blocks } }),
    enabled: !!orgId && allowed && blocks.length > 0,
  });
  const { data: blockData, isFetching: blocksLoading } = blocksQuery;

  const saveFn = useServerFn(saveDashboard);
  const save = useMutation({
    mutationFn: (input: { id?: string; name: string; blocks: BlockId[]; isDefault?: boolean }) =>
      saveFn({ data: { orgId: orgId!, ...input } }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Dashboard saved.");
      setDraftBlocks(null);
      setActiveId(res.id);
      queryClient.invalidateQueries({ queryKey: ["dashboard-workspace", orgId] });
    },
  });

  if (ctxQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <QueryErrorCard
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (workspaceState.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <QueryErrorCard
          error={workspaceState.error}
          onRetry={workspaceState.retry}
          retrying={workspaceState.retrying}
        />
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your dashboards</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build the view you actually check each morning. Every number links back to the records
            behind it.
          </p>
        </div>
        {allowed && (
          <div className="flex items-center gap-2">
            <ExportMenu orgId={orgId!} blocks={blocks} name={active?.name ?? "Dashboard"} />
            {canEdit && (
              <ScheduleDialog orgId={orgId!} dashboardId={active?.id ?? null} />
            )}
          </div>
        )}
      </header>

      {!allowed ? (
        <LockedPanel
          reason={workspace.entitlement.reason}
          openRequest={workspace.openRequest}
          orgId={orgId!}
          canRequest={canEdit}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {workspace.dashboards.map((d) => (
              <Button
                key={d.id}
                size="sm"
                variant={active?.id === d.id ? "default" : "outline"}
                onClick={() => {
                  setActiveId(d.id);
                  setDraftBlocks(null);
                }}
              >
                {d.name}
                {d.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
              </Button>
            ))}
            {canEdit && (
              <AddBlockMenu
                current={blocks}
                onAdd={(id) => setDraftBlocks([...blocks, id])}
              />
            )}
            {canEdit && draftBlocks && (
              <SaveDraft
                existingName={active?.name}
                onSave={(name) =>
                  save.mutate({
                    id: active?.id,
                    name,
                    blocks: draftBlocks,
                    isDefault: workspace.dashboards.length === 0 ? true : undefined,
                  })
                }
                onCancel={() => setDraftBlocks(null)}
                saving={save.isPending}
              />
            )}
          </div>

          {blocksQuery.isError ? (
            <QueryErrorCard
              error={blocksQuery.error}
              onRetry={() => blocksQuery.refetch()}
              retrying={blocksQuery.isFetching}
            />
          ) : (
            <div className="grid grid-cols-12 gap-4">
              {blocks.map((id) => (
                <DashboardBlock
                  key={id}
                  definition={BLOCK_LIBRARY[id]}
                  result={blockData?.results.find((r) => r.id === id)}
                  loading={blocksLoading && !blockData}
                  onRemove={
                    canEdit && blocks.length > 1
                      ? () => setDraftBlocks(blocks.filter((b) => b !== id))
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {canEdit && (
            <CustomRequestCard orgId={orgId!} openRequest={workspace.openRequest} />
          )}
        </>
      )}
    </div>
  );
}

function LockedPanel({
  reason,
  openRequest,
  orgId,
  canRequest,
}: {
  reason: string;
  openRequest: { status: string; description: string } | null;
  orgId: string;
  canRequest: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <CardTitle className="text-base">Personalised dashboards aren't on this account</CardTitle>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {BLOCK_LIST.map((b) => (
              <div key={b.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.definition}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/client/plan">See annual plans</Link>
            </Button>
            {canRequest && !openRequest && <RequestDialog orgId={orgId} />}
          </div>
          {openRequest && (
            <p className="text-sm text-muted-foreground">
              Your request is with us — status: {openRequest.status}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddBlockMenu({
  current,
  onAdd,
}: {
  current: BlockId[];
  onAdd: (id: BlockId) => void;
}) {
  const remaining = BLOCK_LIST.filter((b) => !current.includes(b.id));
  const [open, setOpen] = useState(false);
  if (!remaining.length) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add block
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
          <DialogDescription>Each block states exactly what it counts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {remaining.map((b) => (
            <button
              key={b.id}
              type="button"
              className="w-full rounded-md border p-3 text-left hover:bg-muted"
              onClick={() => {
                onAdd(b.id);
                setOpen(false);
              }}
            >
              <p className="text-sm font-medium">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.definition}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SaveDraft({
  existingName,
  onSave,
  onCancel,
  saving,
}: {
  existingName?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(existingName ?? "My dashboard");
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-44"
        aria-label="Dashboard name"
      />
      <Button size="sm" disabled={saving || !name.trim()} onClick={() => onSave(name.trim())}>
        Save layout
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function ExportMenu({ orgId, blocks, name }: { orgId: string; blocks: BlockId[]; name: string }) {
  const exportFn = useServerFn(exportDashboardRows);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { rows } = await exportFn({ data: { orgId, blocks } });
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build that export. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={download} disabled={busy}>
        <Download className="mr-1 h-3.5 w-3.5" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Download className="mr-1 h-3.5 w-3.5" /> PDF
      </Button>
    </div>
  );
}

function ScheduleDialog({ orgId, dashboardId }: { orgId: string; dashboardId: string | null }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveDashboardDelivery);
  const stopFn = useServerFn(stopDashboardDelivery);
  const listFn = useServerFn(listDashboardDeliveries);

  const deliveriesQuery = useQuery({
    queryKey: ["dashboard-deliveries", orgId],
    queryFn: () => listFn({ data: { orgId } }),
    enabled: open,
  });
  const { data } = deliveriesQuery;

  const create = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId,
          dashboardId: dashboardId!,
          format,
          cadence: "weekly" as const,
          recipients: recipients
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Scheduled. First send lands Monday morning.");
      setRecipients("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-deliveries", orgId] });
    },
  });

  const stop = useMutation({
    mutationFn: (id: string) => stopFn({ data: { orgId, id } }),
    onSuccess: () => {
      toast.success("Schedule stopped.");
      queryClient.invalidateQueries({ queryKey: ["dashboard-deliveries", orgId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!dashboardId}>
          <CalendarClock className="mr-1 h-3.5 w-3.5" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this dashboard every Monday</DialogTitle>
          <DialogDescription>
            We email the saved layout at 07:00 UTC each Monday. Stop it any time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recips">Recipients</Label>
            <Input
              id="recips"
              placeholder="you@company.com, cfo@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "csv")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {deliveriesQuery.isError && (
            <QueryErrorCard
              compact
              error={deliveriesQuery.error}
              onRetry={() => deliveriesQuery.refetch()}
              retrying={deliveriesQuery.isFetching}
            />
          )}
          {!deliveriesQuery.isError && !!data?.deliveries.length && (
            <ul className="space-y-2 border-t pt-3">
              {data.deliveries
                .filter((d) => d.active)
                .map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {d.format.toUpperCase()} → {d.recipients.join(", ")}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => stop.mutate(d.id)}>
                      Stop
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !recipients.trim() || !dashboardId}
          >
            Schedule it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const requestFn = useServerFn(requestCustomDashboard);

  const submit = useMutation({
    mutationFn: () => requestFn({ data: { orgId, description: description.trim() } }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Sent. We'll come back with scope and a price.");
      setOpen(false);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-workspace", orgId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Ask for a custom dashboard</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tell us what you need to see</DialogTitle>
          <DialogDescription>
            Describe the decision you're trying to make. We'll scope it, price it, and build it —
            it's chargeable work, so you'll always see the number before we start.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Every Monday I need to know which roles are behind, why, and what it's costing us."
        />
        <DialogFooter>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || description.trim().length < 20}
          >
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomRequestCard({
  orgId,
  openRequest,
}: {
  orgId: string;
  openRequest: {
    status: string;
    description: string;
    quoteAmountCents: number | null;
    quoteCurrency: string;
    quoteNote: string | null;
  } | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="h-4 w-4" /> Need something these blocks don't cover?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We build scoped dashboards to order. You see the price before any work starts.
          </p>
        </div>
        {!openRequest && <RequestDialog orgId={orgId} />}
      </CardHeader>
      {openRequest && (
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">"{openRequest.description}"</p>
          <p>
            Status: <span className="font-medium">{openRequest.status}</span>
            {openRequest.quoteAmountCents != null && (
              <>
                {" · "}Quoted{" "}
                <span className="font-medium">
                  {(openRequest.quoteAmountCents / 100).toLocaleString("en-GB", {
                    style: "currency",
                    currency: openRequest.quoteCurrency.toUpperCase(),
                  })}
                </span>
              </>
            )}
          </p>
          {openRequest.quoteNote && (
            <p className="text-muted-foreground">{openRequest.quoteNote}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
