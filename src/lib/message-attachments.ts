/**
 * Attachment rules for client-visible message threads.
 *
 * Deliberately narrow: documents a hiring conversation actually needs. Anything
 * else is rejected with a sentence a client can act on, never a bare "invalid
 * file".
 */

export const MAX_MESSAGE_CHARS = 4000;
export const MIN_MESSAGE_CHARS = 1;

/** 10 MB — big enough for a scanned contract, small enough to send by email. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

type AllowedType = { ext: string; mime: string[]; label: string };

export const ALLOWED_ATTACHMENT_TYPES: AllowedType[] = [
  { ext: "pdf", mime: ["application/pdf"], label: "PDF" },
  {
    ext: "docx",
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    label: "Word",
  },
  { ext: "doc", mime: ["application/msword"], label: "Word" },
  {
    ext: "xlsx",
    mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    label: "Excel",
  },
  { ext: "xls", mime: ["application/vnd.ms-excel"], label: "Excel" },
  {
    ext: "pptx",
    mime: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    label: "PowerPoint",
  },
  { ext: "csv", mime: ["text/csv", "application/csv"], label: "CSV" },
  { ext: "txt", mime: ["text/plain"], label: "Text" },
];

/** Human list for the composer hint and rejection messages. */
export const ALLOWED_ATTACHMENT_HINT = "PDF, Word, Excel, PowerPoint, CSV or plain text, up to 10 MB each";

export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.map((t) => `.${t.ext}`).join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export function typeFor(name: string): AllowedType | null {
  const ext = extensionOf(name);
  return ALLOWED_ATTACHMENT_TYPES.find((t) => t.ext === ext) ?? null;
}

export type MessageAttachment = {
  path: string;
  name: string;
  mime: string;
  size: number;
};

export type AttachmentCheck =
  | { ok: true; type: AllowedType }
  | { ok: false; error: string };

/**
 * One file, checked by extension, declared type and size. The message names the
 * file so a client with three attachments knows which one failed.
 */
export function checkAttachment(file: { name: string; size: number; type?: string }): AttachmentCheck {
  const name = file.name.trim();
  if (name.length === 0) return { ok: false, error: "That file has no name — rename it and try again." };
  if (name.length > 200) {
    return { ok: false, error: `"${name.slice(0, 40)}…" has too long a file name. Shorten it to 200 characters.` };
  }

  const type = typeFor(name);
  if (!type) {
    return {
      ok: false,
      error: `${name} is not a document type we accept. Send ${ALLOWED_ATTACHMENT_HINT}.`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: `${name} is empty. Check the file and try again.` };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `${name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)} per file.`,
    };
  }

  // A declared MIME type that contradicts the extension is a rename, not a doc.
  if (file.type && file.type !== "application/octet-stream" && !type.mime.includes(file.type)) {
    return {
      ok: false,
      error: `${name} does not look like a ${type.label} file. Re-export it and try again.`,
    };
  }

  return { ok: true, type };
}

export function checkAttachments(files: Array<{ name: string; size: number; type?: string }>): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    errors.push(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to one message.`);
  }
  for (const f of files.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    const res = checkAttachment(f);
    if (!res.ok) errors.push(res.error);
  }
  return { ok: errors.length === 0, errors };
}

/** Message body rules, shared by the composer and the server. */
export function checkMessageBody(
  body: string,
  hasAttachments = false,
): { ok: true; body: string } | { ok: false; error: string } {
  const trimmed = body.trim();
  if (trimmed.length < MIN_MESSAGE_CHARS) {
    return {
      ok: false,
      error: hasAttachments
        ? "Add a line about what you are sending before it goes out."
        : "Write a message before sending.",
    };
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      error: `That message is ${trimmed.length.toLocaleString()} characters. The limit is ${MAX_MESSAGE_CHARS.toLocaleString()}.`,
    };
  }
  return { ok: true, body: trimmed };
}

/** Storage bucket holding message attachments. Private; access is server-mediated. */
export const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";

/** Deterministic, org-scoped object path. */
export function attachmentPath(orgId: string, conversationId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `${orgId}/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}
