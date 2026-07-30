/**
 * Brand Center — typed asset registry.
 *
 * Filename convention:
 *   {brand-id}_{asset}_{concept-or-variant}_{width}x{height}_v{major}.{minor}.{ext}
 */

import type { Scene } from "./scene";
import * as T from "./templates";
import { ACTIVE_BRAND_ID } from "./detect";

export type AssetStatus = "approved" | "review" | "blocked" | "deprecated";
export type AssetFormat = "png" | "svg" | "ico" | "html";

export type AssetCategory =
  | "logo"
  | "social-linkedin"
  | "social-instagram"
  | "social-other"
  | "campaign"
  | "presentation"
  | "document"
  | "icon"
  | "og";

export interface BrandAsset {
  brandId: string;
  assetId: string;
  name: string;
  category: AssetCategory;
  concept: string;
  system?: T.VisualSystem;
  width: number;
  height: number;
  formats: AssetFormat[];
  version: string;
  status: AssetStatus;
  sourceAssets: string[];
  updatedAt: string;
  notes: string;
  /** Generated assets carry a scene; master files carry a URL. */
  scene?: () => Scene;
  fileUrl?: string;
  fileMime?: string;
}

const BRAND = ACTIVE_BRAND_ID ?? "unknown";
const V = "1.0";
const UPDATED = "2026-07-30";

const MASTER_WORDMARK = "src/assets/brand/logo-on-white.png · logo-on-blue.png (approved masters, unmodified)";
const MASTER_ICON = "src/assets/brand/icon-white.png (approved symbol, unmodified)";

export function assetFilename(asset: BrandAsset, format: AssetFormat): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${BRAND}_${slug(asset.assetId)}_${slug(asset.concept)}_${asset.width}x${asset.height}_v${asset.version}.${format}`;
}

const a = (asset: BrandAsset): BrandAsset => asset;

export const ASSETS: BrandAsset[] = [
  /* ----- logo masters ----- */
  a({
    brandId: BRAND, assetId: "logo-horizontal", name: "Wordmark — light background", category: "logo",
    concept: "on-white", width: 1695, height: 408, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Approved master. Use on white, Paper and Sky backgrounds. Transparent PNG.",
    fileUrl: T.LOGO.light, fileMime: "image/png",
  }),
  a({
    brandId: BRAND, assetId: "logo-horizontal", name: "Wordmark — dark background", category: "logo",
    concept: "on-navy", width: 1694, height: 408, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Approved master. Use on Navy Deep and photography with a dark overlay.",
    fileUrl: T.LOGO.dark, fileMime: "image/png",
  }),
  a({
    brandId: BRAND, assetId: "logo-symbol", name: "Symbol — light on dark", category: "logo",
    concept: "mark-white", width: 1920, height: 1899, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_ICON], updatedAt: UPDATED,
    notes: "Square mark for avatars, favicons and app icons. Transparent PNG.",
    fileUrl: T.LOGO.icon, fileMime: "image/png",
  }),
  a({
    brandId: BRAND, assetId: "logo-vector", name: "Wordmark — vector master (SVG)", category: "logo",
    concept: "svg-master", width: 0, height: 0, formats: ["svg"], version: V, status: "blocked",
    sourceAssets: [], updatedAt: UPDATED,
    notes: "No approved SVG master exists in this project — only raster masters. Blocked rather than redrawn: redrawing the approved mark is out of scope. Request the vector original from the brand owner.",
  }),

  /* ----- LinkedIn ----- */
  a({
    brandId: BRAND, assetId: "linkedin-company", name: "LinkedIn company header — Outcome System", category: "social-linkedin",
    concept: "outcome-system", system: "A", width: 1128, height: 191, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Left logo, brand outcome, right-side pipeline plate. Critical content inside a 24px safe margin.",
    scene: T.linkedinCompanyOutcome,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-company", name: "LinkedIn company header — Operating Model", category: "social-linkedin",
    concept: "operating-model", system: "B", width: 1128, height: 191, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Centred statement over the four-stage labelled process on a dark plate.",
    scene: T.linkedinCompanyOperating,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-company", name: "LinkedIn company header — FGV Connection", category: "social-linkedin",
    concept: "fgv-connection", system: "A", width: 1128, height: 191, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Carries the “An FGV Company” line. Held at review until a signed-off FGV relationship asset is supplied to this project.",
    scene: T.linkedinCompanyFgv,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-personal", name: "LinkedIn personal banner — Executive Statement", category: "social-linkedin",
    concept: "executive-statement", system: "A", width: 1584, height: 396, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Weight sits in the right two-thirds; lower-left kept clear of the profile photo.",
    scene: T.linkedinPersonalExecutive,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-personal", name: "LinkedIn personal banner — System Builder", category: "social-linkedin",
    concept: "system-builder", system: "B", width: 1584, height: 396, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Role-neutral statement plus the labelled operating model.",
    scene: T.linkedinPersonalSystem,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-personal", name: "LinkedIn personal banner — Ecosystem", category: "social-linkedin",
    concept: "ecosystem", system: "A", width: 1584, height: 396, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Includes the FGV relationship line — review status for the same reason as the company header.",
    scene: T.linkedinPersonalEcosystem,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-profile-image", name: "Profile image — symbol on Navy Deep", category: "social-linkedin",
    concept: "dark", width: 400, height: 400, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_ICON], updatedAt: UPDATED,
    notes: "Master square avatar. Preview shows the circular crop safe zone.",
    scene: T.profileImageDark,
  }),
  a({
    brandId: BRAND, assetId: "linkedin-profile-image", name: "Profile image — symbol in Ocean disc", category: "social-linkedin",
    concept: "light", width: 400, height: 400, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_ICON], updatedAt: UPDATED,
    notes: "Light-background variant; the disc keeps the mark legible under circular cropping.",
    scene: T.profileImageLight,
  }),

  /* ----- other networks ----- */
  a({
    brandId: BRAND, assetId: "x-header", name: "X header", category: "social-other",
    concept: "outcome-statement", system: "C", width: 1500, height: 500, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Composition weighted centre-right; left third stays clear of the profile photo.",
    scene: T.xHeader,
  }),
  a({
    brandId: BRAND, assetId: "facebook-cover", name: "Facebook cover", category: "social-other",
    concept: "mobile-safe", system: "A", width: 820, height: 312, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "All essential content inside the mobile-safe centre band.",
    scene: T.facebookCover,
  }),
  a({
    brandId: BRAND, assetId: "youtube-channel-art", name: "YouTube channel art", category: "social-other",
    concept: "safe-area", system: "C", width: 2560, height: 1440, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Logo and statement sit inside the 1546 x 423 TV-safe area; the preview overlays that boundary.",
    scene: T.youtubeArt,
  }),
  a({
    brandId: BRAND, assetId: "open-graph", name: "Open Graph default share image", category: "og",
    concept: "default", system: "A", width: 1200, height: 630, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Readable at feed-thumbnail size. The live site keeps its current /og-image.png until this export is verified and swapped by an owner.",
    scene: T.ogImage,
  }),

  /* ----- Instagram ----- */
  a({
    brandId: BRAND, assetId: "instagram-square", name: "Instagram square — insight", category: "social-instagram",
    concept: "insight", system: "A", width: 1080, height: 1080, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Standalone educational point.", scene: T.igInsight,
  }),
  a({
    brandId: BRAND, assetId: "instagram-square", name: "Instagram square — carousel cover", category: "social-instagram",
    concept: "carousel-cover", system: "C", width: 1080, height: 1080, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Cover slide with swipe affordance.", scene: T.igCarouselCover,
  }),
  a({
    brandId: BRAND, assetId: "instagram-square", name: "Instagram square — announcement", category: "social-instagram",
    concept: "announcement", system: "A", width: 1080, height: 1080, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Company announcement with one action.", scene: T.igAnnouncement,
  }),
  a({
    brandId: BRAND, assetId: "instagram-portrait", name: "Instagram portrait — framework", category: "social-instagram",
    concept: "framework", system: "B", width: 1080, height: 1350, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Four-stage process laid out as numbered rows.", scene: T.igFramework,
  }),
  a({
    brandId: BRAND, assetId: "instagram-portrait", name: "Instagram portrait — service", category: "social-instagram",
    concept: "service", system: "C", width: 1080, height: 1350, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "What the subscription includes.", scene: T.igService,
  }),
  a({
    brandId: BRAND, assetId: "instagram-portrait", name: "Instagram portrait — editorial", category: "social-instagram",
    concept: "editorial", system: "A", width: 1080, height: 1350, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Editorial insight with the evidence motif.", scene: T.igEditorial,
  }),
  a({
    brandId: BRAND, assetId: "instagram-story", name: "Instagram story — announcement", category: "social-instagram",
    concept: "announcement", system: "C", width: 1080, height: 1920, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Top and bottom 250px kept clear of platform UI.", scene: T.storyAnnouncement,
  }),
  a({
    brandId: BRAND, assetId: "instagram-story", name: "Instagram story — question", category: "social-instagram",
    concept: "question", system: "A", width: 1080, height: 1920, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "Reserved sticker area for a poll or question box.", scene: T.storyQuestion,
  }),
  a({
    brandId: BRAND, assetId: "instagram-story", name: "Instagram story — event reminder", category: "social-instagram",
    concept: "event-reminder", system: "C", width: 1080, height: 1920, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Contains editable date/time fields. Review status until the event details are filled in — do not publish as-is.",
    scene: T.storyEventReminder,
  }),

  /* ----- campaign ----- */
  a({
    brandId: BRAND, assetId: "webinar-promo", name: "Webinar / event promotion", category: "campaign",
    concept: "live-session", system: "B", width: 1200, height: 675, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Date and time are editable placeholders — review status until filled.", scene: T.webinarPromo,
  }),
  a({
    brandId: BRAND, assetId: "case-study-cover", name: "Case study cover", category: "campaign",
    concept: "cover", system: "C", width: 1200, height: 1553, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Results fields intentionally empty. No invented client, figure or logo appears.", scene: T.caseStudyCover,
  }),
  a({
    brandId: BRAND, assetId: "case-study-results", name: "Case study results layout", category: "campaign",
    concept: "results", system: "B", width: 1200, height: 1553, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Metric tiles render an em dash until a verified value is supplied.", scene: T.caseStudyResults,
  }),
  a({
    brandId: BRAND, assetId: "quote-card", name: "Quote / insight card", category: "campaign",
    concept: "quote", system: "C", width: 1080, height: 1080, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Sample copy is labelled on the artwork itself. Not an approved published asset.", scene: T.quoteTemplate,
  }),
  a({
    brandId: BRAND, assetId: "hiring-announcement", name: "Hiring announcement", category: "campaign",
    concept: "role-open", system: "A", width: 1200, height: 1200, formats: ["png"], version: V, status: "review",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Role title and details are editable fields — review status until filled.", scene: T.hiringAnnouncement,
  }),
  a({
    brandId: BRAND, assetId: "service-announcement", name: "Service announcement", category: "campaign",
    concept: "subscription", system: "C", width: 1200, height: 1200, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Uses approved positioning and verified URLs only.", scene: T.serviceAnnouncement,
  }),

  /* ----- presentation / documents ----- */
  a({
    brandId: BRAND, assetId: "presentation-title", name: "Presentation title slide (16:9)", category: "presentation",
    concept: "title", system: "C", width: 1920, height: 1080, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Presenter, date and URL line is editable in the deck.", scene: T.presentationTitle,
  }),
  a({
    brandId: BRAND, assetId: "document-cover", name: "Report cover — US Letter", category: "document",
    concept: "us-letter", system: "A", width: 1275, height: 1650, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "8.5 x 11in at 150dpi.", scene: T.docCoverLetter,
  }),
  a({
    brandId: BRAND, assetId: "document-cover", name: "Report cover — A4", category: "document",
    concept: "a4", system: "A", width: 1240, height: 1754, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED, notes: "210 x 297mm at 150dpi.", scene: T.docCoverA4,
  }),

  /* ----- icons ----- */
  ...[32, 180, 192, 512].map((size) =>
    a({
      brandId: BRAND, assetId: "app-icon", name: `App icon ${size}px`, category: "icon",
      concept: size === 32 ? "favicon" : size === 180 ? "apple-touch" : "maskable",
      width: size, height: size, formats: ["png"], version: V, status: "approved",
      sourceAssets: [MASTER_ICON], updatedAt: UPDATED,
      notes: size === 32
        ? "Small-size treatment: symbol only, wordmark is unreadable at this size."
        : "Symbol on Navy Deep with 18% padding for maskable safe area.",
      scene: () => T.appIcon(size),
    }),
  ),

  /* ----- diagrams ----- */
  a({
    brandId: BRAND, assetId: "clear-space", name: "Clear space diagram", category: "logo",
    concept: "clear-space", width: 900, height: 340, formats: ["png"], version: V, status: "approved",
    sourceAssets: [MASTER_WORDMARK], updatedAt: UPDATED,
    notes: "Derived from the approved wordmark; the mark itself is unmodified.", scene: T.clearSpaceDiagram,
  }),
  a({
    brandId: BRAND, assetId: "grid", name: "Layout grid diagram", category: "document",
    concept: "grid", width: 900, height: 340, formats: ["png", "svg"], version: V, status: "approved",
    sourceAssets: ["Design tokens in src/styles/brand-tokens.css"], updatedAt: UPDATED,
    notes: "Vector-safe: contains no raster artwork, so it exports cleanly as SVG.", scene: T.gridDiagram,
  }),
];

export const approvedAssets = () => ASSETS.filter((x) => x.status === "approved");
export const reviewAssets = () => ASSETS.filter((x) => x.status === "review");
export const blockedAssets = () => ASSETS.filter((x) => x.status === "blocked");

export const byCategory = (category: AssetCategory) => ASSETS.filter((x) => x.category === category);

export interface ManifestRow {
  filename: string;
  category: AssetCategory;
  dimensions: string;
  format: AssetFormat;
  concept: string;
  version: string;
  status: AssetStatus;
  updatedAt: string;
  sourceAssets: string;
}

export function buildManifest(assets: BrandAsset[] = ASSETS): ManifestRow[] {
  return assets.flatMap((asset) =>
    asset.formats.map((format) => ({
      filename: asset.status === "blocked" ? "— not produced —" : assetFilename(asset, format),
      category: asset.category,
      dimensions: asset.width && asset.height ? `${asset.width} x ${asset.height}` : "n/a",
      format,
      concept: asset.concept,
      version: asset.version,
      status: asset.status,
      updatedAt: asset.updatedAt,
      sourceAssets: asset.sourceAssets.join("; ") || "none",
    })),
  );
}

export function manifestCsv(rows: ManifestRow[] = buildManifest()): string {
  const head = ["filename", "category", "dimensions", "format", "concept", "version", "status", "updated_at", "source_assets"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    head.join(","),
    ...rows.map((r) =>
      [r.filename, r.category, r.dimensions, r.format, r.concept, r.version, r.status, r.updatedAt, r.sourceAssets]
        .map((v) => escape(String(v)))
        .join(","),
    ),
  ].join("\n");
}
