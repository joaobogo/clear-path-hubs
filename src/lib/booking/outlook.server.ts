/**
 * Outlook / Microsoft 365 calendar sync — server only, always non-blocking.
 *
 * What this does when Graph credentials are present:
 *   - creates a real event on the host's Outlook calendar per booking
 *   - invites the booker and turns on a Teams online meeting
 *   - returns the Teams join link so booking_sessions.join_url is real
 *   - reads the host's busy times so we never offer a conflicting slot
 *
 * With no credentials configured, every function here returns a "skipped"
 * result and the native scheduler carries on unchanged. Nothing is faked: no
 * invented join URL, no pretend event id.
 *
 * Auth is the app-only client-credentials flow, which needs these four secrets:
 *   MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET,
 *   MS_GRAPH_HOST_USER
 * plus the application permissions Calendars.ReadWrite and
 * OnlineMeetings.ReadWrite (admin-consented) on the Entra app registration.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  hostUser: string;
};

export const REQUIRED_GRAPH_SECRETS = [
  "MS_GRAPH_TENANT_ID",
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
  "MS_GRAPH_HOST_USER",
] as const;

/** Config when every secret is present, else the names that are missing. */
export function readGraphConfig():
  | { configured: true; config: GraphConfig }
  | { configured: false; missing: string[] } {
  const values = {
    tenantId: process.env["MS_GRAPH_TENANT_ID"] ?? "",
    clientId: process.env["MS_GRAPH_CLIENT_ID"] ?? "",
    clientSecret: process.env["MS_GRAPH_CLIENT_SECRET"] ?? "",
    hostUser: process.env["MS_GRAPH_HOST_USER"] ?? "",
  };
  const missing = REQUIRED_GRAPH_SECRETS.filter((name) => {
    const key = {
      MS_GRAPH_TENANT_ID: "tenantId",
      MS_GRAPH_CLIENT_ID: "clientId",
      MS_GRAPH_CLIENT_SECRET: "clientSecret",
      MS_GRAPH_HOST_USER: "hostUser",
    }[name] as keyof GraphConfig;
    return values[key].trim().length === 0;
  });
  if (missing.length > 0) return { configured: false, missing: [...missing] };
  return { configured: true, config: values };
}

export function graphConfigured(): boolean {
  return readGraphConfig().configured;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(config: GraphConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`graph_token_failed [${res.status}]: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + Math.max(60, json.expires_in) * 1000,
  };
  return tokenCache.token;
}

async function graphFetch(
  config: GraphConfig,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = await accessToken(config);
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    // Surface Graph's own status and body — it names the real failure
    // (missing permission, mailbox not found, invalid attendee).
    throw new Error(`graph_request_failed [${res.status}] ${path}: ${text.slice(0, 500)}`);
  }
  return text.length > 0 ? JSON.parse(text) : null;
}

function hostPath(config: GraphConfig, suffix: string): string {
  return `/users/${encodeURIComponent(config.hostUser)}${suffix}`;
}

/* ------------------------------------------------------------ busy times -- */

export type BusyInterval = { start: string; end: string };

/**
 * The host's busy intervals from Outlook between two instants.
 * Returns [] when Graph isn't configured, so availability is never blocked by
 * an integration the owner hasn't set up yet.
 */
export async function fetchHostBusy(fromIso: string, toIso: string): Promise<BusyInterval[]> {
  const cfg = readGraphConfig();
  if (!cfg.configured) return [];

  try {
    const payload = {
      schedules: [cfg.config.hostUser],
      startTime: { dateTime: fromIso.replace("Z", ""), timeZone: "UTC" },
      endTime: { dateTime: toIso.replace("Z", ""), timeZone: "UTC" },
      availabilityViewInterval: 30,
    };
    const json = (await graphFetch(cfg.config, hostPath(cfg.config, "/calendar/getSchedule"), {
      method: "POST",
      body: JSON.stringify(payload),
    })) as {
      value?: Array<{
        scheduleItems?: Array<{
          status?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
        }>;
      }>;
    };

    const items = json.value?.[0]?.scheduleItems ?? [];
    return items
      .filter((item) => item.status !== "free" && item.status !== "unknown")
      .map((item) => ({
        start: toIsoUtc(item.start?.dateTime),
        end: toIsoUtc(item.end?.dateTime),
      }))
      .filter((interval) => interval.start !== "" && interval.end !== "");
  } catch (err) {
    // A busy-time read failure must not empty the calendar.
    console.error("[booking] outlook busy read failed", err);
    return [];
  }
}

/** Graph returns naive local-as-UTC strings; normalise to a real ISO instant. */
function toIsoUtc(value: string | undefined): string {
  if (!value) return "";
  const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(withZone);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

/* ---------------------------------------------------------------- events -- */

export type EventInput = {
  subject: string;
  bodyHtml: string;
  startIso: string;
  endIso: string;
  attendeeEmail: string;
  attendeeName: string;
};

export type EventResult =
  | { status: "skipped"; missing: string[] }
  | { status: "ok"; eventId: string; joinUrl: string | null }
  | { status: "error"; error: string };

function eventPayload(input: EventInput) {
  return {
    subject: input.subject,
    body: { contentType: "HTML", content: input.bodyHtml },
    start: { dateTime: input.startIso, timeZone: "UTC" },
    end: { dateTime: input.endIso, timeZone: "UTC" },
    attendees: [
      {
        emailAddress: { address: input.attendeeEmail, name: input.attendeeName },
        type: "required",
      },
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: false,
  };
}

/** Creates the Outlook event with a Teams link. Never throws. */
export async function createBookingEvent(input: EventInput): Promise<EventResult> {
  const cfg = readGraphConfig();
  if (!cfg.configured) return { status: "skipped", missing: cfg.missing };
  try {
    const json = (await graphFetch(cfg.config, hostPath(cfg.config, "/events"), {
      method: "POST",
      body: JSON.stringify(eventPayload(input)),
    })) as { id?: string; onlineMeeting?: { joinUrl?: string } | null };
    if (!json?.id) return { status: "error", error: "graph_event_missing_id" };
    return { status: "ok", eventId: json.id, joinUrl: json.onlineMeeting?.joinUrl ?? null };
  } catch (err) {
    return { status: "error", error: (err as Error).message };
  }
}

/** Moves an existing event (reschedule). Never throws. */
export async function updateBookingEvent(
  eventId: string,
  input: EventInput,
): Promise<EventResult> {
  const cfg = readGraphConfig();
  if (!cfg.configured) return { status: "skipped", missing: cfg.missing };
  try {
    const json = (await graphFetch(
      cfg.config,
      hostPath(cfg.config, `/events/${encodeURIComponent(eventId)}`),
      { method: "PATCH", body: JSON.stringify(eventPayload(input)) },
    )) as { id?: string; onlineMeeting?: { joinUrl?: string } | null };
    return {
      status: "ok",
      eventId: json?.id ?? eventId,
      joinUrl: json?.onlineMeeting?.joinUrl ?? null,
    };
  } catch (err) {
    return { status: "error", error: (err as Error).message };
  }
}

/** Cancels the event, which also notifies the attendee. Never throws. */
export async function cancelBookingEvent(
  eventId: string,
  comment: string,
): Promise<{ status: "skipped" | "ok" | "error"; error?: string }> {
  const cfg = readGraphConfig();
  if (!cfg.configured) return { status: "skipped" };
  try {
    await graphFetch(cfg.config, hostPath(cfg.config, `/events/${encodeURIComponent(eventId)}/cancel`), {
      method: "POST",
      body: JSON.stringify({ Comment: comment }),
    });
    return { status: "ok" };
  } catch (err) {
    return { status: "error", error: (err as Error).message };
  }
}
