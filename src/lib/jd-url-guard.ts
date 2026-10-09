/**
 * Which links the job-description importer may fetch.
 *
 * The importer fetches a URL an unauthenticated visitor typed, from our server.
 * Without a guard that is a server-side request forgery: "read the link"
 * pointed at http://169.254.169.254/ (cloud metadata), http://localhost:5432
 * or an internal hostname would make OUR server fetch it. So:
 *
 *  - http(s) only, default ports only, no user:password@ in the URL;
 *  - no loopback, private, link-local, CGNAT, multicast or reserved IP
 *    literals, in any spelling the URL parser accepts (decimal, hex, short
 *    forms and IPv4-mapped IPv6 all normalise to dotted quads first);
 *  - no single-label, .local, .internal, .localhost, metadata or .arpa hosts;
 *  - every redirect hop is checked again (see `fetchPublicPage`).
 *
 * A hostname that RESOLVES to a private address cannot be checked here (the
 * edge runtime has no DNS API); the edge fetch itself cannot reach private
 * networks, and the size, time and hop caps bound what a hostile public host
 * can do.
 */

export type UrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_HOST_SUFFIX = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".arpa", ".home.arpa"];
const BLOCKED_HOSTS = new Set([
  "localhost", "metadata", "metadata.google.internal", "metadata.goog", "instance-data", "kubernetes.default",
  "kubernetes.default.svc",
]);

function ipv4Blocked(a: number, b: number, c: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number) as [number, number, number, number];
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

function ipv6Blocked(raw: string): boolean {
  const h = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  // IPv4-mapped / -compatible / NAT64: judge the embedded IPv4 address.
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]!);
    return !v4 || ipv4Blocked(v4[0], v4[1], v4[2]);
  }
  const mapped = /^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mapped) {
    const hi = parseInt(mapped[1]!, 16);
    const lo = parseInt(mapped[2]!, 16);
    return ipv4Blocked(hi >> 8, hi & 255, lo >> 8);
  }
  const first = parseInt(h.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (h.startsWith("2001:db8") || h.startsWith("100::")) return true;
  return false;
}

export function checkPublicUrl(input: string | URL): UrlVerdict {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input.trim()) : new URL(input.toString());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "protocol" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host) return { ok: false, reason: "host" };
  if (host.startsWith("[") || host.includes(":")) {
    return ipv6Blocked(host) ? { ok: false, reason: "private_ip" } : { ok: true, url };
  }
  const v4 = parseIpv4(host);
  if (v4) return ipv4Blocked(v4[0], v4[1], v4[2]) ? { ok: false, reason: "private_ip" } : { ok: true, url };
  // A numeric-looking host the parser did not normalise is not a hostname we trust.
  if (/^[\d.x]+$/i.test(host)) return { ok: false, reason: "host" };
  if (!host.includes(".")) return { ok: false, reason: "single_label" };
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIX.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "internal_host" };
  }
  return { ok: true, url };
}

export type FetchPageResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: "blocked" | "http_error" | "not_html" | "too_many_redirects" | "timeout" | "network" };

/**
 * Fetches a public page under hard caps: every redirect hop re-checked, at most
 * `maxRedirects` hops, `maxBytes` read (then the stream is cancelled), and one
 * deadline for the whole exchange.
 */
export async function fetchPublicPage(
  start: string,
  opts: { maxBytes: number; timeoutMs: number; maxRedirects?: number; fetchImpl?: typeof fetch },
): Promise<FetchPageResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    let current = start;
    for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop += 1) {
      const verdict = checkPublicUrl(current);
      if (!verdict.ok) return { ok: false, reason: "blocked" };
      const res = await doFetch(verdict.url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "TaaSFlowBot/1.0 (+https://taasflow.com)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!loc) return { ok: false, reason: "http_error" };
        current = new URL(loc, verdict.url).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, reason: "http_error" };
      }
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (type && !/text\/html|application\/xhtml|text\/plain|application\/ld\+json/.test(type)) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, reason: "not_html" };
      }
      const html = await readCapped(res, opts.maxBytes);
      return { ok: true, html, finalUrl: verdict.url.toString() };
    }
    return { ok: false, reason: "too_many_redirects" };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const room = maxBytes - total;
    chunks.push(value.byteLength > room ? value.subarray(0, room) : value);
    total += Math.min(value.byteLength, room);
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}
