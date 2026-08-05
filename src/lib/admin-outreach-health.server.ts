/**
 * Outreach health — data layer.
 *
 * Reads outreach_touches, outreach_opt_outs and outreach_channel_rules for the
 * last 30 days across non-test organizations, then hands the rows to the pure
 * aggregator. Rule usage is computed from the same touch rows, so the "close to
 * the limit" numbers reconcile with the counts shown above them.
 *
 * Pausing a channel writes `enabled = false` on outreach_channel_rules, which
 * is the same row the database-side send guard (outreach_contact_allowed) reads
 * before every outbound touch — there is no separate pause flag to drift.
 */
import {
  aggregateOutreachHealth,
  type ChannelRule,
  type OptOutRow,
  type OutreachHealth,
  type TouchRow,
} from "./outreach-health";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; rpc?: (n: string, a?: unknown) => any };

const DAY = 86_400_000;

export type BounceItem = {
  id: string;
  channel: string;
  organization_id: string;
  org_name: string | null;
  candidate_profile_id: string | null;
  candidate_name: string | null;
  error: string | null;
  sent_at: string;
};

export type OptOutItem = {
  id: string;
  channel: string | null;
  organization_id: string | null;
  org_name: string | null;
  candidate_profile_id: string | null;
  candidate_name: string | null;
  email: string | null;
  reason: string | null;
  created_at: string;
};

export type OutreachHealthPayload = OutreachHealth & {
  bounces: BounceItem[];
  opt_out_items: OptOutItem[];
  include_test: boolean;
  /** Touch rows are loaded for this many days; longer rule windows are clipped to it. */
  loaded_days: number;
};

async function resolveOrgNames(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const res = await admin.from("organizations").select("id, name").in("id", unique).limit(1000);
  if (res.error) throw new Error(res.error.message);
  for (const o of (res.data ?? []) as Array<{ id: string; name: string | null }>) {
    if (o.name) out.set(o.id, o.name);
  }
  return out;
}

async function resolveCandidateNames(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const res = await admin
    .from("candidate_profiles")
    .select("id, full_name")
    .in("id", unique)
    .limit(2000);
  if (res.error) throw new Error(res.error.message);
  for (const p of (res.data ?? []) as Array<{ id: string; full_name: string | null }>) {
    if (p.full_name) out.set(p.id, p.full_name);
  }
  return out;
}

export async function loadOutreachHealth(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<OutreachHealthPayload> {
  const includeTest = opts.includeTest ?? false;
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, includeTest);
  const loadedDays = 30;
  const cutoff = new Date(Date.now() - loadedDays * DAY).toISOString();

  let touchQ = admin
    .from("outreach_touches")
    .select(
      "id, organization_id, channel, state, direction, sent_at, created_at, delivered_at, replied_at, error, candidate_profile_id",
    )
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (!includeTest) touchQ = touchQ.eq("is_test_record", false);
  touchQ = excludeTestOrgs(touchQ, scope);

  let optOutQ = admin
    .from("outreach_opt_outs")
    .select("id, organization_id, candidate_profile_id, email, channel, reason, created_at")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(2000);
  optOutQ = excludeTestOrgs(optOutQ, scope);

  let ruleQ = admin
    .from("outreach_channel_rules")
    .select("id, organization_id, channel, max_contacts_per_person, window_hours, enabled")
    .limit(500);
  ruleQ = excludeTestOrgs(ruleQ, scope);

  const [touchRes, optOutRes, ruleRes] = await Promise.all([touchQ, optOutQ, ruleQ]);
  for (const res of [touchRes, optOutRes, ruleRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const touches = (touchRes.data ?? []) as TouchRow[];
  const optOuts = (optOutRes.data ?? []) as OptOutRow[];
  const rawRules = (ruleRes.data ?? []) as Array<{
    id: string;
    organization_id: string;
    channel: string;
    max_contacts_per_person: number;
    window_hours: number;
    enabled: boolean;
  }>;

  const orgNames = await resolveOrgNames(admin, [
    ...touches.map((t) => t.organization_id),
    ...optOuts.map((o) => o.organization_id ?? ""),
    ...rawRules.map((r) => r.organization_id),
  ]);
  const candidateNames = await resolveCandidateNames(admin, [
    ...touches.filter((t) => t.state === "bounced").map((t) => t.candidate_profile_id ?? ""),
    ...optOuts.map((o) => o.candidate_profile_id ?? ""),
  ]);

  const now = Date.now();
  const rules: ChannelRule[] = rawRules.map((r) => {
    const windowMs = Math.min(r.window_hours, loadedDays * 24) * 3_600_000;
    const inWindow = touches.filter(
      (t) =>
        t.organization_id === r.organization_id &&
        t.channel === r.channel &&
        t.direction === "outbound" &&
        ["sent", "delivered", "opened", "replied", "bounced"].includes(t.state) &&
        Date.parse(t.sent_at ?? t.created_at) >= now - windowMs,
    );
    const perPerson = new Map<string, number>();
    for (const t of inWindow) {
      if (!t.candidate_profile_id) continue;
      perPerson.set(t.candidate_profile_id, (perPerson.get(t.candidate_profile_id) ?? 0) + 1);
    }
    return {
      id: r.id,
      organization_id: r.organization_id,
      org_name: orgNames.get(r.organization_id) ?? null,
      channel: r.channel,
      max_contacts_per_person: r.max_contacts_per_person,
      window_hours: r.window_hours,
      enabled: r.enabled,
      sends_in_window: inWindow.length,
      people_in_window: perPerson.size,
      people_at_cap: [...perPerson.values()].filter((n) => n >= r.max_contacts_per_person).length,
    };
  });
  rules.sort(
    (a, b) =>
      (a.org_name ?? "").localeCompare(b.org_name ?? "") || a.channel.localeCompare(b.channel),
  );

  const aggregate = aggregateOutreachHealth({ touches, optOuts, rules, now });

  const bounces: BounceItem[] = touches
    .filter((t) => t.state === "bounced")
    .map((t) => ({
      id: t.id,
      channel: t.channel,
      organization_id: t.organization_id,
      org_name: orgNames.get(t.organization_id) ?? null,
      candidate_profile_id: t.candidate_profile_id,
      candidate_name: t.candidate_profile_id
        ? candidateNames.get(t.candidate_profile_id) ?? null
        : null,
      error: t.error,
      sent_at: t.sent_at ?? t.created_at,
    }))
    .slice(0, 200);

  const opt_out_items: OptOutItem[] = optOuts
    .map((o) => ({
      id: o.id,
      channel: o.channel,
      organization_id: o.organization_id,
      org_name: o.organization_id ? orgNames.get(o.organization_id) ?? null : null,
      candidate_profile_id: o.candidate_profile_id,
      candidate_name: o.candidate_profile_id
        ? candidateNames.get(o.candidate_profile_id) ?? null
        : null,
      email: o.email,
      reason: o.reason,
      created_at: o.created_at,
    }))
    .slice(0, 200);

  return { ...aggregate, bounces, opt_out_items, include_test: includeTest, loaded_days: loadedDays };
}

/**
 * Pause or resume a channel for one organization. Writes the row the send guard
 * already checks, so a paused channel is blocked at insert time — not merely
 * hidden in the UI.
 */
export async function setChannelEnabled(
  admin: Admin,
  input: { organization_id: string; channel: string; enabled: boolean; actor_user_id: string },
): Promise<{ ok: true; enabled: boolean }> {
  const existing = await admin
    .from("outreach_channel_rules")
    .select("id, max_contacts_per_person, window_hours")
    .eq("organization_id", input.organization_id)
    .eq("channel", input.channel)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const res = await admin.from("outreach_channel_rules").upsert(
    {
      organization_id: input.organization_id,
      channel: input.channel,
      enabled: input.enabled,
      max_contacts_per_person: existing.data?.max_contacts_per_person ?? 1,
      window_hours: existing.data?.window_hours ?? 168,
    },
    { onConflict: "organization_id,channel" },
  );
  if (res.error) throw new Error(res.error.message);

  await admin.from("audit_events").insert({
    organization_id: input.organization_id,
    actor_user_id: input.actor_user_id,
    action: input.enabled ? "outreach_channel_resumed" : "outreach_channel_paused",
    entity_type: "outreach_channel_rules",
    entity_id: existing.data?.id ?? null,
    before_state: { enabled: !input.enabled },
    after_state: { channel: input.channel, enabled: input.enabled },
  });

  return { ok: true, enabled: input.enabled };
}
