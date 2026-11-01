/**
 * Candidate video links — the one place a video link is judged.
 *
 * Two hosts are accepted: a Loom share link, and a Google Drive file link
 * (added 1 Nov 2026: candidates send Drive videos). Anything else — another
 * host, a Loom home page, a Drive folder, a bare id, a `javascript:` payload —
 * is rejected with a plain sentence a person can act on. The embed address is
 * derived here too, so the player and the validator can never disagree about
 * what will load. A Drive video only plays for the client when the file is
 * shared as "Anyone with the link".
 *
 * The module keeps its Loom-era name and exports so existing callers stay put.
 */

const LOOM_HOSTS = new Set(["loom.com", "www.loom.com"]);
/** `/share/<id>` and `/embed/<id>` are the only shapes Loom serves a video on. */
const LOOM_PATH = /^\/(?:share|embed)\/([0-9a-zA-Z]{16,64})$/;

const DRIVE_HOSTS = new Set(["drive.google.com"]);
const DRIVE_ID = /^[0-9A-Za-z_-]{20,100}$/;
/** `/file/d/<id>`, optionally followed by `/view`, `/preview` or `/edit`. */
const DRIVE_FILE_PATH = /^\/file\/d\/([0-9A-Za-z_-]{20,100})(?:\/(?:view|preview|edit))?$/;

export const LOOM_LINK_HINT =
  "Paste a Loom or Google Drive video link, for example https://www.loom.com/share/your-video-id or https://drive.google.com/file/d/your-file-id/view.";

export type VideoProvider = "loom" | "drive";

export type LoomLink = {
  /** The canonical share link, stored and opened. */
  url: string;
  /** The address the in-page player loads. */
  embedUrl: string;
  /** The host's own id for the recording. */
  id: string;
  provider: VideoProvider;
};

function toUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

function parseLoom(parsed: URL): LoomLink | null {
  if (!LOOM_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const match = LOOM_PATH.exec(parsed.pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const id = match[1]!;
  return {
    id,
    provider: "loom",
    url: `https://www.loom.com/share/${id}`,
    embedUrl: `https://www.loom.com/embed/${id}`,
  };
}

function parseDrive(parsed: URL): LoomLink | null {
  if (!DRIVE_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const path = parsed.pathname.replace(/\/+$/, "");
  let id: string | null = DRIVE_FILE_PATH.exec(path)?.[1] ?? null;
  if (!id && (path === "/open" || path === "/uc")) {
    const q = parsed.searchParams.get("id");
    id = q && DRIVE_ID.test(q) ? q : null;
  }
  if (!id) return null;
  return {
    id,
    provider: "drive",
    url: `https://drive.google.com/file/d/${id}/view`,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
  };
}

/** A Loom or Google Drive video link, or `null` when the text is not one. */
export function parseLoomLink(input: string | null | undefined): LoomLink | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const parsed = toUrl(raw);
  if (!parsed) return null;
  return parseLoom(parsed) ?? parseDrive(parsed);
}

/** Same as parseLoomLink; the provider-neutral name for new callers. */
export const parseVideoLink = parseLoomLink;

/** True when the text is an accepted video link. */
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
  if (!link) return { link: null, error: `That is not a Loom or Google Drive video link. ${LOOM_LINK_HINT}` };
  return { link, error: null };
}
