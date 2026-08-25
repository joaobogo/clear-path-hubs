/**
 * One place decides where a notification row may point.
 *
 * The client workspace must never render an /admin/ URL: those pages list
 * every client's data and a client user cannot open them. Instead of dropping
 * the link (a dead row), we map the admin path onto the client-side page for
 * the same record, using the notification's own entity reference.
 */

export type LinkableNotification = {
  event_type?: string | null;
  link_path: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

const ADMIN_PREFIX = "/admin/";

function clientPathForEntity(n: LinkableNotification): string | null {
  const id = n.entity_id ?? null;
  switch (n.entity_type) {
    case "candidate_match":
      return id ? `/client/candidates/${id}` : "/client/candidates";
    case "position":
      return id ? `/client/positions/${id}` : "/client/roles";
    case "application":
      return "/client/candidates";
    case "organization":
      return "/client/account";
    default:
      return null;
  }
}

/** True when this path must not be rendered inside the client workspace. */
export function isAdminPath(path: string | null | undefined): boolean {
  return !!path && (path === "/admin" || path.startsWith(ADMIN_PREFIX));
}

/**
 * Returns a client-safe path for a notification, or null when nothing safe can
 * be derived (the row then renders without a link).
 */
export function resolveClientNotificationLink(n: LinkableNotification): string | null {
  const path = n.link_path?.trim() || null;
  if (path && !isAdminPath(path)) return path;
  // Admin path (or no path at all): fall back to the client page for the record.
  return clientPathForEntity(n);
}
