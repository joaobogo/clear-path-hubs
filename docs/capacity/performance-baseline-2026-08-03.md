# Performance baseline — 3 August 2026

Measurement only. No application code was changed in this pass.

## Method

- Target: **production**, `https://taasflow.com` (the published Cloudflare build). The local
  `vite preview` server cannot boot this project (`Cannot find module dist/server/server.js` —
  the Worker target has no Node preview entry), and dev-server numbers are meaningless for a
  baseline, so all figures come from the live site.
- Tool: Playwright + Chrome DevTools Protocol.
- Throttling: **Slow 4G** — 1.6 Mbps down / 750 Kbps up, 150 ms RTT — plus **4× CPU** slowdown.
- Device: 390 × 844, DPR 2, mobile Pixel 7 user agent, touch enabled, cold cache per page.
- Metrics: `largest-contentful-paint` and `layout-shift` PerformanceObservers (buffered),
  Resource Timing for bytes, live DOM inspection for images, fonts and render-blocking status.
- Each page was loaded, held 6 s, then scrolled to the bottom to trigger any lazy work.
- Structural regression sweep run separately at 1440, 1024, 768, 390 and 360 px.

Single-run figures on a synthetic connection. Treat them as a relative baseline for
before/after comparison, not as field data.

## Headline results (mobile, Slow 4G, 4× CPU)

| Page | LCP | CLS | FCP | TTFB | Load | Transferred | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | **5.11 s** | 0.054 | 5.11 s | 1.94 s | 9.97 s | **1391 KB** | 92 |
| `/industries` | **3.51 s** | 0.053 | 3.51 s | 1.37 s | 9.01 s | 1337 KB | 60 |
| `/industries/healthcare` | **3.59 s** | 0.073 | 3.59 s | 1.43 s | 9.11 s | **1428 KB** | 63 |
| `/jobs` | **9.96 s** | 0.053 | 3.76 s | 1.93 s | 9.22 s | 1325 KB | 50 |
| `/pricing` | **3.39 s** | 0.054 | 3.39 s | 1.50 s | 8.98 s | 1331 KB | 58 |

Against the Core Web Vitals thresholds: CLS is **good** everywhere (all ≤ 0.073, budget 0.1).
LCP is **needs-improvement** on four pages (2.5–4 s) and **poor** on `/` and `/jobs`.
Scrolling added no further layout shift and no further bytes on any page — every page's
full-scroll total equals its initial total.

### LCP element per page

| Page | LCP element | Note |
| --- | --- | --- |
| `/` | `<h1>` (hero headline, Fraunces display face) | Text LCP — gated by JS + webfont, not by an image |
| `/industries` | Hero intro `<p>` | Text LCP |
| `/industries/healthcare` | `industry-healthcare-hero.avif` | Image LCP, `fetchpriority="high"`, 20 KB |
| `/jobs` | `<p class="text-sm text-muted-foreground">` (result-count line) | Renders only after the client job query resolves — hence 9.96 s vs 3.76 s FCP |
| `/pricing` | `<h1>` | Text LCP |

FCP equals LCP on `/`, `/industries` and `/pricing`: nothing paints until the JS bundle
executes, then the whole hero paints at once. This is a hydration/bundle-cost problem, not an
image problem.

## Total transferred bytes by host

Effectively single-origin. Per page: `taasflow.com` 1312–1404 KB, `fonts.googleapis.com`
~1 KB (the CSS file; the font binaries were served from cache-control-shared connections and
did not re-register per page), `assets.calendly.com` <1 KB.

## Ten largest assets

Shared across every measured page (transferred / decoded, both gzip on the wire):

| # | Asset | Transferred | Decoded | Format | Loaded on |
| --- | --- | --- | --- | --- | --- |
| 1 | `assets/content-D1XkF7Ct.js` | **871 KB** | **2.8 MB** | JS | **every page** |
| 2 | `assets/index-DAQEQlPI.js` | 215 KB | 761 KB | JS (entry) | every page |
| 3 | `assets/industries-v2-BDsW9nEE.js` | 66 KB | 251 KB | JS | **every page** |
| 4 | `assets/styles-GJMWW0KW.css` | 39 KB | — | CSS | every page (render-blocking) |
| 5 | `assets/lib-DK1QwOaf.js` | 34 KB | — | JS | `/industries/healthcare` |
| 6 | `assets/industries._slug-RIaAjciM.js` | 30 KB | — | JS | `/industries/healthcare` |
| 7 | `assets/routes-OTI5-yfS.js` | 26 KB | — | JS | `/` |
| 8 | `assets/industry-healthcare-hero-BAeVZZcF.avif` | 20 KB | — | **AVIF**, 390×222 intrinsic, drawn 316×178 | `/industries/healthcare` |
| 9 | `assets/types-KzKBpINs.js` | 13 KB | — | JS | every page |
| 10 | `assets/logo-on-white-C8iGHGr3.webp` | 13 KB | — | **WebP**, 480×116 intrinsic, drawn 132×32 | every page |
| 11 | `assets/markdown-BgxUowo5.js` | 12 KB | — | JS | content pages |
| 12 | `assets/createServerFn-eNGXMLSd.js` | 11 KB | — | JS | every page |
| 13 | `~flock.js` | 8 KB | — | JS (deferred) | every page |

**Images are not the problem. JavaScript is.** On `/`, 1177 KB of the 1391 KB transferred
(85%) is three JS chunks, and 871 KB of that is a single chunk.

### Root cause of the 871 KB chunk

`src/lib/marketing/content.ts` eager-globs the entire scraped content corpus:

```ts
const blogMap = import.meta.glob<ContentEntry>("../../content/blog/*.json", { eager: true, ... });
```

`src/content/blog` alone is **2.6 MB** on disk, plus `content/industries` (229 KB) and
`content/pages` (124 KB). Because the glob is eager, Rollup folds every article into one
`content` chunk, and because 13 routes import from `content.ts` — including `/`, `/pricing`,
`/pilot`, `/case-studies` and `/how-it-works` — every visitor downloads and parses the whole
blog archive to render a landing page. `industries-v2.ts` (173 KB source → 251 KB decoded)
has the same shape: it is imported for types and for `INDUSTRY_ENTRIES` by shared components,
so it ships everywhere too.

## Image loading

| Page | Image | `loading` | `fetchpriority` | Intrinsic | Drawn | Alt |
| --- | --- | --- | --- | --- | --- | --- |
| all | header logo | `eager` | `high` | 480×116 | 132×32 | present |
| all | footer logo (same file, cached) | `lazy` | — | 480×116 | 132×32 | present |
| `/` | 3 advisor headshots | `lazy` | — | not decoded (below fold, never entered viewport) | 56×56 | present |
| `/industries/healthcare` | hero AVIF | `eager` | `high` | 390×222 | 316×178 | present |

Findings: lazy-loading is correctly applied to below-fold images and correctly *not* applied
to the header logo and the healthcare hero. Every image has an alt attribute. The header logo
is served at 480 px intrinsic for a 132×32 CSS box — at DPR 2 it needs 264 px, so it is
roughly 1.8× oversized (13 KB, low absolute cost). The healthcare hero is well sized and
already AVIF via `vite-imagetools`. `/`, `/industries`, `/jobs` and `/pricing` ship **no hero
image at all** — their LCP is text, which is why bundle cost dominates.

## Font loading

- Single stylesheet: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap`
- `display=swap` is set, so text is never invisible; the tradeoff is a swap-in reflow, which is
  part of the 0.053–0.073 CLS seen on every page.
- `preconnect` to both `fonts.googleapis.com` and `fonts.gstatic.com` is present. Good.
- The stylesheet itself is **render-blocking** (confirmed via `renderBlockingStatus`), so the
  critical path is: HTML → Google Fonts CSS (cross-origin, 150 ms RTT) → font binaries →
  first paint of styled text.
- 8 font faces are declared (Inter 400/500/600/700 + Fraunces 400/600 variable). Per page only
  1–2 faces actually reached `loaded` state during measurement — the rest stayed `unloaded`,
  i.e. we declare roughly four weights more than the above-fold render needs.
- No `rel="preload"` on any font binary.

## Render-blocking resources

Exactly two on every page:

1. `assets/styles-GJMWW0KW.css` — 39 KB, first-party, unavoidable and appropriately sized.
2. The Google Fonts stylesheet — cross-origin, adds a full connection + round trip before
   first paint.

All JavaScript is non-blocking: the entry chunk is `async`, `~flock.js` is `defer`, and the
Calendly widget script is `async`. Calendly's `widget.css` is loaded but not render-blocking.

## Correctness observations recorded while measuring

- **Zero console errors** on all five measured pages and on all 50 page/viewport combinations
  of the regression sweep.
- **Zero failed (4xx/5xx) requests** on all five pages. The Apollo pixel 400 seen in earlier
  local runs did not reproduce against production.
- Structural sweep — `/`, `/platform`, `/how-it-works`, `/pricing`, `/industries`, `/jobs`,
  `/intake`, `/contact`, `/pilot`, `/trust` at 1440, 1024, 768, 390 and 360 px: **50/50 pass**
  — HTTP 200, exactly one `h1`, exactly one `main`, header present, footer present, no
  horizontal scroll (`scrollWidth === innerWidth` at every width).
- TTFB is 1.37–1.94 s under 150 ms simulated RTT. Server rendering is a real share of LCP on
  every page and roughly 40–55% of it on the text-LCP pages.

## Ranked fix list — awaiting approval

Ordered by measured impact per unit of risk. **Nothing below has been implemented.**

**1. Stop eager-globbing the blog corpus.** *Est. −800 KB transferred and −2.5 MB parse on
every marketing page.* Split `src/lib/marketing/content.ts` so blog/industry article bodies
load per-slug (drop `eager: true` and resolve the one needed entry, or move body lookup into
the route loader) while the small manifest used for listings stays eager. Highest-impact
change available by a wide margin, and it directly attacks the FCP === LCP plateau on `/`,
`/pricing` and `/industries`. Risk: `/blog`, `/blog/$slug`, `/knowledge-base` and
`/resources` all read this module; needs a route-by-route check that no listing view silently
loses data.

**2. Keep `industries-v2.ts` out of the shared graph.** *Est. −66 KB transferred, −251 KB
parse on every page.* Several shared components import it only for `type IndustryEntry`;
those are free to convert to `import type`. The real work is `INDUSTRY_ENTRIES`, pulled in by
`internal-link-hub` and `industry-explorer`, which appear on non-industry pages. Move the full
entry table behind the industry routes and expose a slim `{slug, name, href}` list for
navigation. Risk: low, mostly mechanical, but touches the internal-link SEO block.

**3. Fix the `/jobs` LCP at 9.96 s.** *Est. LCP 9.96 s → ~3.8 s.* The largest element is the
result-count paragraph, which paints only after the client-side job query resolves. Render the
job list server-side in the route loader (or emit a correctly-sized skeleton whose text
becomes the LCP candidate immediately). This is the single worst page number in the baseline.
Risk: touches data loading on a public route — I would want your explicit go-ahead since it
changes how job data reaches the page.

**4. Self-host Inter and Fraunces, and drop unused weights.** *Est. −1 render-blocking
cross-origin round trip, ~200–400 ms off FCP on every page; also reduces the swap reflow that
makes up most of our CLS.* Serve the two faces from our own origin as `woff2`, subset to
`latin`, preload only the two above-fold faces, keep `font-display: swap`. Cut Inter to the
weights actually rendered above the fold (measurement shows 1–2 of 8 faces load). Risk: needs
a careful visual diff — Google's Fraunces variable axis settings must be reproduced exactly or
headings shift weight.

**5. Reduce the entry chunk (215 KB / 761 KB decoded).** Audit what `index` pulls in that
marketing visitors never use — the build shows `recharts`, `stripe`, `jszip`, `mammoth` and
`unpdf` in the graph. Any of those reachable from the client entry should be dynamically
imported at its point of use. Risk: medium; needs verifying that admin/workspace surfaces
still function after the boundaries move.

**6. Right-size the header logo.** *Est. −6 KB per page.* 480×116 WebP for a 132×32 box;
generate a 264 px variant via the existing `vite-imagetools` pipeline. Trivial, low value —
listed for completeness.

**7. Add a performance regression gate.** Fold these five URLs and the thresholds above into
the existing `docs/capacity/performance-budgets.md` and assert them in CI so the 871 KB chunk
cannot come back silently.

Suggested sequencing: **1 → 2 → 4** first (large, self-contained, no data-flow change), then
decide on **3** and **5** separately since both touch application architecture.

## Risks and limitations of this measurement

- Single run per page; no p75, no field data. Differences under ~10% are noise.
- Production has a warm Cloudflare edge cache for static assets but the HTML is
  server-rendered per request; TTFB may vary more in the field than these numbers suggest.
- `vite preview` is broken for this project, so there is no local like-for-like harness. Any
  before/after comparison must be run against a deployed build using this same script
  (`/tmp/browser/perf/measure.py`) — worth committing under `scripts/` if we iterate.
- Below-fold advisor headshots on `/` never entered the viewport even after a 5000 px scroll,
  so their byte weight and intrinsic dimensions are unmeasured. They are correctly `lazy`.
- Font binary bytes are under-counted: the `fonts.gstatic.com` requests did not appear in
  Resource Timing (opaque cross-origin timing), so the true per-page total is somewhat above
  the figures in the table.
