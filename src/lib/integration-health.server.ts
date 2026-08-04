/**
 * Integration health probes. Server-only.
 *
 * Each probe performs the cheapest read-only call that proves the credential
 * works and the provider is reachable. Nothing here logs or returns a
 * credential — only presence, status codes and provider error text (truncated).
 */

import { DEFAULT_MEETING_TYPE, MEETING_TYPES } from "@/config/booking";

export type IntegrationId = "stripe" | "attio" | "calendly" | "email";

export type CheckStatus = "ok" | "degraded" | "failed" | "not_configured";

export type DetailsMap = Record<
  string,
  string | number | boolean | null | string[] | Record<string, number>
>;

export type CheckResult = {
  integration: IntegrationId;
  status: CheckStatus;
  summary: string;
  error_code: string | null;
  error_detail: string | null;
  remediation: string | null;
  latency_ms: number;
  details: DetailsMap;
};

const TIMEOUT_MS = 12_000;

function truncate(value: unknown, max = 600): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: unknown }> {
  const started = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - started, value };
  } catch (error) {
    return { ms: Date.now() - started, error };
  }
}

function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* ------------------------------------------------------------------ Stripe */

async function checkStripe(): Promise<CheckResult> {
  const base = {
    integration: "stripe" as const,
    error_code: null as string | null,
    error_detail: null as string | null,
    remediation: null as string | null,
    details: {} as DetailsMap,
  };

  const hasLive = Boolean(process.env['STRIPE_LIVE_API_KEY']);
  const hasSandbox = Boolean(process.env['STRIPE_SANDBOX_API_KEY']);
  if (!hasLive && !hasSandbox) {
    return {
      ...base,
      status: "not_configured",
      summary: "No Stripe connection key is present in this environment.",
      remediation: "Enable payments so the Stripe connection key is injected, then re-run the test.",
      latency_ms: 0,
      details: { live_key: false, sandbox_key: false },
    };
  }

  const env = hasLive ? "live" : "sandbox";
  const run = await timed(async () => {
    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(env);
    const products = await stripe.products.list({ limit: 3, active: true });
    const prices = await stripe.prices.list({ limit: 3, active: true });
    return { products: products.data.length, prices: prices.data.length };
  });

  if (run.error) {
    const { getStripeErrorMessage } = await import("@/lib/stripe.server");
    const message = getStripeErrorMessage(run.error);
    return {
      ...base,
      status: "failed",
      summary: `Stripe API call failed in ${env} mode.`,
      error_code: "stripe_api_error",
      error_detail: truncate(message),
      remediation:
        "Check the payments connection is still linked and, for live mode, that go-live is complete. The message above is Stripe's own error — fix the cause it names, then re-run.",
      latency_ms: run.ms,
      details: { environment: env },
    };
  }

  const counts = run.value!;
  const noCatalog = counts.products === 0 || counts.prices === 0;
  return {
    ...base,
    status: noCatalog ? "degraded" : "ok",
    summary: noCatalog
      ? `Stripe reachable in ${env} mode but the catalog looks incomplete (${counts.products} products, ${counts.prices} prices).`
      : `Stripe reachable in ${env} mode with an active catalog.`,
    ...(noCatalog
      ? {
          error_code: "stripe_catalog_empty",
          error_detail: `active products: ${counts.products}, active prices: ${counts.prices}`,
          remediation: "Create the plan products and prices before sending anyone to checkout.",
        }
      : {}),
    latency_ms: run.ms,
    details: { environment: env, ...counts },
  };
}

/* ------------------------------------------------------------------- Attio */

async function checkAttio(): Promise<CheckResult> {
  const base = {
    integration: "attio" as const,
    error_code: null as string | null,
    error_detail: null as string | null,
    remediation: null as string | null,
    details: {} as DetailsMap,
  };

  if (!process.env['ATTIO_API_KEY']) {
    return {
      ...base,
      status: "not_configured",
      summary: "ATTIO_API_KEY is not set, so CRM capture is disabled.",
      remediation: "Add the ATTIO_API_KEY secret to start syncing leads to the CRM.",
      latency_ms: 0,
      details: {},
    };
  }

  const run = await timed(async () => {
    const { attioFetch } = await import("@/lib/crm/attio-client.server");
    const res = await attioFetch<{ data?: { api_slug?: string }[] }>("/objects");
    return (res.data ?? []).map((o) => o.api_slug).filter(Boolean) as string[];
  });

  if (run.error) {
    const err = run.error as { status?: number; message?: string };
    const status = err.status ?? 0;
    return {
      ...base,
      status: "failed",
      summary: "Attio rejected the health probe.",
      error_code: status ? `attio_http_${status}` : "attio_unreachable",
      error_detail: truncate(err.message ?? String(run.error)),
      remediation:
        status === 401 || status === 403
          ? "The Attio token is invalid or missing scopes. Generate a new token with read access to objects and update the ATTIO_API_KEY secret."
          : "Attio was unreachable or returned a server error. Retry; if it persists, check Attio's status page before changing the token.",
      latency_ms: run.ms,
      details: { status },
    };
  }

  const objects = run.value!;
  const required = ["people", "companies", "deals"];
  const missing = required.filter((r) => !objects.includes(r));
  return {
    ...base,
    status: missing.length ? "degraded" : "ok",
    summary: missing.length
      ? `Attio reachable but ${missing.join(", ")} not visible to this token.`
      : `Attio reachable with people, companies and deals available.`,
    ...(missing.length
      ? {
          error_code: "attio_objects_missing",
          error_detail: `missing objects: ${missing.join(", ")}`,
          remediation:
            "Lead sync writes people, companies and deals. Grant the token access to those objects in Attio, then re-run.",
        }
      : {}),
    latency_ms: run.ms,
    details: { objects: objects.slice(0, 20) },
  };
}

/* ---------------------------------------------------------------- Calendly */

const CALENDLY_BOOKING_URL = MEETING_TYPES[DEFAULT_MEETING_TYPE].schedulingUrl;

async function checkCalendly(): Promise<CheckResult> {
  const base = {
    integration: "calendly" as const,
    error_code: null as string | null,
    error_detail: null as string | null,
    remediation: null as string | null,
    details: { booking_url: CALENDLY_BOOKING_URL } as DetailsMap,
  };

  const lovableKey = process.env['LOVABLE_API_KEY'];
  const calendlyKey = process.env['CALENDLY_API_KEY'];

  if (lovableKey && calendlyKey) {
    const run = await timed(async () => {
      const res = await fetchWithTimeout("https://connector-gateway.lovable.dev/calendly/users/me", {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": calendlyKey,
        },
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${truncate(body, 400)}`);
      const parsed = JSON.parse(body) as { resource?: { scheduling_url?: string; email?: string } };
      return parsed.resource ?? {};
    });

    if (run.error) {
      const message = (run.error as Error).message ?? String(run.error);
      return {
        ...base,
        status: "failed",
        summary: "The Calendly connection failed to authenticate.",
        error_code: "calendly_gateway_error",
        error_detail: truncate(message),
        remediation:
          "Reconnect Calendly so a fresh authorisation is stored. Booking links still open the public scheduling page, so bookings are not blocked by this.",
        latency_ms: run.ms,
        details: { ...base.details, mode: "connector" },
      };
    }

    const resource = run.value!;
    return {
      ...base,
      status: "ok",
      summary: "Calendly connection authenticated and the scheduling page resolved.",
      latency_ms: run.ms,
      details: {
        ...base.details,
        mode: "connector",
        scheduling_url: resource.scheduling_url ?? null,
      },
    };
  }

  // No API connection: verify the public scheduling page the widget actually loads.
  const run = await timed(async () => {
    const res = await fetchWithTimeout(CALENDLY_BOOKING_URL, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status;
  });

  if (run.error) {
    return {
      ...base,
      status: "failed",
      summary: "The public Calendly booking page did not load.",
      error_code: "calendly_page_unreachable",
      error_detail: truncate((run.error as Error).message ?? String(run.error)),
      remediation:
        "Every 'Book a call' button points at this URL. Confirm the Calendly event is still published and the slug in src/lib/calendly.ts matches it.",
      latency_ms: run.ms,
      details: { ...base.details, mode: "public_page" },
    };
  }

  return {
    ...base,
    status: "ok",
    summary: "Public Calendly booking page loads (no API connection linked).",
    latency_ms: run.ms,
    details: { ...base.details, mode: "public_page", http_status: run.value ?? null },
  };
}

/* ------------------------------------------------------------------- Email */

async function checkEmail(): Promise<CheckResult> {
  const base = {
    integration: "email" as const,
    error_code: null as string | null,
    error_detail: null as string | null,
    remediation: null as string | null,
    details: {} as DetailsMap,
  };

  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) {
    return {
      ...base,
      status: "not_configured",
      summary: "Email delivery history is unavailable in this environment.",
      remediation: "Re-publish so the platform API key is injected, then re-run the test.",
      latency_ms: 0,
      details: {},
    };
  }

  const run = await timed(async () => {
    const { listEmailLogs } = await import("@lovable.dev/email-js");
    return await listEmailLogs({ limit: 100 }, { apiKey });
  });

  if (run.error) {
    return {
      ...base,
      status: "failed",
      summary: "Could not read email delivery history.",
      error_code: "email_logs_unreachable",
      error_detail: truncate((run.error as Error).message ?? String(run.error)),
      remediation:
        "The mail platform did not respond. Retry in a minute; if it keeps failing, re-publish so the routes and key are current.",
      latency_ms: run.ms,
      details: {},
    };
  }

  const items = ((run.value as { items?: { event_type?: string; status?: string }[] })?.items ??
    []) as { event_type?: string; status?: string }[];
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = item.event_type ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const sent = counts["sent"] ?? 0;
  const bounced = counts["bounced"] ?? 0;
  const complaints = counts["complaint"] ?? 0;
  const suppressed = counts["suppressed"] ?? 0;
  const rateLimited = counts["rate_limited"] ?? 0;
  const rejected = counts["rejected"] ?? 0;

  const problems: string[] = [];
  if (rateLimited > 0) problems.push(`${rateLimited} rate-limited send(s)`);
  if (rejected > 0) problems.push(`${rejected} rejected send(s)`);
  if (bounced > 0) problems.push(`${bounced} bounce(s)`);
  if (complaints > 0) problems.push(`${complaints} complaint(s)`);
  if (suppressed > 0) problems.push(`${suppressed} suppressed send(s)`);

  if (items.length === 0) {
    return {
      ...base,
      status: "degraded",
      summary: "Email service reachable but no send has been recorded yet.",
      error_code: "email_no_history",
      error_detail: "The last 100 events are empty.",
      remediation:
        "Nothing proves delivery yet. Trigger one real notification (for example a receipt) and re-run this test.",
      latency_ms: run.ms,
      details: { counts },
    };
  }

  return {
    ...base,
    status: problems.length ? "degraded" : "ok",
    summary: problems.length
      ? `Email sending works (${sent} recent sends) but with ${problems.join(", ")}.`
      : `Email sending healthy — ${sent} recent sends with no bounces or complaints.`,
    ...(problems.length
      ? {
          error_code: "email_deliverability_signal",
          error_detail: problems.join("; "),
          remediation:
            rateLimited > 0
              ? "Sending is exceeding the hourly allowance. Spread notifications out or reduce batch sizes, then re-check."
              : "Review the affected recipients in the email delivery panel. Bounced and complained addresses stay suppressed by design — do not retry them.",
        }
      : {}),
    latency_ms: run.ms,
    details: { counts },
  };
}

/* ---------------------------------------------------------------- Registry */

export const INTEGRATION_IDS: IntegrationId[] = ["stripe", "attio", "calendly", "email"];

const PROBES: Record<IntegrationId, () => Promise<CheckResult>> = {
  stripe: checkStripe,
  attio: checkAttio,
  calendly: checkCalendly,
  email: checkEmail,
};

export async function runProbes(ids: IntegrationId[]): Promise<CheckResult[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await PROBES[id]();
      } catch (error) {
        return {
          integration: id,
          status: "failed" as const,
          summary: "The health probe itself threw before reaching the provider.",
          error_code: "probe_exception",
          error_detail: truncate((error as Error)?.message ?? String(error)),
          remediation: "This is an app-side failure, not a provider outage. Check the server logs for this route.",
          latency_ms: 0,
          details: {},
        };
      }
    }),
  );
  return results;
}
