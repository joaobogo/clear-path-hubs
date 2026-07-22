# Public Asset Inventory — TaaSFlow V2 Migration

Read-only reference of brand and content assets discovered on the source site.
**No signed URLs, no Supabase Storage URLs, no expiring CDN tokens are recorded.**
Only stable HTTPS origins on `taasflow.com` / `sourcing-suite-ai.lovable.app` are eligible.

## Brand assets already staged in the destination repo

| Asset | Source origin | Destination | Decision |
|---|---|---|---|
| Wordmark logo | `https://taasflow.com/logo.svg` (public) | `public/logo.svg` | MIGRATE |
| Favicon (PNG) | scraped from source `<link rel=icon>` | `public/favicon.png` | MIGRATE (default `favicon.ico` deleted) |
| Social share image | `https://taasflow.com/og-image.png` | `public/og-image.png` | MIGRATE — referenced from `__root.tsx` |
| Founder / team portraits | source `<img>` in `/about` | `public/founders/*.jpg` | MIGRATE — verify likeness rights before publish |

## Design tokens (from source computed styles + Firecrawl-style branding capture)

| Token | Value | Source | Notes |
|---|---|---|---|
| Primary | teal / brand green (approx `#0EA47A`) | source header CTA | Verify exact hex with Firecrawl `branding` scrape before finalizing tokens |
| Background | near-white (`#FFFFFF`) with subtle gradient sections | source hero | Match |
| Text primary | slate 900 | source body | Match |
| Heading font | geometric sans (Inter / similar) | source `font-family` | Confirm before licensing |
| Body font | Inter | source | Match |
| Border radius | ~12px (cards, buttons) | source cards | Match |
| Spacing base | 8px | source | Match |

Recommended follow-up: run Firecrawl `formats: ['branding']` against `https://taasflow.com/` and drop the response under `docs/migration/source-branding.json` to lock the palette.

## Header / Footer / Nav

| Element | Source | Destination | Decision |
|---|---|---|---|
| Desktop header | `<header>` on `/` | `src/components/marketing/site-shell.tsx` (already built) | MIGRATE — verify links |
| Mobile nav | source hamburger | in `site-shell.tsx` | MIGRATE |
| Footer | source `<footer>` | `site-shell.tsx` | MIGRATE — verify company address / legal links |
| Social links | LinkedIn (source footer) | footer | VERIFY — do not copy unless confirmed live |

## In-page images referenced by scraped content (top 40)

Recorded from `content/**/*.json` markdown extraction. Each is a stable HTTPS URL, not a signed URL.

- `https://taasflow.com/og-image.png` (referenced 42x)
- `https://taasflow.com/blog/ai-recruitment.jpg` (referenced 9x)
- `https://taasflow.com/blog/remote-hiring.jpg` (referenced 8x)
- `https://taasflow.com/blog/sales-hiring.jpg` (referenced 7x)
- `https://taasflow.com/blog/candidate-experience.jpg` (referenced 6x)
- `https://taasflow.com/blog/saas-hiring.jpg` (referenced 5x)
- `https://taasflow.com/blog/skills-hiring.jpg` (referenced 5x)
- `https://taasflow.com/assets/christian-9Ad2XECQ.jpg` (referenced 4x)
- `https://taasflow.com/assets/joao-BvCqv2_l.jpg` (referenced 4x)
- `https://taasflow.com/blog/talent-pipeline.jpg` (referenced 4x)
- `https://taasflow.com/blog/compensation.jpg` (referenced 4x)
- `https://taasflow.com/blog/cost-per-hire.jpg` (referenced 3x)
- `https://taasflow.com/blog/onboarding.jpg` (referenced 3x)
- `https://taasflow.com/blog/interview-process.jpg` (referenced 3x)
- `https://taasflow.com/assets/public-sector-BKXoE7Wi.jpg` (referenced 3x)
- `https://taasflow.com/assets/tech-CUH6a1PL.jpg` (referenced 3x)
- `https://taasflow.com/assets/legal-CgBdG8e-.jpg` (referenced 3x)
- `https://taasflow.com/assets/finance-bU6FMx8g.jpg` (referenced 3x)
- `https://taasflow.com/assets/sales-B_YOEenq.jpg` (referenced 3x)
- `https://taasflow.com/assets/staffing-agencies-BqziRiMB.jpg` (referenced 3x)
- `https://taasflow.com/assets/healthcare-zBwovZK5.jpg` (referenced 3x)
- `https://taasflow.com/assets/accounting-BCD-M3vD.jpg` (referenced 3x)
- `https://taasflow.com/assets/ecommerce-BZMk-1ga.jpg` (referenced 3x)
- `https://taasflow.com/assets/marketing-BgkI0U6F.jpg` (referenced 3x)
- `https://taasflow.com/assets/human-resources-CXMcZvTZ.jpg` (referenced 3x)
- `https://taasflow.com/assets/media-BSeqk3mG.jpg` (referenced 3x)
- `https://taasflow.com/assets/construction-BKo7PaLF.jpg` (referenced 3x)
- `https://taasflow.com/assets/real-estate-Dpu59h1G.jpg` (referenced 3x)
- `https://taasflow.com/assets/insurance-B6J_8kEs.jpg` (referenced 3x)
- `https://taasflow.com/assets/saas-Cn_QGyNU.jpg` (referenced 3x)
- `https://taasflow.com/assets/hospitality-DdGxwA11.jpg` (referenced 3x)
- `https://taasflow.com/assets/nonprofit-CBDceX8B.jpg` (referenced 3x)
- `https://taasflow.com/assets/data-analytics-QVoH5lCt.jpg` (referenced 3x)
- `https://taasflow.com/assets/private-equity-DUuUs_k6.jpg` (referenced 3x)
- `https://taasflow.com/assets/consulting-BJHEQnFp.jpg` (referenced 3x)
- `https://taasflow.com/blog/tech-hiring.jpg` (referenced 2x)
- `https://taasflow.com/blog/healthcare-hiring.jpg` (referenced 2x)
- `https://taasflow.com/blog/talent-sourcing.jpg` (referenced 2x)
- `https://taasflow.com/blog/reduce-time-to-hire.jpg` (referenced 2x)
- `https://taasflow.com/blog/construction-hiring.jpg` (referenced 2x)


## Assets explicitly excluded

- Any URL under `*.supabase.co/storage/v1/object/sign/...` — expiring signed URL.
- Any URL under `pub-*.r2.dev/...` prefixed with a preview-slug hash — Lovable preview screenshots, not brand assets.
- Any image hosted on the legacy dashboard subdomains.

## Decision key

MIGRATE — copy into destination `public/` or reference by stable URL.
VERIFY — needs owner/legal sign-off before publish.
EXCLUDE — not eligible; do not fetch.
