/**
 * Authenticated RPC bridge for the demo seeder.
 *
 * Every state change in the funnel stage goes through the product's own
 * server functions, called over HTTP exactly the way the browser calls them:
 * `POST /_serverFn/<id>` with the actor's Supabase bearer token attached.
 * Nothing is written straight to the tables the functions own.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const BASE = process.env.SEED_APP_ORIGIN ?? "http://localhost:8080";

/** Server-function id: the same base64 envelope the client bundle emits. */
function fnId(file: string, exportName: string): string {
  return Buffer.from(
    JSON.stringify({
      file: `/src/lib/${file}?tss-serverfn-split`,
      export: `${exportName}_createServerFn_handler`,
    }),
  ).toString("base64");
}

export type Actor = { userId: string; email: string; token: string };

/** Mint a real session for an existing user, without touching their password. */
export async function mintActor(sb: AnyRow, userId: string): Promise<Actor> {
  const { createClient } = await import("@supabase/supabase-js");
  const { data, error } = await sb.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    throw new Error(`cannot mint session for ${userId}: ${error?.message ?? "no email"}`);
  }
  const email = data.user.email as string;
  const link = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`generateLink failed for ${email}: ${link.error.message}`);
  const anon = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.session) {
    throw new Error(`verifyOtp failed for ${email}: ${verified.error?.message}`);
  }
  return { userId, email, token: verified.data.session.access_token };
}

export type CallOpts = { method?: "GET" | "POST" };

export async function callFn<T = unknown>(
  actor: Actor,
  file: string,
  exportName: string,
  data?: unknown,
  opts: CallOpts = {},
): Promise<T> {
  const method = opts.method ?? "POST";
  const headers: Record<string, string> = {
    authorization: `Bearer ${actor.token}`,
    "x-tsr-serverFn": "true",
  };
  let url = `${BASE}/_serverFn/${fnId(file, exportName)}`;
  const init: RequestInit = { method, headers };
  if (method === "GET") {
    if (data !== undefined) url += `?payload=${encodeURIComponent(JSON.stringify({ data }))}`;
  } else {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify({ data: data ?? {} });
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (res.status >= 400) {
    throw new Error(`${exportName} → ${res.status}: ${text.slice(0, 500)}`);
  }
  let parsed: AnyRow;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
  // Seroval envelope from the server-function handler: { result | error }.
  const payload = parsed?.p?.v?.[0] ?? parsed;
  if (parsed?.p?.k?.includes("error") && parsed.p.v[1]) {
    throw new Error(`${exportName} returned an error: ${JSON.stringify(parsed.p.v[1]).slice(0, 300)}`);
  }
  return (payload ?? parsed) as T;
}
