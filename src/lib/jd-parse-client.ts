/**
 * The browser side of the model read: one request at a time, a hard deadline,
 * one retry for a transient failure, and a session cache so the same
 * description is never billed twice.
 *
 * - Abortable: the wizard passes a signal and aborts when a newer description
 *   replaces this one; an aborted read resolves `{ kind: "aborted" }` and is
 *   never applied.
 * - Deadline: `timeoutMs` (25 s) for the whole read. A read that runs out of
 *   time is not retried — the second attempt would run out too.
 * - Retry: once, after a network error or a 5xx, which are the failures a
 *   second try fixes.
 * - Cache: successful reads are kept in sessionStorage by a hash of the
 *   normalised description (or the file's fingerprint / the link), so Back,
 *   Forward, a re-render or a draft restore re-applies them for free. Failures
 *   are never cached. Storage that throws (private mode, quota) is ignored.
 */
import type { JdBlueprint } from "@/lib/jd-blueprint";
import type { RequirementItem } from "@/lib/express-intake-schema";
import { normalizeJdText } from "@/lib/jd-quick-read";

export const JD_PARSE_TIMEOUT_MS = 25_000;
const CACHE_PREFIX = "jdread:v1:";
const CACHE_INDEX = "jdread:v1:index";
const CACHE_MAX = 12;

export type JdParseBody = {
  roleTitle: string;
  jobDescriptionText?: string;
  file?: { filename: string; mime: string; base64: string };
  url?: string;
};

export type JdParseSuccess = {
  ok: true;
  suggestions: RequirementItem[];
  blueprint: JdBlueprint;
  source?: "text" | "file" | "url";
  text?: string;
};

export type JdParseOutcome =
  | { kind: "ok"; data: JdParseSuccess; cached: boolean }
  | { kind: "failed"; error: string; message?: string; text?: string }
  | { kind: "aborted" };

/** 53-bit FNV-1a style hash, fast enough for a 30k description on every change. */
export function hashText(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** What makes two reads the same read. Formatting-only edits share a key. */
export function jdCacheKey(body: JdParseBody): string {
  const title = body.roleTitle.trim().toLowerCase();
  if (body.file) {
    const b = body.file.base64;
    // A fingerprint, not a full hash: name, size and both ends of the bytes.
    return `file:${hashText(`${body.file.filename}|${b.length}|${b.slice(0, 65_536)}|${b.slice(-65_536)}`)}:${hashText(title)}`;
  }
  if (body.url) return `url:${hashText(body.url.trim())}:${hashText(title)}`;
  const norm = normalizeJdText(body.jobDescriptionText ?? "").replace(/\s+/g, " ").toLowerCase();
  return `text:${hashText(norm)}:${hashText(title)}`;
}

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readCachedJdParse(key: string): JdParseSuccess | null {
  try {
    const raw = store()?.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as JdParseSuccess;
    return v && v.ok === true ? v : null;
  } catch {
    return null;
  }
}

export function writeCachedJdParse(key: string, value: JdParseSuccess): void {
  const s = store();
  if (!s) return;
  try {
    const index = (JSON.parse(s.getItem(CACHE_INDEX) ?? "[]") as string[]).filter((k) => k !== key);
    index.push(key);
    while (index.length > CACHE_MAX) {
      const old = index.shift();
      if (old) s.removeItem(CACHE_PREFIX + old);
    }
    // A file read carries its extracted text; that is the client's own document,
    // kept only in this tab's session storage.
    s.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    s.setItem(CACHE_INDEX, JSON.stringify(index));
  } catch {
    /* quota or privacy mode: the cache is an optimisation, never a requirement */
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Runs the read. Resolves; never rejects. `fetchImpl` and `sleep` are injectable
 * so the retry and deadline rules are tested without a network.
 */
export async function requestJdParse(
  body: JdParseBody,
  opts: {
    signal?: AbortSignal;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    retryDelayMs?: number;
    useCache?: boolean;
  } = {},
): Promise<JdParseOutcome> {
  const key = jdCacheKey(body);
  if (opts.useCache !== false) {
    const hit = readCachedJdParse(key);
    if (hit) return { kind: "ok", data: hit, cached: true };
  }
  const doFetch: FetchLike = opts.fetchImpl ?? ((i, init) => fetch(i, init));
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), opts.timeoutMs ?? JD_PARSE_TIMEOUT_MS);
  const onAbort = () => deadline.abort();
  opts.signal?.addEventListener("abort", onAbort);
  let lastText: string | undefined;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (opts.signal?.aborted) return { kind: "aborted" };
      let res: Response;
      try {
        res = await doFetch("/api/public/jd-requirements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleTitle: body.roleTitle,
            jobDescriptionText: body.jobDescriptionText ?? "",
            file: body.file,
            url: body.url,
          }),
          signal: deadline.signal,
        });
      } catch {
        if (opts.signal?.aborted) return { kind: "aborted" };
        if (deadline.signal.aborted) return { kind: "failed", error: "timeout", text: lastText };
        if (attempt === 0) {
          await wait(opts.retryDelayMs ?? 400, deadline.signal);
          continue;
        }
        return { kind: "failed", error: "network", text: lastText };
      }
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        if (opts.signal?.aborted) return { kind: "aborted" };
        if (deadline.signal.aborted) return { kind: "failed", error: "timeout", text: lastText };
      }
      if (opts.signal?.aborted) return { kind: "aborted" };
      if (typeof json["text"] === "string") lastText = json["text"] as string;
      if (json["ok"] === true) {
        const data: JdParseSuccess = {
          ok: true,
          suggestions: Array.isArray(json["suggestions"]) ? (json["suggestions"] as RequirementItem[]) : [],
          blueprint: (json["blueprint"] as JdBlueprint) ?? {},
          source: json["source"] as JdParseSuccess["source"],
          text: lastText,
        };
        writeCachedJdParse(key, data);
        return { kind: "ok", data, cached: false };
      }
      if (res.status >= 500 && attempt === 0) {
        await wait(opts.retryDelayMs ?? 400, deadline.signal);
        continue;
      }
      return {
        kind: "failed",
        error: typeof json["error"] === "string" ? (json["error"] as string) : `http_${res.status}`,
        message: typeof json["message"] === "string" ? (json["message"] as string) : undefined,
        text: lastText,
      };
    }
    return { kind: "failed", error: "unknown", text: lastText };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
