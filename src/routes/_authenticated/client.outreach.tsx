import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  getOutreachSpine,
  saveChannelRule,
  CHANNEL_LABELS,
  type ChannelRule,
} from "@/lib/outreach.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { SkeletonCards } from "@/components/client/states";

export const Route = createFileRoute("/_authenticated/client/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach · Client workspace" },
      {
        name: "description",
        content:
          "One view of every channel we use to reach candidates, the rules that protect your brand, and what outreach actually produced per role.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "client",
    "src/routes/_authenticated/client.outreach.tsx",
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: OutreachPage,
});

function pct(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

function RuleRow({
  rule,
  canManage,
  onSave,
  saving,
}: {
  rule: ChannelRule;
  canManage: boolean;
  onSave: (r: ChannelRule) => void;
  saving: boolean;
}) {
  const [max, setMax] = useState(String(rule.max_contacts_per_person));
  const [win, setWin] = useState(String(rule.window_hours));
  const [enabled, setEnabled] = useState(rule.enabled);

  useEffect(() => {
    setMax(String(rule.max_contacts_per_person));
    setWin(String(rule.window_hours));
    setEnabled(rule.enabled);
  }, [rule.max_contacts_per_person, rule.window_hours, rule.enabled]);

  const dirty =
    Number(max) !== rule.max_contacts_per_person ||
    Number(win) !== rule.window_hours ||
    enabled !== rule.enabled;

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-border py-4 last:border-0">
      <div className="min-w-32">
        <p className="text-sm font-medium">
          {CHANNEL_LABELS[rule.channel] ?? rule.channel}
        </p>
        <p className="text-xs text-muted-foreground">
          {enabled ? "In use" : "Not used"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={enabled}
          disabled={!canManage}
          onCheckedChange={setEnabled}
          aria-label={`Use ${CHANNEL_LABELS[rule.channel]}`}
        />
      </div>
      <div className="w-28">
        <Label
          htmlFor={`max-${rule.channel}`}
          className="text-xs text-muted-foreground"
        >
          Max contacts
        </Label>
        <Input
          id={`max-${rule.channel}`}
          type="number"
          min={1}
          max={10}
          value={max}
          disabled={!canManage}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      <div className="w-32">
        <Label
          htmlFor={`win-${rule.channel}`}
          className="text-xs text-muted-foreground"
        >
          Window (hours)
        </Label>
        <Input
          id={`win-${rule.channel}`}
          type="number"
          min={1}
          max={2160}
          value={win}
          disabled={!canManage}
          onChange={(e) => setWin(e.target.value)}
        />
      </div>
      <p className="flex-1 text-xs text-muted-foreground">
        At most {max || "1"} contact{Number(max) === 1 ? "" : "s"} to the same
        person on this channel every {win || "0"} hours. The platform blocks the
        rest.
      </p>
      {canManage && dirty && (
        <Button
          size="sm"
          disabled={saving}
          onClick={() =>
            onSave({
              channel: rule.channel,
              max_contacts_per_person: Number(max) || 1,
              window_hours: Number(win) || 1,
              enabled,
            })
          }
        >
          Save
        </Button>
      )}
    </div>
  );
}

function OutreachPage() {
  const orgSearch = useClientOrgSearch();
  const qc = useQueryClient();
  const ctxFn = useServerFn(getClientContext);
  const spineFn = useServerFn(getOutreachSpine);
  const saveRuleFn = useServerFn(saveChannelRule);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctxState = useQueryState(ctxQuery);
  const orgId = ctxState.data?.active?.organization_id;

  const spineQuery = useQuery({
    queryKey: ["outreach-spine", orgId],
    queryFn: () => spineFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });
  const spineState = useQueryState(spineQuery);
  const spine = spineState.data;

  const saveRule = useMutation({
    mutationFn: (r: ChannelRule) =>
      saveRuleFn({ data: { organization_id: orgId!, ...r } as never }),
    onSuccess: () => {
      toast.success("Rule saved. It applies to the next message.");
      qc.invalidateQueries({ queryKey: ["outreach-spine", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctxState.isError) {
    return (
      <div className="p-8">
        <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
      </div>
    );
  }

  if (ctxState.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <SkeletonCards />
      </main>
    );
  }

  if (spineState.isError) {
    return (
      <div className="p-8">
        <QueryErrorCard error={spineState.error} onRetry={spineState.retry} retrying={spineState.retrying} />
      </div>
    );
  }

  if (!orgId || spineState.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <SkeletonCards />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Outreach
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every channel we use to reach people for your roles, in one place.
          Replies land in the same conversation as everything else, whichever
          channel they came from.
        </p>
      </header>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          What protects your brand
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {spine?.standing_rules.map((r) => (
            <li key={r.rule}>
              <p className="text-sm font-medium">{r.rule}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          These rules are enforced in the database, not in a setting someone can
          forget. A blocked contact is recorded with its reason.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Channel rules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {spine?.can_manage
            ? "Set how often a single person can be contacted on each channel."
            : "These are your workspace rules. An admin can change them."}
        </p>
        <div className="mt-4">
          {spine?.rules.map((r) => (
            <RuleRow
              key={r.channel}
              rule={r}
              canManage={!!spine.can_manage}
              saving={saveRule.isPending}
              onSave={(next) => saveRule.mutate(next)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What outreach produced</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacted, replied, shortlisted, hired. We do not report opens — they
          are not reliable and they do not tell you anything you can act on.
        </p>

        {!spine?.roles.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
            <MessageSquare
              className="mx-auto h-6 w-6 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm font-medium">No outreach yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once a sequence runs on one of your roles, the numbers appear
              here.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {spine.roles.map((role) => (
              <article
                key={role.position_id}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {role.position_title}
                    </h3>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {role.channels.map((c) => (
                        <Badge
                          key={c}
                          variant="outline"
                          className="font-normal"
                        >
                          {CHANNEL_LABELS[c] ?? c}
                        </Badge>
                      ))}
                    </p>
                  </div>
                  {role.campaign_status && (
                    <Badge variant="secondary">{role.campaign_status}</Badge>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                  {[
                    ["People contacted", role.people_contacted, null],
                    ["Replied", role.people_replied, pct(role.reply_rate)],
                    [
                      "Reached shortlist",
                      role.became_shortlisted,
                      pct(role.contact_to_shortlist_rate),
                    ],
                    ["Hired", role.became_hired, pct(role.contact_to_hire_rate)],
                    [
                      "Interested replies",
                      role.replies.interested,
                      null,
                    ],
                  ].map(([label, value, sub]) => (
                    <div key={String(label)}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums">
                        {String(value)}
                      </dd>
                      {sub && (
                        <p className="text-xs text-muted-foreground">
                          {sub} of contacted
                        </p>
                      )}
                    </div>
                  ))}
                </dl>

                {role.per_channel.length > 0 && (
                  <table className="mt-4 w-full text-sm">
                    <caption className="sr-only">
                      Outreach per channel for {role.position_title}
                    </caption>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-1 font-medium">
                          Channel
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          Sent
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          Replied
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          Blocked by a rule
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {role.per_channel.map((c) => (
                        <tr key={c.channel} className="border-t border-border">
                          <td className="py-1.5">{c.label}</td>
                          <td className="py-1.5 tabular-nums">{c.sent}</td>
                          <td className="py-1.5 tabular-nums">{c.replied}</td>
                          <td className="py-1.5 tabular-nums">{c.blocked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {!!spine?.blocked_by_reason.length && (
        <section className="mt-8 rounded-lg border border-border bg-muted/30 p-5">
          <h2 className="text-lg font-semibold">Contacts we did not make</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each of these was stopped on purpose.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {spine.blocked_by_reason.map((b) => (
              <li key={b.reason} className="flex justify-between gap-4">
                <span>{b.label}</span>
                <span className="tabular-nums font-medium">{b.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
