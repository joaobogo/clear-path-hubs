/**
 * Google Search Console ownership token — the `content` value of the
 * "HTML tag" verification method (Search Console → Settings → Ownership
 * verification → HTML tag). Rendered by the root route as
 * `<meta name="google-site-verification" content="…">` on every page.
 *
 * Read from VITE_GOOGLE_SITE_VERIFICATION with a committed fallback, the same
 * pattern as the pixel ids in lib/tracking/pixels.ts: the production build
 * does not reliably receive VITE_ variables, so the fallback is what ships.
 * The token is not a secret — it is public in the page source by design.
 *
 * Empty means the tag is not rendered at all. taasflow.com had no
 * verification of any kind (no tag, no DNS TXT, no HTML file), so Search
 * Console could not be tied to the property.
 */
export const GOOGLE_SITE_VERIFICATION: string =
  import.meta.env.VITE_GOOGLE_SITE_VERIFICATION || "";
