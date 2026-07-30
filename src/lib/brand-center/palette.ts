/**
 * Brand Center — resolved palette.
 *
 * The live product themes off CSS custom properties in
 * `src/styles/brand-tokens.css` (OKLCH). Export pipelines (canvas, PNG)
 * cannot resolve `var()`, so this module carries the sRGB resolution of
 * those exact token values. Values are converted from the OKLCH source,
 * not re-picked by hand — if a token changes, re-run the conversion.
 */

export interface BrandColor {
  /** Token name as used in CSS (without the leading `--`). */
  token: string;
  name: string;
  role: string;
  hex: string;
  rgb: [number, number, number];
  /** Source OKLCH declaration, kept for traceability. */
  oklch: string;
  group: "primary" | "secondary" | "status";
}

export const BRAND_COLORS: BrandColor[] = [
  {
    token: "brand-navy-dark",
    name: "Navy Deep",
    role: "Authority surfaces, dark sections, presentation backgrounds",
    hex: "#0C1A34",
    rgb: [12, 26, 52],
    oklch: "oklch(0.22 0.055 262)",
    group: "primary",
  },
  {
    token: "brand-navy",
    name: "Navy",
    role: "Headings on light backgrounds, structural fills",
    hex: "#1C2B47",
    rgb: [28, 43, 71],
    oklch: "oklch(0.29 0.055 262)",
    group: "primary",
  },
  {
    token: "brand-ocean",
    name: "Ocean",
    role: "Primary action fill, diagram accents, focus ring",
    hex: "#297CEF",
    rgb: [41, 124, 239],
    oklch: "oklch(0.60 0.19 258)",
    group: "primary",
  },
  {
    token: "brand-ocean-text",
    name: "Ocean Text",
    role: "Links and accent text on light backgrounds (AA at small sizes)",
    hex: "#0462D3",
    rgb: [4, 98, 211],
    oklch: "oklch(0.52 0.19 258)",
    group: "primary",
  },
  {
    token: "brand-paper",
    name: "Paper",
    role: "Default page background",
    hex: "#F8FAFC",
    rgb: [248, 250, 252],
    oklch: "oklch(0.985 0.003 245)",
    group: "primary",
  },
  {
    token: "brand-ink",
    name: "Ink",
    role: "Body copy on light backgrounds",
    hex: "#0A111F",
    rgb: [10, 17, 31],
    oklch: "oklch(0.18 0.03 262)",
    group: "primary",
  },
  {
    token: "brand-ocean-light",
    name: "Ocean Light",
    role: "Accent on dark surfaces, secondary data series",
    hex: "#5598F9",
    rgb: [85, 152, 249],
    oklch: "oklch(0.68 0.16 258)",
    group: "secondary",
  },
  {
    token: "brand-sky",
    name: "Sky",
    role: "Tinted panels, quiet fills, diagram plates",
    hex: "#DCE6EF",
    rgb: [220, 230, 239],
    oklch: "oklch(0.92 0.017 245)",
    group: "secondary",
  },
  {
    token: "brand-sky-dark",
    name: "Sky Deep",
    role: "Borders on tinted panels, chart gridlines",
    hex: "#CAD6E1",
    rgb: [202, 214, 225],
    oklch: "oklch(0.87 0.020 245)",
    group: "secondary",
  },
  {
    token: "brand-navy-light",
    name: "Navy Mist",
    role: "Muted text on dark surfaces, inactive status",
    hex: "#445574",
    rgb: [68, 85, 116],
    oklch: "oklch(0.45 0.055 262)",
    group: "secondary",
  },
  {
    token: "taas-text-secondary",
    name: "Slate",
    role: "Secondary body copy, captions",
    hex: "#4C5666",
    rgb: [76, 86, 102],
    oklch: "oklch(0.45 0.03 262)",
    group: "secondary",
  },
  {
    token: "taas-border-default",
    name: "Hairline",
    role: "Default 1px borders and separators",
    hex: "#D9DFE4",
    rgb: [217, 223, 228],
    oklch: "oklch(0.90 0.010 247)",
    group: "secondary",
  },
  {
    token: "brand-success",
    name: "Signal Green",
    role: "Confirmed, active, passed states",
    hex: "#269E5F",
    rgb: [38, 158, 95],
    oklch: "oklch(0.62 0.14 155)",
    group: "status",
  },
  {
    token: "brand-warning",
    name: "Signal Amber",
    role: "Waiting on someone, needs attention",
    hex: "#E89D00",
    rgb: [232, 157, 0],
    oklch: "oklch(0.75 0.16 75)",
    group: "status",
  },
  {
    token: "brand-danger",
    name: "Signal Red",
    role: "Blocked, failed, destructive",
    hex: "#DF2225",
    rgb: [223, 34, 37],
    oklch: "oklch(0.58 0.22 27)",
    group: "status",
  },
];

export const color = (token: string): string =>
  BRAND_COLORS.find((c) => c.token === token)?.hex ?? "#0A111F";

/** Convenience aliases used across the export templates. */
export const C = {
  navyDark: color("brand-navy-dark"),
  navy: color("brand-navy"),
  ocean: color("brand-ocean"),
  oceanText: color("brand-ocean-text"),
  oceanLight: color("brand-ocean-light"),
  sky: color("brand-sky"),
  skyDark: color("brand-sky-dark"),
  navyLight: color("brand-navy-light"),
  ink: color("brand-ink"),
  paper: color("brand-paper"),
  slate: color("taas-text-secondary"),
  hairline: color("taas-border-default"),
  success: color("brand-success"),
  warning: color("brand-warning"),
  danger: color("brand-danger"),
  white: "#FFFFFF",
} as const;

/* ---------------------------------------------------------------- *
 * Contrast — computed, never asserted by hand.
 * ---------------------------------------------------------------- */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

export interface ContrastPair {
  label: string;
  foreground: string;
  background: string;
  fgHex: string;
  bgHex: string;
  usage: string;
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { label: "Ink on Paper", foreground: "Ink", background: "Paper", fgHex: C.ink, bgHex: C.paper, usage: "Body copy, default page" },
  { label: "Navy on Paper", foreground: "Navy", background: "Paper", fgHex: C.navy, bgHex: C.paper, usage: "Headings" },
  { label: "Slate on Paper", foreground: "Slate", background: "Paper", fgHex: C.slate, bgHex: C.paper, usage: "Secondary copy, captions" },
  { label: "Ocean Text on Paper", foreground: "Ocean Text", background: "Paper", fgHex: C.oceanText, bgHex: C.paper, usage: "Links, accent text" },
  { label: "Ocean on Paper", foreground: "Ocean", background: "Paper", fgHex: C.ocean, bgHex: C.paper, usage: "Large display accents only" },
  { label: "White on Ocean", foreground: "White", background: "Ocean", fgHex: C.white, bgHex: C.ocean, usage: "Primary button label" },
  { label: "White on Navy Deep", foreground: "White", background: "Navy Deep", fgHex: C.white, bgHex: C.navyDark, usage: "Dark sections, banners" },
  { label: "Sky on Navy Deep", foreground: "Sky", background: "Navy Deep", fgHex: C.sky, bgHex: C.navyDark, usage: "Supporting copy on dark" },
  { label: "Ocean Light on Navy Deep", foreground: "Ocean Light", background: "Navy Deep", fgHex: C.oceanLight, bgHex: C.navyDark, usage: "Accent on dark" },
  { label: "Ink on Sky", foreground: "Ink", background: "Sky", fgHex: C.ink, bgHex: C.sky, usage: "Tinted panels" },
  { label: "White on Signal Green", foreground: "White", background: "Signal Green", fgHex: C.white, bgHex: C.success, usage: "Status chip — large text only" },
  { label: "White on Signal Amber", foreground: "White", background: "Signal Amber", fgHex: C.white, bgHex: C.warning, usage: "Fails — use Ink on Amber instead" },
  { label: "Ink on Signal Amber", foreground: "Ink", background: "Signal Amber", fgHex: C.ink, bgHex: C.warning, usage: "Warning chip label" },
  { label: "White on Signal Red", foreground: "White", background: "Signal Red", fgHex: C.white, bgHex: C.danger, usage: "Destructive button label" },
];

export interface ContrastResult extends ContrastPair {
  ratio: number;
  normalAA: boolean;
  largeAA: boolean;
  normalAAA: boolean;
}

export function evaluateContrast(pair: ContrastPair): ContrastResult {
  const ratio = contrastRatio(pair.fgHex, pair.bgHex);
  return {
    ...pair,
    ratio,
    normalAA: ratio >= 4.5,
    largeAA: ratio >= 3,
    normalAAA: ratio >= 7,
  };
}

export const CONTRAST_RESULTS: ContrastResult[] = CONTRAST_PAIRS.map(evaluateContrast);
