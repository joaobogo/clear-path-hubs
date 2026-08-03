/**
 * Search Console submission for the generated sitemap.
 *
 * Calls run through the Lovable connector gateway with the workspace's
 * Search Console connection. Staff-only: the connection speaks for the whole
 * property, so it must never be reachable by clients or candidates.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BASE_URL, SITEMAP_URL } from "@/lib/seo/index-config";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

type SiteEntry = { siteUrl: string; permissionLevel?: string };

function gatewayHeaders() {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) return null;
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
}

async function requireStaff(supabase: {
  rpc: (fn: "is_platform_staff", args: { _user: string }) => PromiseLike<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

/** True when a verified property covers the canonical marketing origin. */
function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

async function listVerifiedProperties(headers: Record<string, string>) {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
  if (!res.ok) {
    throw new Error(`Could not list properties [${res.status}]: ${await res.text()}`);
  }
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(BASE_URL);
  return siteEntry
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target))
    .map((e) => e.siteUrl);
}

/**
 * What the admin screen needs before it can offer the button: the sitemap URL
 * we would submit, whether a connection exists, and which properties match.
 */
export const getSitemapSubmissionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const headers = gatewayHeaders();
    if (!headers) {
      return {
        sitemapUrl: SITEMAP_URL,
        connected: false as const,
        candidates: [] as string[],
        error: null as string | null,
      };
    }
    try {
      const candidates = await listVerifiedProperties(headers);
      return { sitemapUrl: SITEMAP_URL, connected: true as const, candidates, error: null };
    } catch (err) {
      return {
        sitemapUrl: SITEMAP_URL,
        connected: true as const,
        candidates: [] as string[],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

/**
 * One-click submit. Re-lists verified properties and only accepts a siteUrl
 * that is still an exact member of that response.
 */
export const submitSitemapToSearchConsole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteUrl?: string }) =>
    z.object({ siteUrl: z.string().min(1).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const headers = gatewayHeaders();
    if (!headers) {
      return {
        status: "not_connected" as const,
        message: "No Search Console connection is linked to this project yet.",
      };
    }

    const candidates = await listVerifiedProperties(headers);
    if (candidates.length === 0) {
      return {
        status: "no_property" as const,
        message: `No verified Search Console property covers ${BASE_URL}.`,
      };
    }
    if (!data.siteUrl && candidates.length > 1) {
      return { status: "selection_required" as const, candidates };
    }
    const siteUrl = data.siteUrl ?? candidates[0]!;
    if (!candidates.includes(siteUrl)) {
      return {
        status: "invalid_property" as const,
        message: "That property is no longer verified for this site.",
      };
    }

    const path = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(path, { method: "PUT", headers });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Sitemap submission failed [${res.status}]: ${body}`);
      return {
        status: "failed" as const,
        message: `Search Console rejected the submission [${res.status}]: ${body}`,
      };
    }
    return { status: "submitted" as const, siteUrl, sitemapUrl: SITEMAP_URL };
  });
