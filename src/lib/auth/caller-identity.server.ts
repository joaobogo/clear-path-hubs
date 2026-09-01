// Best-effort identity of the caller on an otherwise public server function.
// Returns null when the request is anonymous. Never throws: a public path must
// keep working for signed-out visitors.
export async function getCallerEmail(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length);
    if (token.split(".").length !== 3) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
    if (error) return null;
    const user = data?.user;
    // Only a confirmed address proves ownership.
    if (!user?.email || !user?.email_confirmed_at) return null;
    return String(user.email).trim().toLowerCase();
  } catch {
    return null;
  }
}
