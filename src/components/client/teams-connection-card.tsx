import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  getTeamsConnection,
  saveTeamsConnection,
  disconnectTeams,
  sendTeamsTestMessage,
} from "@/lib/teams.functions";

/**
 * Microsoft Teams connection for a client workspace.
 * One channel, an on/off switch, and an explicit list of what gets posted.
 */
export function TeamsConnectionCard({
  orgId,
  canEdit,
}: {
  orgId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const readFn = useServerFn(getTeamsConnection);
  const saveFn = useServerFn(saveTeamsConnection);
  const dropFn = useServerFn(disconnectTeams);
  const testFn = useServerFn(sendTeamsTestMessage);

  const { data, isLoading } = useQuery({
    queryKey: ["teams-connection", orgId],
    queryFn: () => readFn({ data: { orgId } }),
  });

  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [label, setLabel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    const c = data.connection;
    setTeamId(c?.team_id ?? "");
    setChannelId(c?.channel_id ?? "");
    setLabel(c?.channel_label ?? "");
    setEnabled(c?.enabled ?? true);
    setEvents(c?.events ?? data.choices.map((x) => x.value));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId,
          teamId: teamId.trim(),
          channelId: channelId.trim(),
          channelLabel: label.trim() || undefined,
          enabled,
          events,
        },
      }),
    onSuccess: async () => {
      toast.success("Teams connection saved");
      await qc.invalidateQueries({ queryKey: ["teams-connection", orgId] });
    },
    onError: (e) => toastError(e, { fallback: "Could not save" }),
  });

  const drop = useMutation({
    mutationFn: () => dropFn({ data: { orgId } }),
    onSuccess: async () => {
      toast.success("Teams disconnected");
      await qc.invalidateQueries({ queryKey: ["teams-connection", orgId] });
    },
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { orgId } }),
    onSuccess: (r) =>
      r?.ok
        ? toast.success("Test message posted to your channel")
        : toast.error(`Not delivered — ${r?.reason ?? "unknown reason"}`),
    onError: (e) => toastError(e, { fallback: "Could not send test" }),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your Teams connection…</p>;
  }

  const connected = !!data?.connection;
  const last = data?.recent?.[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant={connected && enabled ? "default" : "secondary"}>
          {connected ? (enabled ? "Connected" : "Paused") : "Not connected"}
        </Badge>
        {last && (
          <span className="text-xs text-muted-foreground">
            Last post {last.status === "delivered" ? "delivered" : `failed (${last.error_code})`} ·{" "}
            {new Date(last.created_at as string).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tf-team">Team ID</Label>
          <Input
            id="tf-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={!canEdit}
            placeholder="From the channel's Get link to channel"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tf-channel">Channel ID</Label>
          <Input
            id="tf-channel"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            disabled={!canEdit}
            placeholder="19:...@thread.tacv2"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tf-label">Channel name (for your reference)</Label>
          <Input
            id="tf-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={!canEdit}
            placeholder="Hiring — Engineering"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Post updates to this channel</p>
          <p className="text-xs text-muted-foreground">
            Turn off to pause without losing the setup.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} />
      </div>

      <div>
        <p className="text-sm font-medium">What gets posted</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(data?.choices ?? []).map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={events.includes(c.value)}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setEvents((prev) =>
                    v ? [...new Set([...prev, c.value])] : prev.filter((x) => x !== c.value),
                  )
                }
              />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Candidate posts include Advance, Hold and Decline buttons. They open TaaSFlow and ask
          you to confirm — nothing is decided from Teams alone, and candidate contact details are
          never posted.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => save.mutate()}
          disabled={!canEdit || save.isPending || !teamId.trim() || !channelId.trim()}
        >
          {save.isPending ? "Saving…" : connected ? "Save changes" : "Connect channel"}
        </Button>
        {connected && (
          <>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? "Sending…" : "Send test message"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => drop.mutate()}
              disabled={!canEdit || drop.isPending}
            >
              Disconnect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
