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
