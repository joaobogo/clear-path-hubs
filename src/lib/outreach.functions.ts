// Outreach engine visibility server functions.
//
// Views (v_outreach_channel_tiles, v_outreach_campaigns) use security_invoker
// so RLS on outreach_campaigns/outreach_touches applies. Client surface returns
// a curated "safe" summary; admin surface returns the deeper ops view.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export const OUTREACH_CHANNELS = [
  "email",
  "linkedin",
  "phone",
  "sms",
  "referral",
  "event",
  "other",
] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  sms: "SMS",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

export type ChannelTile = {
  channel: OutreachChannel;
  active_campaigns: number;
  total_campaigns: number;
  touches_sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  replied: number;
  opted_out: number;
  failed: number;
  reply_interested: number;
  reply_not_interested: number;
  reply_future: number;
  reply_referral: number;
  reply_ooo: number;
  reply_unsub: number;
  engaged_candidates: number;
  reply_rate: number | null;
  delivery_rate: number | null;
  bounce_rate: number | null;
  interested_rate: number | null;
};

function tileWithRates(r: AnyRow): ChannelTile {
  const sent = Number(r.touches_sent ?? 0);
  const delivered = Number(r.delivered ?? 0);
  const bounced = Number(r.bounced ?? 0);
  const replied = Number(r.replied ?? 0);
  const interested = Number(r.reply_interested ?? 0);
  return {
    channel: r.channel,
    active_campaigns: Number(r.active_campaigns ?? 0),
    total_campaigns: Number(r.total_campaigns ?? 0),
    touches_sent: sent,
    delivered,
    bounced,
    opened: Number(r.opened ?? 0),
    replied,
    opted_out: Number(r.opted_out ?? 0),
    failed: Number(r.failed ?? 0),
    reply_interested: interested,
    reply_not_interested: Number(r.reply_not_interested ?? 0),
    reply_future: Number(r.reply_future ?? 0),
    reply_referral: Number(r.reply_referral ?? 0),
    reply_ooo: Number(r.reply_ooo ?? 0),
    reply_unsub: Number(r.reply_unsub ?? 0),
    engaged_candidates: Number(r.engaged_candidates ?? 0),
    reply_rate: sent > 0 ? replied / sent : null,
    delivery_rate: sent > 0 ? delivered / sent : null,
    bounce_rate: sent > 0 ? bounced / sent : null,
    interested_rate: replied > 0 ? interested / replied : null,
  };
}

// ─── Client-safe summary ───────────────────────────────────────────────────
// Returns channel tiles + engagement totals. Hides bounce/failed noise and
// per-touch error strings to avoid unnecessary confusion in the client view.
export const getOutreachSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: tiles, error } = await context.supabase
      .from("v_outreach_channel_tiles")
      .select("*")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    const withRates = (tiles ?? []).map(tileWithRates);

    // Totals across channels for header numbers.
    const totals = withRates.reduce(
      (acc, t) => {
        acc.active_campaigns += t.active_campaigns;
        acc.total_campaigns += t.total_campaigns;
        acc.touches_sent += t.touches_sent;
        acc.replied += t.replied;
        acc.engaged_candidates += t.engaged_candidates;
        acc.opted_out += t.opted_out;
        acc.reply_interested += t.reply_interested;
        acc.reply_future += t.reply_future;
        return acc;
      },
      {
        active_campaigns: 0,
        total_campaigns: 0,
        touches_sent: 0,
        replied: 0,
        engaged_candidates: 0,
        opted_out: 0,
        reply_interested: 0,
        reply_future: 0,
      },
    );

    // Ensure all channels appear so the tile grid is stable.
    const byChannel = new Map(withRates.map((t) => [t.channel, t] as const));
    const orderedTiles: ChannelTile[] = OUTREACH_CHANNELS.map((ch) =>
      byChannel.get(ch) ?? tileWithRates({ channel: ch }),
    );

    return {
      tiles: orderedTiles,
      totals,
      reply_rate: totals.touches_sent > 0 ? totals.replied / totals.touches_sent : null,
    };
  });

// ─── Admin ops view ────────────────────────────────────────────────────────
// Returns delivery health (bounce/fail), reply-category breakdown, and
// per-campaign rollups. Optionally scoped to a single org.
export const getOutreachOps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId?: string }) =>
    z.object({ orgId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    let tileQ = context.supabase.from("v_outreach_channel_tiles").select("*");
    let campQ = context.supabase
      .from("v_outreach_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.orgId) {
      tileQ = tileQ.eq("organization_id", data.orgId);
      campQ = campQ.eq("organization_id", data.orgId);
    }

    const [{ data: tiles, error: tErr }, { data: camps, error: cErr }] =
      await Promise.all([tileQ, campQ]);
    if (tErr) throw new Error(tErr.message);
    if (cErr) throw new Error(cErr.message);

    // Aggregate tiles across orgs (admin cross-tenant summary).
    const acc = new Map<OutreachChannel, AnyRow>();
    for (const r of (tiles ?? []) as AnyRow[]) {
      const key = r.channel as OutreachChannel;
      const prev = acc.get(key);
      if (!prev) {
        acc.set(key, { ...r });
      } else {
        for (const k of [
          "active_campaigns",
          "total_campaigns",
          "touches_sent",
          "delivered",
          "bounced",
          "opened",
          "replied",
          "opted_out",
          "failed",
          "reply_interested",
          "reply_not_interested",
          "reply_future",
          "reply_referral",
          "reply_ooo",
          "reply_unsub",
          "engaged_candidates",
        ]) {
          prev[k] = Number(prev[k] ?? 0) + Number(r[k] ?? 0);
        }
      }
    }
    const aggTiles = Array.from(acc.values()).map(tileWithRates);
    const byChannel = new Map(aggTiles.map((t) => [t.channel, t] as const));
    const orderedTiles = OUTREACH_CHANNELS.map((ch) =>
      byChannel.get(ch) ?? tileWithRates({ channel: ch }),
    );

    // Reply-category breakdown (all channels combined).
    const replies = orderedTiles.reduce(
      (a, t) => {
        a.interested += t.reply_interested;
        a.not_interested += t.reply_not_interested;
        a.future += t.reply_future;
        a.referral += t.reply_referral;
        a.ooo += t.reply_ooo;
        a.unsub += t.reply_unsub;
        return a;
      },
      { interested: 0, not_interested: 0, future: 0, referral: 0, ooo: 0, unsub: 0 },
    );

    // Delivery health totals.
    const health = orderedTiles.reduce(
      (a, t) => {
        a.touches_sent += t.touches_sent;
        a.delivered += t.delivered;
        a.bounced += t.bounced;
        a.failed += t.failed;
        a.opted_out += t.opted_out;
        return a;
      },
      { touches_sent: 0, delivered: 0, bounced: 0, failed: 0, opted_out: 0 },
    );

    return {
      tiles: orderedTiles,
      campaigns: (camps ?? []) as AnyRow[],
      replies,
      health,
      health_rates: {
        delivery: health.touches_sent > 0 ? health.delivered / health.touches_sent : null,
        bounce: health.touches_sent > 0 ? health.bounced / health.touches_sent : null,
        failed: health.touches_sent > 0 ? health.failed / health.touches_sent : null,
        opted_out: health.touches_sent > 0 ? health.opted_out / health.touches_sent : null,
      },
    };
  });
