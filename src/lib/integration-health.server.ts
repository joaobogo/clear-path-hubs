/**
 * Integration health probes. Server-only.
 *
 * Each probe performs the cheapest read-only call that proves the credential
 * works and the provider is reachable. Nothing here logs or returns a
 * credential — only presence, status codes and provider error text (truncated).
 */

export type IntegrationId = "stripe" | "attio" | "email";

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
      summary: "No payments connection key is present in this environment.",
      remediation: "Enable payments so the connection key is injected, then re-run the test.",
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
      summary: `Payments API call failed in ${env} mode.`,
      error_code: "payments_api_error",
      error_detail: truncate(message),
      remediation:
        "Check the payments connection is still linked and, for live mode, that go-live is complete. The message above is the provider's own error — fix the cause it names, then re-run.",
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
      ? `Payments reachable in ${env} mode but the catalog looks incomplete (${counts.products} products, ${counts.prices} prices).`
      : `Payments reachable in ${env} mode with an active catalog.`,
    ...(noCatalog
      ? {
          error_code: "payments_catalog_empty",
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

  // `.items` does not exist on ListEmailLogsResponse — it is `.data`
  // (@lovable.dev/email-js/dist/index.d.ts). Reading `items` made this array
  // permanently empty, so the empty-history branch below always fired and the
  // probe could never report the provider's own counts. Harmless while the
  // Notifications tile also read the ledger; the moment that tile reads the
  // provider log, this probe would say "no send has been recorded yet" beside
  // a tile saying 30 (audit TF-A-027). Not optional alongside the edits above.
  const items = ((run.value as { data?: { event_type?: string; status?: string }[] })?.data ??
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
    // The provider's recent-event feed being empty does not mean nothing was
    // sent: our own delivery ledger is what the Notifications panel counts.
    // Read the same 7-day window it uses so the two panels cannot contradict
    // each other ("no email sent yet" against "Emails sent 35").
    let ledgerSent = 0;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { count } = await supabaseAdmin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("channel", "email")
        .gte("created_at", since)
        .in("status", ["provider_accepted", "delivered"]);
      ledgerSent = count ?? 0;
    } catch {
      ledgerSent = 0;
    }

    if (ledgerSent > 0) {
      return {
        ...base,
        status: "degraded",
        summary: `${ledgerSent} email send${ledgerSent === 1 ? "" : "s"} recorded in the last 7 days, but the provider returned no recent events.`,
        error_code: "email_history_empty",
        error_detail: "Our delivery ledger has sends; the provider's last 100 events are empty.",
        remediation:
          "Sends are being accepted but the provider is not reporting them back. Re-run the test in a few minutes; if it stays empty, check the sender domain configuration.",
        latency_ms: run.ms,
        details: { counts, ledger_sent_7d: ledgerSent },
      };
    }

    return {
      ...base,
      status: "degraded",
      summary: "Email service reachable but no send has been recorded yet.",
      error_code: "email_no_history",
      error_detail: "The last 100 events are empty, and our delivery ledger has none either.",
      remediation:
        "Nothing proves delivery yet. Trigger one real notification (for example a receipt) and re-run this test.",
      latency_ms: run.ms,
      details: { counts, ledger_sent_7d: 0 },
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

export const INTEGRATION_IDS: IntegrationId[] = ["stripe", "attio", "email"];

const PROBES: Record<IntegrationId, () => Promise<CheckResult>> = {
  stripe: checkStripe,
  attio: checkAttio,
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
