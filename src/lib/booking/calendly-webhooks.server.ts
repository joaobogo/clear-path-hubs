/**
 * Calendly webhook subscription management. Server-only.
 *
 * Calendly only pushes booking facts to us if a webhook subscription exists for
 * the host's organisation. This module provisions and inspects that
 * subscription through the Lovable connector gateway, using the signing key we
 * hold in CALENDLY_WEBHOOK_SIGNING_KEY so the receiving route can verify every
 * delivery.
 *
 * Nothing here returns a credential: the signing key is written to Calendly and
 * never read back or logged.
 */

import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";

const GATEWAY = "https://connector-gateway.lovable.dev/calendly";

/** The only path Calendly should ever call. */
export const CALENDLY_WEBHOOK_PATH = "/api/public/booking/calendly-webhook";

/** Events our receiver understands (see the webhook route). */
export const CALENDLY_WEBHOOK_EVENTS = ["invitee.created", "invitee.canceled"] as const;

export function calendlyWebhookUrl(): string {
  const configured = process.env["CALENDLY_WEBHOOK_URL"]?.trim();
  if (configured) return configured;
  return `${CANONICAL_ORIGIN}${CALENDLY_WEBHOOK_PATH}`;
}

type GatewayCall = {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
};

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; detail: string };

async function callCalendly<T>({
  path,
  method = "GET",
  query,
  body,
}: GatewayCall): Promise<GatewayResult<T>> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["CALENDLY_API_KEY"];
  if (!lovableKey || !connectionKey) {
    return {
      ok: false,
      status: 0,
      detail: "The Calendly connection is not linked to this project.",
    };
  }

  const url = new URL(`${GATEWAY}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`calendly gateway ${method} ${path} failed [${response.status}]: ${text}`);
    return { ok: false, status: response.status, detail: text.slice(0, 800) };
  }
  return { ok: true, data: (text ? JSON.parse(text) : null) as T };
}

type CalendlyUser = {
  resource: { uri: string; current_organization: string; name: string; email: string };
};

export type CalendlyOwner = { userUri: string; organizationUri: string; name: string };

export async function resolveCalendlyOwner(): Promise<GatewayResult<CalendlyOwner>> {
  const me = await callCalendly<CalendlyUser>({ path: "/users/me" });
  if (!me.ok) return me;
  return {
    ok: true,
    data: {
      userUri: me.data.resource.uri,
      organizationUri: me.data.resource.current_organization,
      name: me.data.resource.name,
    },
  };
}

export type CalendlySubscription = {
  uri: string;
  callback_url: string;
  created_at: string;
  retry_started_at: string | null;
  state: string;
  events: string[];
  scope: string;
};

type SubscriptionList = { collection: CalendlySubscription[] };

export async function listWebhookSubscriptions(
  owner: CalendlyOwner,
): Promise<GatewayResult<CalendlySubscription[]>> {
  const result = await callCalendly<SubscriptionList>({
    path: "/webhook_subscriptions",
    query: {
      count: "50",
      scope: "user",
      organization: owner.organizationUri,
      user: owner.userUri,
    },
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data.collection ?? [] };
}

/**
 * Creates the subscription for our receiver, signed with the stored key. Any
 * pre-existing subscription pointing at the same URL is removed first so the
 * signing key on Calendly's side always matches ours.
 */
export async function ensureWebhookSubscription(
  owner: CalendlyOwner,
): Promise<GatewayResult<{ subscription: CalendlySubscription; replaced: number }>> {
  const signingKey = process.env["CALENDLY_WEBHOOK_SIGNING_KEY"];
  if (!signingKey) {
    return {
      ok: false,
      status: 0,
      detail:
        "CALENDLY_WEBHOOK_SIGNING_KEY is not configured, so deliveries could not be verified.",
    };
  }

  const url = calendlyWebhookUrl();
  const existing = await listWebhookSubscriptions(owner);
  if (!existing.ok) return existing;

  let replaced = 0;
  for (const sub of existing.data.filter((s) => s.callback_url === url)) {
    const id = sub.uri.split("/").pop();
    if (!id) continue;
    const deleted = await callCalendly({ path: `/webhook_subscriptions/${id}`, method: "DELETE" });
    if (deleted.ok) replaced += 1;
  }

  const created = await callCalendly<{ resource: CalendlySubscription }>({
    path: "/webhook_subscriptions",
    method: "POST",
    body: {
      url,
      events: [...CALENDLY_WEBHOOK_EVENTS],
      organization: owner.organizationUri,
      user: owner.userUri,
      scope: "user",
      signing_key: signingKey,
    },
  });
  if (!created.ok) return created;
  return { ok: true, data: { subscription: created.data.resource, replaced } };
}

export async function deleteWebhookSubscription(uri: string): Promise<GatewayResult<null>> {
  const id = uri.split("/").pop();
  if (!id) return { ok: false, status: 0, detail: "Invalid subscription reference." };
  return await callCalendly<null>({ path: `/webhook_subscriptions/${id}`, method: "DELETE" });
}
