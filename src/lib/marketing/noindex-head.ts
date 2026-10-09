import { marketingHead } from "@/lib/marketing/head";

/**
 * `marketingHead` plus `robots: noindex, follow`, for public pages that exist
 * for visitors who already know where to look but should not rank in search.
 */
export function noindexMarketingHead(...args: Parameters<typeof marketingHead>) {
  const head = marketingHead(...args);
  return {
    ...head,
    meta: [...head.meta, { name: "robots", content: "noindex, follow" }],
  };
}
