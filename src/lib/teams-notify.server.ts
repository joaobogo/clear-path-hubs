/**
 * Microsoft Teams notifications (server-only).
 *
 * Posts a branded message card into the TaaSFlow Teams channel whenever a
 * candidate applies or someone submits a public form. All calls are
 * fire-and-forget and never throw into the caller's flow — a Teams outage
 * must never break an application or an intake.
 *
 * Routed through the Lovable connector gateway (handles OAuth refresh).
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_teams";

const TEAM_ID = process.env.TEAMS_TEAM_ID ?? "23502890-88dc-4bf9-9c15-7257018e2a47";
const CHANNEL_ID =
  process.env.TEAMS_CHANNEL_ID ??
  "19:nIJeqUKA79SIyW6vfYoNvVKUzc1Vv-DAZzuT-erYcl01@thread.tacv2";

const APP_URL = process.env.PUBLIC_APP_URL ?? "https://www.taasflow.com";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export type TeamsNotice = {
  /** Short headline, e.g. "New application". */
  title: string;
  /** Bold one-liner under the title. */
  subtitle?: string;
  /** Label / value rows. Empty values are dropped. */
  facts?: Array<{ label: string; value: unknown }>;
  /** Relative app path to deep-link into (e.g. /admin/candidates). */
  linkPath?: string;
  linkLabel?: string;
};

function renderHtml(n: TeamsNotice): string {
  const rows = (n.facts ?? [])
    .filter((f) => f.value !== null && f.value !== undefined && String(f.value).trim() !== "")
    .map(
      (f) =>
        `<tr><td><b>${esc(f.label)}</b></td><td>&nbsp;${esc(f.value)}</td></tr>`,
    )
    .join("");

  const link = n.linkPath
    ? `<p><a href="${esc(`${APP_URL}${n.linkPath}`)}">${esc(n.linkLabel ?? "Open in TaaSFlow")}</a></p>`
    : "";

  return [
    `<h3>${esc(n.title)}</h3>`,
    n.subtitle ? `<p><b>${esc(n.subtitle)}</b></p>` : "",
    rows ? `<table>${rows}</table>` : "",
    link,
  ]
    .filter(Boolean)
    .join("");
}

/**
 * Posts to the configured Teams channel. Returns a result object instead of
 * throwing so callers can log without try/catch noise.
 */
export async function notifyTeams(
  notice: TeamsNotice,
): Promise<{ ok: boolean; reason?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const teamsKey = process.env.MICROSOFT_TEAMS_API_KEY;

  if (!lovableKey || !teamsKey) {
    return { ok: false, reason: "teams_not_configured" };
  }

  try {
    const res = await fetch(
      `${GATEWAY_URL}/teams/${TEAM_ID}/channels/${encodeURIComponent(CHANNEL_ID)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": teamsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: { contentType: "html", content: renderHtml(notice) },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[teams] post failed [${res.status}]: ${detail.slice(0, 500)}`);
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[teams] post threw", err);
    return { ok: false, reason: "network_error" };
  }
}

/** Fire-and-forget wrapper — safe to call without awaiting. */
export function notifyTeamsSafe(notice: TeamsNotice): void {
  void notifyTeams(notice).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Per-workspace routing (client Teams channels)
// ---------------------------------------------------------------------------

/** Posts into an explicit team/channel rather than the TaaSFlow staff channel. */
export async function postToTeamsChannel(
  target: { teamId: string; channelId: string },
  notice: TeamsNotice,
  extraHtml = "",
): Promise<{ ok: boolean; reason?: string; detail?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const teamsKey = process.env.MICROSOFT_TEAMS_API_KEY;
  if (!lovableKey || !teamsKey) return { ok: false, reason: "teams_not_configured" };

  try {
    const res = await fetch(
      `${GATEWAY_URL}/teams/${encodeURIComponent(target.teamId)}/channels/${encodeURIComponent(target.channelId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": teamsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: { contentType: "html", content: renderHtml(notice) + extraHtml },
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      return { ok: false, reason: `http_${res.status}`, detail };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "network_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export type TeamsAction = "shortlist" | "hold" | "not_moving_forward";

const ACTION_LABEL: Record<TeamsAction, string> = {
  shortlist: "Advance",
  hold: "Hold",
  not_moving_forward: "Decline",
};

function sha256(value: string): string {
  // Lazily required so this module stays importable from route graphs.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Mints one-time, expiring action links for a candidate. The link opens the
 * workspace, requires the person to be signed in as a member of that
 * organization, and asks for confirmation before anything is written.
 */
async function mintActionLinks(args: {
  organizationId: string;
  candidateMatchId: string;
  actions: TeamsAction[];
}): Promise<Array<{ action: TeamsAction; url: string }>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const out: Array<{ action: TeamsAction; url: string }> = [];

  for (const action of args.actions) {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const { error } = await supabaseAdmin.from("teams_action_links").insert({
      token_hash: sha256(token),
      organization_id: args.organizationId,
      candidate_match_id: args.candidateMatchId,
      action,
      expires_at: expires,
    });
    if (error) continue;
    out.push({ action, url: `${APP_URL}/teams/act/${token}` });
  }
  return out;
}

function renderActions(links: Array<{ action: TeamsAction; url: string }>): string {
  if (links.length === 0) return "";
  const buttons = links
    .map((l) => `<a href="${esc(l.url)}"><b>${esc(ACTION_LABEL[l.action])}</b></a>`)
    .join("&nbsp;&nbsp;|&nbsp;&nbsp;");
  return `<p>${buttons}</p><p><i>You'll be asked to sign in and confirm — nothing changes from Teams alone.</i></p>`;
}

async function logTeamsDelivery(row: {
  organization_id: string | null;
  event_type: string | null;
  status: string;
  error_code?: string | null;
  error_message?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("teams_delivery_log").insert({
      organization_id: row.organization_id,
      event_type: row.event_type,
      status: row.status,
      error_code: row.error_code ?? null,
      error_message: row.error_message ?? null,
    });
  } catch {
    /* logging must never break a flow */
  }
}

/**
 * Routes an event to a client workspace's own Teams channel, honouring the
 * workspace's on/off switch and event selection. Every attempt is logged so
 * staff can see whether Teams delivery is actually working.
 */
export async function notifyOrgTeams(args: {
  organizationId: string;
  eventType: string;
  notice: TeamsNotice;
  candidateMatchId?: string | null;
  actions?: TeamsAction[];
}): Promise<{ ok: boolean; reason?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("teams_channel_links")
    .select("team_id, channel_id, enabled, events")
    .eq("organization_id", args.organizationId)
    .maybeSingle();

  if (!link) return { ok: false, reason: "not_connected" };
  if (link.enabled === false) return { ok: false, reason: "disabled" };
  const events = (link.events as string[] | null) ?? [];
  if (events.length > 0 && !events.includes(args.eventType)) {
    return { ok: false, reason: "event_not_selected" };
  }

  let actionsHtml = "";
  if (args.candidateMatchId && (args.actions?.length ?? 0) > 0) {
    const links = await mintActionLinks({
      organizationId: args.organizationId,
      candidateMatchId: args.candidateMatchId,
      actions: args.actions!,
    });
    actionsHtml = renderActions(links);
  }

  const res = await postToTeamsChannel(
    { teamId: link.team_id as string, channelId: link.channel_id as string },
    args.notice,
    actionsHtml,
  );

  await logTeamsDelivery({
    organization_id: args.organizationId,
    event_type: args.eventType,
    status: res.ok ? "delivered" : "failed",
    error_code: res.ok ? null : (res.reason ?? "unknown"),
    error_message: res.ok ? null : (res.detail ?? null),
  });

  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

/** Fire-and-forget variant for use inside notification fan-out. */
export function notifyOrgTeamsSafe(args: Parameters<typeof notifyOrgTeams>[0]): void {
  void notifyOrgTeams(args).catch(() => undefined);
}

