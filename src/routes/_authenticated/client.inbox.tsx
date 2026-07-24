import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listMyNotifications,
  markNotificationsRead,
} from "@/lib/notifications.functions";
import {
  listMyActivity,
  getMyPreferences,
  updateMyPreferences,
} from "@/lib/inbox.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCheck, MessageSquare, Activity, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
});

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InboxPage() {
  const orgId = useClientOrgSearch();
  const [tab, setTab] = useState("notifications");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" /> Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Notifications, direct messages, and workspace activity — all in one place.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" /> Activity
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm">
              <p className="text-muted-foreground mb-3">
                Direct messages with your delivery team.
              </p>
              <Button asChild>
                <Link
                  to="/client/messages"
                  search={orgId ? { org: orgId } : undefined}
                >
                  Open messages
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          {orgId ? (
            <PreferencesTab orgId={orgId} />
          ) : (
            <div className="text-sm text-muted-foreground">Select an organization.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const mark = useServerFn(markNotificationsRead);
  const q = useQuery({
    queryKey: ["inbox", "notifications"],
    queryFn: () => list(),
  });
  const markMut = useMutation({
    mutationFn: (ids?: string[]) => mark({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox", "notifications"] }),
  });

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          Recent notifications
          {unread > 0 && <Badge>{unread} unread</Badge>}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={unread === 0 || markMut.isPending}
          onClick={() => markMut.mutate(undefined)}
        >
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!q.isLoading && items.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        )}
        <ul className="divide-y">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 py-3 ${!n.read_at ? "bg-primary/5 -mx-4 px-4 rounded" : ""}`}
            >
              <div className={`mt-1 h-2 w-2 rounded-full ${n.read_at ? "bg-muted" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{n.title}</div>
                  <span className="text-xs text-muted-foreground">{relTime(n.created_at)}</span>
                </div>
                {n.body && (
                  <div className="text-sm text-muted-foreground line-clamp-2">{n.body}</div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{n.event_type}</Badge>
                  {n.link_path && (
                    <Link to={n.link_path} className="text-xs text-primary underline">
                      Open →
                    </Link>
                  )}
                </div>
              </div>
              {!n.read_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markMut.mutate([n.id])}
                >
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActivityTab({ orgId }: { orgId: string | undefined }) {
  const run = useServerFn(listMyActivity);
  const q = useQuery({
    queryKey: ["inbox", "activity", orgId ?? "all"],
    queryFn: () =>
      run({ data: orgId ? { organization_id: orgId, limit: 100 } : { limit: 100 } }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace activity</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!q.isLoading && (q.data?.items.length ?? 0) === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No recent activity in this workspace.
          </div>
        )}
        <ul className="divide-y">
          {(q.data?.items ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {String(e.entity_type).replace(/_/g, " ")}
                  </Badge>
                  <span className="capitalize">{String(e.action).replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{relTime(e.created_at)}</span>
                </div>
                {e.entity_id && (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {e.entity_id}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PreferencesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const getPrefs = useServerFn(getMyPreferences);
  const updatePrefs = useServerFn(updateMyPreferences);
  const q = useQuery({
    queryKey: ["inbox", "preferences", orgId],
    queryFn: () => getPrefs({ data: { organization_id: orgId } }),
  });
  const mut = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (patch: any) =>
      updatePrefs({ data: { organization_id: orgId, ...patch } }),
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["inbox", "preferences", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = q.data?.preferences;
  if (!p) return <div className="text-sm text-muted-foreground">Loading preferences…</div>;

  const toggle = (key: string, value: boolean) => mut.mutate({ [key]: value });

  const rows: Array<{ key: keyof typeof p; label: string; hint: string }> = [
    { key: "candidate_delivered", label: "Candidates delivered", hint: "Email + in-app when a new candidate arrives." },
    { key: "interview_request", label: "Interview requests", hint: "Scheduling requests and confirmations." },
    { key: "new_message", label: "New messages", hint: "Direct messages from your delivery team." },
    { key: "offer_update", label: "Offer updates", hint: "Drafted, sent, accepted, or closed offers." },
    { key: "hire_update", label: "Hire confirmations", hint: "Hire and start-date updates." },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">{r.label}</Label>
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <Switch
                checked={Boolean(p[r.key])}
                onCheckedChange={(v) => toggle(String(r.key), v)}
              />
            </div>
          ))}
        </div>
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Email delivery</Label>
              <p className="text-xs text-muted-foreground">
                Also send matched notifications by email.
              </p>
            </div>
            <Switch
              checked={Boolean(p.email_enabled)}
              onCheckedChange={(v) => toggle("email_enabled", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Digest</Label>
              <p className="text-xs text-muted-foreground">
                Bundle non-urgent notifications instead of sending each one immediately.
              </p>
            </div>
            <Select
              value={String(p.digest ?? "immediate")}
              onValueChange={(v) => mut.mutate({ digest: v })}
            >
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
