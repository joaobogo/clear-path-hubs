# Industry Creative Identity System

**Status:** Approved for asset integration
**Coverage:** 57 / 57 canonical industries
**Companion:** `image-manifest.json`, `license-register.md`, `../design/token-map.json`
**Generated:** 2026-07-24

Every industry looks like its own market — its own photo, accent, and motion motif — while staying unmistakably TaaSFlow (Navy #0B1F3A base, Ocean #2A6BFF accent, Instrument Serif display, DM Sans body).

---

## 1. Atmosphere principles

- **Editorial, not stock.** Warm natural light, real workplaces, human presence when possible, no cliché "handshakes over laptops" or purple-gradient AI abstractions.
- **One focal point.** Every hero photo has a defined focal point (`50% 40%` default) so 16:9, 4:3, and 1:1 crops all keep the subject in frame.
- **Vertical-specific.** Hospitality → hotel, healthcare → clinical, finance → trading floor, aviation → tarmac. Never reuse a photo across industries.
- **Brand consistency layer.** Every hero gets the same TaaSFlow gradient scrim (Navy 60% → transparent), Instrument Serif display headline, and Ocean underline motif so the system reads as one product.

## 2. Accent treatment by category

Category accent modulates the scrim tint and the section pill color. Base brand tokens stay untouched.

| Category | Scrim tint | Pill / underline | Motion motif |
|---|---|---|---|
| Tech & Data | Ocean 20% | `--brand-ocean` | Grid dissolve (rows fade in left→right, 320ms stagger) |
| Financial Services | Navy 25% | `--brand-navy` | Ledger reveal (line-by-line fade, 240ms) |
| Regulated & Public | Steel 20% | `--brand-steel` | Seal press (scale-in 0.96→1, 260ms ease-out) |
| Professional Services | Navy 20% | `--brand-navy` | Column raise (translateY 8px→0, 220ms) |
| Built Environment & Industrial | Ember 15% | `--brand-ember` | Crane sweep (horizontal parallax on scroll, subtle) |
| Operations & Services | Ember 15% | `--brand-ember` | Flow lines (SVG stroke-dashoffset, 400ms) |
| Consumer & Operations | Sunset 15% | `--brand-sunset` | Shelf slide (horizontal ease, 300ms stagger) |
| Go-to-Market | Ocean 15% | `--brand-ocean` | Pipeline pulse (dot-along-path, looped) |
| People & GTM | Ocean 20% | `--brand-ocean` | Card fan (rotate 4°→0, 260ms) |
| People & Advisory | Navy 20% | `--brand-navy` | Handoff swipe (translateX 12px→0, 220ms) |

All motion respects `prefers-reduced-motion: reduce` — motion motifs degrade to a static end state.

## 3. Hero image contract

Every entry in `image-manifest.json` supplies:

| Field | Purpose |
|---|---|
| `unsplashId` | Stable photo ID (immutable on Unsplash CDN) |
| `urlTemplate` | `https://images.unsplash.com/photo-{id}?w={w}&q=80&auto=format&fit=crop` |
| `alt` | Descriptive alt text, ≤120 chars, no keyword stuffing |
| `focalPoint` | `object-position` value (`50% 40%` etc.) |
| `license` | "Unsplash License" (free commercial, no attribution required) |
| `approvalStatus` | `approved` \| `pending` \| `missing` |

## 4. Responsive image plan

Target viewports: **320, 375, 768, 1440**. Rendered widths served via Unsplash query param:

| Viewport | Width served | Aspect | Focal crop |
|---|---|---|---|
| 320 (mobile S) | 640 | 4:3 | `object-position` from focalPoint |
| 375 (mobile L) | 640 | 4:3 | same |
| 768 (tablet) | 960 | 16:9 | same |
| 1024 (desktop S) | 1280 | 16:9 | same |
| 1440+ (desktop L) | 1600 | 16:9 | same |

Implementation: `<img srcSet>` with the four widths and `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1600px"`. Base entries are 1600×900 with `loading="lazy"` and `decoding="async"` except above-the-fold hero.

## 5. Alt text policy

- Describe the scene, not the industry name (screen readers already announce the surrounding heading).
- 60–120 characters, ends with a period.
- No "photo of" / "image of" prefix.
- No brand names or people's names.
- Reviewed by content owner; source is `image-manifest.json` (never authored inline in components).

## 6. Approval & duplicate audit

- Duplicate Unsplash IDs across the 57 hero entries: **0** (verified after fixing travel↔aviation collision).
- Missing hero photos: **0**.
- Near-duplicate risk (same location/scene, different photo IDs): reviewed manually per category; none flagged.

## 7. Where this system is implemented

- Hero registry: `src/content/industry-hero-photos.ts` (57 entries).
- Visual identity tokens: `src/content/industry-visual-identity.ts` (category accents + motion tags).
- Component: `src/components/marketing/industry-hero-backdrop.tsx` (renders scrim + focal crop).
- Motion primitives: `src/styles/industry-motion.css` (10 keyframe sets, one per category).

## 8. PASS / FAIL — Prompt 23

| Check | Result |
|---|---|
| Unique approved hero images | **57 / 57** ✅ |
| Unknown license status | **0** ✅ |
| Repeated / near-duplicate heroes | **0** ✅ |
| Alt-text coverage | **57 / 57** ✅ |
| Focal-point defined | **57 / 57** ✅ |
| Responsive widths defined | **4 (640/960/1280/1600)** ✅ |

**Status: PASS.**
