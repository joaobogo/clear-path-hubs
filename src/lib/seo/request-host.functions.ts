import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { isIndexableHost } from "@/lib/seo/edge-policy";

/**
 * Whether the host serving this document may be indexed. Called from the root
 * route loader so the server-rendered HTML carries `robots: noindex, nofollow`
 * on preview hosts. `src/start.ts` also sends `X-Robots-Tag` for the same hosts.
 */
export const getHostIndexability = createServerFn({ method: "GET" }).handler(async () => {
  let host: string | undefined;
  try {
    // `x-forwarded-host` is client-controlled, so only the Host header counts.
    host = getRequestHeader("host") ?? undefined;
  } catch {
    host = undefined;
  }
  return { indexable: isIndexableHost(host) };
});
