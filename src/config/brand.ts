/**
 * TaaSFlow Brand — Single Source of Truth
 * ---------------------------------------
 * All logos, OG assets, semantic color names, typography stacks, and
 * layout constants live here. Components import from `@/config/brand`
 * instead of hard-coding paths or hex values.
 *
 * Color values map to CSS custom properties defined in
 * `src/styles/brand-tokens.css`. Do not duplicate colors here; use
 * the tokens so light/dark switching works.
 */

import logoOnWhite from "@/assets/brand/logo-on-white.png";
import logoOnBlue from "@/assets/brand/logo-on-blue.png";
import iconWhite from "@/assets/brand/icon-white.png";

export const brand = {
  name: "TaaSFlow",
  tagline: "Talent as a Service",
  productDomain: "clear-path-hubs.lovable.app",

  logos: {
    /** Full wordmark for use on white / light backgrounds */
    primary: logoOnWhite,
    /** Alias — light background variant */
    light: logoOnWhite,
    /** Full wordmark for use on dark / navy backgrounds */
    dark: logoOnBlue,
    /** Icon-only mark for tight spaces (mobile nav, favicons, app icons) */
    icon: iconWhite,
  },

  meta: {
    /** Static Open Graph share image at /og-image.png */
    ogImage: "/og-image.png",
    /** Favicon at /favicon.png (32x32 png) with .ico fallback */
    favicon: "/favicon.png",
    faviconIco: "/favicon.ico",
  },

  /** Semantic color references — resolve to CSS vars in brand-tokens.css */
  colors: {
    navy:        "var(--brand-navy)",
    navyLight:   "var(--brand-navy-light)",
    navyDark:    "var(--brand-navy-dark)",
    ocean:       "var(--brand-ocean)",
    oceanLight:  "var(--brand-ocean-light)",
    sky:         "var(--brand-sky)",
    skyDark:     "var(--brand-sky-dark)",
    ink:         "var(--brand-ink)",
    paper:       "var(--brand-paper)",
    success:     "var(--brand-success)",
    warning:     "var(--brand-warning)",
    danger:      "var(--brand-danger)",
    info:        "var(--brand-info)",
  },

  typography: {
    sansStack:    "var(--brand-font-sans)",
    displayStack: "var(--brand-font-display)",
    monoStack:    "var(--brand-font-mono)",
    /** Body/heading scale (px) — mobile-first; use with responsive prefixes */
    scale: {
      display:  { size: 52, line: 1.04, tracking: "-0.025em", weight: 600 },
      h1:       { size: 40, line: 1.08, tracking: "-0.022em", weight: 600 },
      h2:       { size: 30, line: 1.15, tracking: "-0.018em", weight: 600 },
      h3:       { size: 22, line: 1.25, tracking: "-0.01em",  weight: 600 },
      h4:       { size: 18, line: 1.30, tracking: "-0.005em", weight: 600 },
      bodyLg:   { size: 18, line: 1.60, tracking: "-0.005em", weight: 400 },
      body:     { size: 16, line: 1.60, tracking: "-0.005em", weight: 400 },
      bodySm:   { size: 14, line: 1.55, tracking:  "0",       weight: 400 },
      meta:     { size: 12, line: 1.50, tracking: "0.02em",   weight: 500 },
      eyebrow:  { size: 11, line: 1.20, tracking: "0.12em",   weight: 600 },
    },
  },

  /** Buttons — hierarchy order matters (primary before secondary before ghost) */
  buttons: {
    primary:   { role: "Primary CTA",          usage: "One per screen; the single decision the visitor should make." },
    secondary: { role: "Secondary action",     usage: "Alternate path (learn more, view demo). Never duplicates primary." },
    tertiary:  { role: "Tertiary / ghost",     usage: "In-line actions inside cards, tables, filters." },
    link:      { role: "Text link",            usage: "Inline navigation inside prose." },
    danger:    { role: "Destructive",          usage: "Delete / revoke; always confirmed." },
  },

  links: {
    color:            "var(--brand-ocean)",
    hoverColor:       "var(--brand-navy)",
    visitedColor:     "var(--brand-navy-light)",
    underline:        "underline decoration-1 underline-offset-2",
    focusRing:        "var(--brand-focus-ring)",
  },

  icons: {
    library: "lucide-react",
    strokeWidth: 1.75,
    /** Sizes (px) allowed in UI — pick nearest, never freeform */
    sizes: [12, 14, 16, 18, 20, 24, 28, 32] as const,
  },

  radii: {
    xs: "var(--brand-radius-xs)",
    sm: "var(--brand-radius-sm)",
    md: "var(--brand-radius-md)",
    lg: "var(--brand-radius-lg)",
    xl: "var(--brand-radius-xl)",
    "2xl": "var(--brand-radius-2xl)",
    pill: "var(--brand-radius-pill)",
  },

  shadows: {
    xs:  "var(--brand-shadow-xs)",
    sm:  "var(--brand-shadow-sm)",
    md:  "var(--brand-shadow-md)",
    lg:  "var(--brand-shadow-lg)",
    xl:  "var(--brand-shadow-xl)",
    glow:"var(--brand-shadow-glow)",
  },

  spacing: {
    scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const,
    section: {
      sm: "var(--brand-section-y-sm)",
      md: "var(--brand-section-y-md)",
      lg: "var(--brand-section-y-lg)",
      xl: "var(--brand-section-y-xl)",
    },
  },

  layout: {
    publicMaxWidth:    "var(--brand-public-width)",
    workspaceMaxWidth: "var(--brand-workspace-width)",
    proseMaxWidth:     "var(--brand-prose-width)",
    gutter:            "var(--brand-space-5)",
  },

  focus: {
    ring:      "var(--brand-focus-ring)",
    ringInset: "var(--brand-focus-ring-inset)",
    minTargetPx: 44, // WCAG 2.5.5 target
  },

  status: {
    active:   "var(--brand-success)",
    pending:  "var(--brand-warning)",
    error:    "var(--brand-danger)",
    info:     "var(--brand-info)",
    inactive: "var(--brand-navy-light)",
  },
} as const;

export type Brand = typeof brand;
export default brand;
