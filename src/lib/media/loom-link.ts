/**
 * Loom share links — the one place a video link is judged.
 *
 * Only a genuine Loom share link is accepted. Anything else — another video
 * host, a Loom home page, a bare id, a `javascript:` payload — is rejected with
 * a plain sentence a person can act on. The embed address is derived here too,
 * so the player and the validator can never disagree about what will load.
 */

const ALLOWED_HOSTS = new Set(["loom.com", "www.loom.com"]);
/** `/share/<id>` and `/embed/<id>` are the only shapes Loom serves a video on. */
const SHARE_PATH = /^\/(?:share|embed)\/([0-9a-zA-Z]{16,64})$/;

export const LOOM_LINK_HINT =
  "Paste a Loom share link, for example https://www.loom.com/share/your-video-id.";

export type LoomLink = {
  /** The canonical share link, stored and opened. */
  url: string;
  /** The address the in-page player loads. */
  embedUrl: string;
  /** Loom's own id for the recording. */
  id: string;
};

/** A Loom link, or `null` when the text is not one. */
export function parseLoomLink(input: string | null | undefined): LoomLink | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const match = SHARE_PATH.exec(parsed.pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const id = match[1]!;
  return {
    id,
    url: `https://www.loom.com/share/${id}`,
    embedUrl: `https://www.loom.com/embed/${id}`,
  };
}

/** True when the text is a Loom share link. */
export function isLoomLink(input: string | null | undefined): boolean {
  return parseLoomLink(input) !== null;
}

/**
 * Validate for a form: `{ link }` when accepted, `{ error }` when not. Empty
 * text means "no video", which is always allowed — it clears the attachment.
 */
export function validateLoomLink(
  input: string | null | undefined,
): { link: LoomLink | null; error: null } | { link: null; error: string } {
  const raw = String(input ?? "").trim();
  if (!raw) return { link: null, error: null };
  const link = parseLoomLink(raw);
  if (!link) return { link: null, error: `That is not a Loom link. ${LOOM_LINK_HINT}` };
  return { link, error: null };
}
