import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  getSourcingOps,
  saveSourcingPlan,
  saveSourcingCampaign,
  deleteSourcingCampaign,
  STRATEGY_STATUSES,
  JOB_BOARD_STATUSES,
  SPONSORED_STATUSES,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
} from "@/lib/sourcing-ops.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmAction } from "@/components/ds";
import { Plus, Radar, Trash2 } from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const titleise = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const toDateInput = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

export function SourcingOpsPanel({ positionId }: { positionId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getSourcingOps);
  const savePlanFn = useServerFn(saveSourcingPlan);
  const saveCampaignFn = useServerFn(saveSourcingCampaign);
  const deleteCampaignFn = useServerFn(deleteSourcingCampaign);
  const { confirm, confirmDialog } = useConfirmAction();

  const key = ["admin-sourcing-ops", positionId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { positionId } }),
  });

  const [draft, setDraft] = useState<Any>(null);
  const plan = draft ?? data?.plan ?? null;
  const field = (name: string, fallback = "") =>
    (plan?.[name] ?? (data?.plan as Any)?.[name] ?? fallback) as string;

  const savePlan = useMutation({
    mutationFn: (payload: Any) => savePlanFn({ data: payload }),
    onSuccess: () => {
      toast.success("Sourcing record saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Any) => toast.error(e?.message ?? "Could not save the sourcing record"),
  });

  const saveCampaign = useMutation({
    mutationFn: (payload: Any) => saveCampaignFn({ data: payload }),
    onSuccess: () => {
      toast.success("Channel saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Any) => toast.error(e?.message ?? "Could not save the channel"),
  });

  const removeCampaign = useMutation({
    mutationFn: (payload: Any) => deleteCampaignFn({ data: payload }),
    onSuccess: () => {
      toast.success("Channel removed");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Any) => toast.error(e?.message ?? "Could not remove the channel"),
  });

  const [editing, setEditing] = useState<Any>(null);

  const totals = data?.totals;
  const funnel = useMemo(
    () => [
      { label: "Identified", value: totals?.identified ?? 0 },
      { label: "Contacted", value: totals?.contacted ?? 0 },
      { label: "Engaged", value: totals?.engaged ?? 0 },
      { label: "Replied", value: totals?.replied ?? 0 },
      { label: "Applicants", value: data?.applicationCount ?? 0 },
      { label: "Qualified", value: data?.matchCount ?? 0 },
    ],
    [totals, data?.applicationCount, data?.matchCount],
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading sourcing record…</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load the sourcing record. {(error as Any)?.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Radar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sourcing record</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatusSelect
            label="Strategy"
            value={field("strategy_status", "not_started")}
            options={STRATEGY_STATUSES as unknown as string[]}
            onChange={(v) => setDraft({ ...(plan ?? {}), strategy_status: v })}
          />
          <StatusSelect
            label="Job board distribution"
            value={field("job_board_status", "not_started")}
            options={JOB_BOARD_STATUSES as unknown as string[]}
            onChange={(v) => setDraft({ ...(plan ?? {}), job_board_status: v })}
          />
          <StatusSelect
            label="Sponsored campaigns"
            value={field("sponsored_status", "not_started")}
            options={SPONSORED_STATUSES as unknown as string[]}
            onChange={(v) => setDraft({ ...(plan ?? {}), sponsored_status: v })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Next action</Label>
            <Input
              value={field("next_action")}
              placeholder="e.g. Launch LinkedIn sequence B"
              onChange={(e) => setDraft({ ...(plan ?? {}), next_action: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Next action date</Label>
            <Input
              type="date"
              value={toDateInput(field("next_action_at"))}
              onChange={(e) =>
                setDraft({
                  ...(plan ?? {}),
                  next_action_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Strategy notes</Label>
            <Textarea
              rows={3}
              value={field("strategy_notes")}
              onChange={(e) => setDraft({ ...(plan ?? {}), strategy_notes: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Exceptions and failed operations</Label>
            <Textarea
              rows={3}
              value={field("exceptions")}
              placeholder="Anything blocked, bounced, or needing intervention"
              onChange={(e) => setDraft({ ...(plan ?? {}), exceptions: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {data?.plan?.last_reviewed_at
              ? `Last reviewed ${new Date(data.plan.last_reviewed_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}`
              : "Not reviewed yet."}
          </p>
          <Button
            size="sm"
            disabled={savePlan.isPending}
            onClick={() =>
              savePlan.mutate({
                positionId,
                strategy_status: field("strategy_status", "not_started"),
                job_board_status: field("job_board_status", "not_started"),
                sponsored_status: field("sponsored_status", "not_started"),
                strategy_notes: field("strategy_notes") || null,
                next_action: field("next_action") || null,
                next_action_at: field("next_action_at") || null,
                exceptions: field("exceptions") || null,
              })
            }
          >
            {savePlan.isPending ? "Saving…" : "Save sourcing record"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Verified funnel</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {funnel.map((f) => (
            <div key={f.label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-xl font-semibold tabular-nums">{f.value}</p>
            </div>
          ))}
        </div>
        {totals && totals.failed > 0 && (
          <p className="mt-3 text-xs text-destructive">
            {totals.failed} failed or bounced outreach {totals.failed === 1 ? "touch" : "touches"}.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Channels</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEditing({
                id: null,
                name: "",
                channel: "linkedin",
                status: "draft",
              })
            }
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add channel
          </Button>
        </div>

        {(data?.campaigns ?? []).length === 0 && !editing && (
          <p className="text-sm text-muted-foreground">
            No channels recorded for this role yet.
          </p>
        )}

        <div className="space-y-3">
          {(data?.campaigns ?? []).map((c: Any) => (
            <div key={c.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {titleise(c.channel)}
                    {c.external_ref ? ` · ${c.external_ref}` : ""}
                    {c.next_action ? ` · Next: ${c.next_action}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{titleise(c.status)}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...c })}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const res = await confirm({
                        title: "Remove this channel?",
                        object: c.name,
                        description:
                          "The channel and its outreach touches are deleted permanently.",
                        confirmLabel: "Remove channel",
                        tone: "destructive",
                        reason: { label: "Reason", required: true },
                      });
                      if (!res.confirmed) return;
                      await removeCampaign.mutateAsync({ id: c.id, reason: res.reason });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Identified" v={c.manual_identified ?? c.verified.identified} />
                <Metric label="Contacted" v={c.manual_contacted ?? c.verified.contacted} />
                <Metric label="Engaged" v={c.manual_engaged ?? c.verified.engaged} />
                <Metric label="Replied" v={c.manual_replied ?? c.verified.replied} />
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="mt-4 rounded-md border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Channel name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Channel type</Label>
                <Select
                  value={editing.channel}
                  onValueChange={(v) => setEditing({ ...editing, channel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {titleise(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {titleise(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>External reference</Label>
                <Input
                  value={editing.external_ref ?? ""}
                  placeholder="Campaign ID in the external tool"
                  onChange={(e) => setEditing({ ...editing, external_ref: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next action</Label>
                <Input
                  value={editing.next_action ?? ""}
                  onChange={(e) => setEditing({ ...editing, next_action: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next action date</Label>
                <Input
                  type="date"
                  value={toDateInput(editing.next_action_at)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      next_action_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["manual_identified", "Identified"],
                  ["manual_contacted", "Contacted"],
                  ["manual_engaged", "Engaged"],
                  ["manual_replied", "Replied"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label className="text-xs">{label} (manual)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing[k] ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        [k]: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saveCampaign.isPending || !editing.name?.trim()}
                onClick={() =>
                  saveCampaign.mutate({
                    id: editing.id ?? null,
                    positionId,
                    name: editing.name,
                    channel: editing.channel,
                    status: editing.status,
                    target_count: editing.target_count ?? null,
                    external_ref: editing.external_ref || null,
                    notes: editing.notes || null,
                    next_action: editing.next_action || null,
                    next_action_at: editing.next_action_at || null,
                    manual_identified: editing.manual_identified ?? null,
                    manual_contacted: editing.manual_contacted ?? null,
                    manual_engaged: editing.manual_engaged ?? null,
                    manual_replied: editing.manual_replied ?? null,
                  })
                }
              >
                {saveCampaign.isPending ? "Saving…" : "Save channel"}
              </Button>
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

function Metric({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border px-2 py-1.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

function StatusSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {titleise(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
