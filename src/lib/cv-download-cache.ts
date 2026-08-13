import { getCandidateCvDownload } from "@/lib/cv-download.functions";

/**
 * Short-lived, in-memory cache for signed CV links.
 *
 * The server issues links that live for 5 minutes, so repeated clicks on the
 * same candidate (download, then preview, then download again) do not need a
 * fresh server round-trip each time. We reuse a cached link until it is close
 * to expiry, then drop it. Nothing is persisted — the cache dies with the tab,
 * and every entry is scoped to the caller's own session because it only ever
 * holds links the server already authorized for them.
 */

export type CvDownloadLink = {
  url: string;
  filename: string;
  mime: string;
  disposition: "attachment" | "inline";
  audience: string;
  expires_at: string;
};

type Entry = { value: CvDownloadLink; expiresAt: number };

/** Stop reusing a link this long before it actually expires. */
export const CACHE_SAFETY_MARGIN_MS = 45_000;
/** Fallback lifetime when the server does not report an expiry. */
export const CACHE_FALLBACK_TTL_MS = 4 * 60_000;

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<CvDownloadLink>>();

export function cvLinkCacheKey(matchId: string, disposition: "attachment" | "inline"): string {
  return `${matchId}::${disposition}`;
}

export function cvLinkExpiryMs(link: CvDownloadLink, now = Date.now()): number {
  const parsed = Date.parse(link.expires_at ?? "");
  const raw = Number.isFinite(parsed) ? parsed : now + CACHE_FALLBACK_TTL_MS;
  return raw - CACHE_SAFETY_MARGIN_MS;
}

/** Drop a candidate's cached links (both dispositions). Used by retries. */
export function invalidateCvLink(matchId: string) {
  for (const d of ["attachment", "inline"] as const) {
    const key = cvLinkCacheKey(matchId, d);
    cache.delete(key);
    inflight.delete(key);
  }
}

export function clearCvLinkCache() {
  cache.clear();
  inflight.clear();
}

/** Cached-if-fresh link read. `fresh: true` always re-asks the server. */
export async function fetchCvDownloadLink(opts: {
  matchId: string;
  disposition: "attachment" | "inline";
  fresh?: boolean;
}): Promise<CvDownloadLink> {
  const { matchId, disposition, fresh } = opts;
  const key = cvLinkCacheKey(matchId, disposition);
  if (fresh) invalidateCvLink(matchId);

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) cache.delete(key);

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = (await getCandidateCvDownload({
      data: { matchId, disposition },
    })) as CvDownloadLink;
    cache.set(key, { value: res, expiresAt: cvLinkExpiryMs(res) });
    return res;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
