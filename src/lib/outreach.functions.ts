import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const OUTREACH_CHANNELS = [
  "email",
  "linkedin",
  "sms",
  "phone",
] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  sms: "SMS",
  phone: "Phone task",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

/**
 * The rules, written the way they are shown on screen. These are the
 * human-quality guarantees a client is trusting us with their brand for.
 */
export const STANDING_RULES: { rule: string; detail: string }[] = [
  {
    rule: "One contact per person, per channel, per window",
    detail:
      "A person is contacted at most the number of times you set on a channel, inside the window you set. The platform blocks the rest.",
  },
  {
    rule: "Automatic stop on reply",
    detail:
      "The moment someone replies on any channel, every remaining message in their sequence stops.",
  },
  {
    rule: "Automatic stop on opt-out",
    detail:
      "An opt-out stops contact on that channel, or on all channels, immediately and permanently.",
  },
  {
    rule: "Hard stop once a candidate enters process",
    detail:
      "As soon as someone is delivered to you, shortlisted, interviewing, at offer or hired, all outreach to them stops across every channel.",
  },
];

export const BLOCK_REASON_LABELS: Record<string, string> = {
  opted_out: "They opted out",
  already_replied: "They already replied",
  in_process: "They are already in process",
  frequency_cap: "Contacted too recently on this channel",
  channel_disabled: "That channel is switched off",
  agent_switched_off: "The Outreach agent was switched off",
};

async function assertMember(supabase: Db, userId: string, org: string) {
  const { data } = await supabase.rpc("is_org_member", {
    _user: userId,
    _org: org,
  });
  if (!data) throw new Error("You do not have access to this workspace.");
}

async function assertAdmin(supabase: Db, userId: string, org: string) {
  const { data: admin } = await supabase.rpc("is_org_admin", {
    _user: userId,
    _org: org,
  });
  if (admin) return;
  const { data: staff } = await supabase.rpc("is_platform_staff", {
    _user: userId,
  });
  if (!staff) throw new Error("Only a workspace admin can change these rules.");
}

export type ChannelRule = {
  channel: string;
  max_contacts_per_person: number;
  window_hours: number;
  enabled: boolean;
};

export type ChannelStat = {
  channel: string;
  label: string;
  sent: number;
  replied: number;
  blocked: number;
};

export type RoleOutreach = {
  position_id: string;
  position_title: string;
  campaign_id: string | null;
  campaign_status: string | null;
  channels: string[];
  people_contacted: number;
  people_replied: number;
  replies: {
    interested: number;
    not_interested: number;
    future: number;
    referral: number;
    unsubscribe: number;
    other: number;
  };
  became_shortlisted: number;
  became_hired: number;
  reply_rate: number | null;
  contact_to_shortlist_rate: number | null;
  contact_to_hire_rate: number | null;
  first_touch_at: string | null;
  last_activity_at: string | null;
  per_channel: ChannelStat[];
};

export type OutreachSpine = {
  organization_id: string;
  can_manage: boolean;
  rules: ChannelRule[];
  standing_rules: typeof STANDING_RULES;
  roles: RoleOutreach[];
  blocked_by_reason: { reason: string; label: string; count: number }[];
  has_any_outreach: boolean;
};

function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export const getOutreachSpine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<OutreachSpine> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const org = data.organization_id;
    await assertMember(supabase, userId, org);

    const { data: isAdmin } = await supabase.rpc("is_org_admin", {
      _user: userId,
      _org: org,
    });
    const { data: isStaff } = await supabase.rpc("is_platform_staff", {
      _user: userId,
    });

    const { data: ruleRows } = await supabase
      .from("outreach_channel_rules")
      .select("channel, max_contacts_per_person, window_hours, enabled")
      .eq("organization_id", org);

    const ruleByChannel = new Map<string, Db>(
      (ruleRows ?? []).map((r: Db) => [r.channel, r]),
    );
    const rules: ChannelRule[] = OUTREACH_CHANNELS.map((c) => {
      const r = ruleByChannel.get(c);
      return {
        channel: c,
        max_contacts_per_person: r?.max_contacts_per_person ?? 1,
        window_hours: r?.window_hours ?? 168,
        enabled: r?.enabled ?? true,
      };
    });

    const { data: campaigns } = await supabase
      .from("outreach_campaigns")
      .select("id, position_id, status, channels, channel, positions:position_id(title)")
      .eq("organization_id", org)
      .limit(500);

    const { data: report } = await supabase
      .from("outreach_role_report")
      .select("*")
      .eq("organization_id", org)
      .limit(500);

    const { data: touches } = await supabase
      .from("outreach_touches")
      .select("campaign_id, channel, state, blocked_reason")
      .eq("organization_id", org)
      .limit(20000);

    const reportByPosition = new Map<string, Db>(
      (report ?? []).map((r: Db) => [r.position_id, r]),
    );

    const touchesByCampaign = new Map<string, Db[]>();
    for (const t of touches ?? []) {
      const list = touchesByCampaign.get(t.campaign_id) ?? [];
      list.push(t);
      touchesByCampaign.set(t.campaign_id, list);
    }

    const roles: RoleOutreach[] = (campaigns ?? [])
      .filter((c: Db) => c.position_id)
      .map((c: Db) => {
        const r = reportByPosition.get(c.position_id) ?? {};
        const mine = touchesByCampaign.get(c.id) ?? [];
        const channels: string[] =
          (c.channels ?? []).length > 0 ? c.channels : [c.channel];

        const perChannel: ChannelStat[] = channels.map((ch: string) => {
          const list = mine.filter((t: Db) => t.channel === ch);
          return {
            channel: ch,
            label: CHANNEL_LABELS[ch] ?? ch,
            sent: list.filter((t: Db) =>
              ["sent", "delivered", "opened", "replied"].includes(t.state),
            ).length,
            replied: list.filter((t: Db) => t.state === "replied").length,
            blocked: list.filter((t: Db) => !!t.blocked_reason).length,
          };
        });

        const contacted = Number(r.people_contacted ?? 0);
        const replied = Number(r.people_replied ?? 0);
        const shortlisted = Number(r.became_shortlisted ?? 0);
        const hired = Number(r.became_hired ?? 0);

        return {
          position_id: c.position_id,
          position_title: c.positions?.title ?? "Untitled role",
          campaign_id: c.id,
          campaign_status: c.status,
          channels,
          people_contacted: contacted,
          people_replied: replied,
          replies: {
            interested: Number(r.replies_interested ?? 0),
            not_interested: Number(r.replies_not_interested ?? 0),
            future: Number(r.replies_future ?? 0),
            referral: Number(r.replies_referral ?? 0),
            unsubscribe: Number(r.replies_unsubscribe ?? 0),
            other: Number(r.replies_other ?? 0),
          },
          became_shortlisted: shortlisted,
          became_hired: hired,
          reply_rate: rate(replied, contacted),
          contact_to_shortlist_rate: rate(shortlisted, contacted),
          contact_to_hire_rate: rate(hired, contacted),
          first_touch_at: r.first_touch_at ?? null,
          last_activity_at: r.last_activity_at ?? null,
          per_channel: perChannel,
        };
      });

    const blockedCounts = new Map<string, number>();
    for (const t of touches ?? []) {
      if (!t.blocked_reason) continue;
      blockedCounts.set(
        t.blocked_reason,
        (blockedCounts.get(t.blocked_reason) ?? 0) + 1,
      );
    }

    return {
      organization_id: org,
      can_manage: !!isAdmin || !!isStaff,
      rules,
      standing_rules: STANDING_RULES,
      roles,
      blocked_by_reason: [...blockedCounts.entries()]
        .map(([reason, count]) => ({
          reason,
          label: BLOCK_REASON_LABELS[reason] ?? reason,
          count,
        }))
        .sort((a, b) => b.count - a.count),
      has_any_outreach: (touches ?? []).length > 0,
    };
  });

export const saveChannelRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        channel: z.enum(OUTREACH_CHANNELS),
        max_contacts_per_person: z.number().int(),
        window_hours: z.number().int(),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertAdmin(supabase, userId, data.organization_id);

    const max = Math.min(Math.max(data.max_contacts_per_person, 1), 10);
    const window = Math.min(Math.max(data.window_hours, 1), 2160);

    const { error } = await supabase.from("outreach_channel_rules").upsert(
      {
        organization_id: data.organization_id,
        channel: data.channel,
        max_contacts_per_person: max,
        window_hours: window,
        enabled: data.enabled,
      },
      { onConflict: "organization_id,channel" },
    );
    if (error) throw error;

    return {
      channel: data.channel,
      max_contacts_per_person: max,
      window_hours: window,
      enabled: data.enabled,
    };
  });

/**
 * Ask the platform whether a person may be contacted right now. Same guard
 * the database enforces on insert, exposed so the UI can explain a block
 * before anyone tries.
 */
export const checkContactAllowed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        candidate_profile_id: z.string().uuid(),
        channel: z.enum(OUTREACH_CHANNELS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertMember(supabase, userId, data.organization_id);
    const { data: verdict, error } = await supabase.rpc(
      "outreach_contact_allowed",
      {
        _org: data.organization_id,
        _candidate_profile_id: data.candidate_profile_id,
        _channel: data.channel,
      },
    );
    if (error) throw error;
    const v = verdict as { allowed: boolean; reason: string | null };
    return {
      allowed: v.allowed,
      reason: v.reason,
      label: v.reason ? (BLOCK_REASON_LABELS[v.reason] ?? v.reason) : null,
    };
  });
