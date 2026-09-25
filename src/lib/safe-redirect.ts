/**
 * Post-authentication redirect safety.
 *
 * The `?redirect=` search param is attacker-controllable (it lands in the URL
 * whenever the auth gate bounces someone to /login). Anything that is not a
 * plain, same-origin, single-slash path must be discarded, otherwise the sign-in
 * page becomes an open redirect that phishing can bounce through.
 *
 * Rejected, specifically:
 *   //evil.com            protocol-relative — the browser treats it as absolute
 *   /\evil.com            back-slash variant that some parsers normalise to //
 *   https://evil.com      absolute URL
 *   javascript:...        scheme injection
 *   /login, /auth         would bounce straight back and loop
 */

const LOOPING_PATHS = ["/login", "/auth", "/reset-password", "/access-denied", "/unauthorized"];

export function sanitizeRedirect(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  // Must be a rooted path, and only ONE leading slash.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // No scheme, no control characters, no whitespace smuggling.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  // Reject anything that parses to a different origin.
  let path: string;
  try {
    const url = new URL(value, "https://taasflow.invalid");
    if (url.origin !== "https://taasflow.invalid") return null;
    path = url.pathname + url.search + url.hash;
  } catch {
    return null;
  }

  // Never send the user back into an auth page — that is how loops start.
  const base = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (LOOPING_PATHS.includes(base)) return null;

  return path;
}

type RedirectRole =
  | "platform_admin"
  | "operations"
  | "client_admin"
  | "client_editor"
  | "client_viewer"
  | "candidate"
  | null;

/** Ignore a safe but stale destination when the signed-in role cannot open it. */
export function sanitizeRedirectForRole(value: unknown, role: RedirectRole): string | null {
  const path = sanitizeRedirect(value);
  if (!path) return null;

  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "platform_admin" || role === "operations" ? path : null;
  }
  if (pathname === "/client" || pathname.startsWith("/client/")) {
    return role === "client_admin" || role === "client_editor" || role === "client_viewer"
      ? path
      : null;
  }
  if (pathname === "/me" || pathname.startsWith("/me/")) {
    return role === "candidate" ? path : null;
  }

  return path;
}
