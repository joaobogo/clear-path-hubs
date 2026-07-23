/**
 * Per-industry visual identity for landing-page hero backdrops.
 *
 * Every one of the 57 canonical industries maps to:
 *   - `gradient`  : a tailwind `from-... via-... to-...` gradient string
 *   - `accent`    : tailwind text-color class used for the SVG pattern tint
 *   - `pattern`   : one of the 10 pattern kinds rendered by
 *                   `industry-hero-backdrop.tsx`
 *
 * The industry template falls back to this identity when there is no
 * bespoke hero image, so every industry landing page has a distinctive,
 * on-brand visual header without needing 57 photo/render generations.
 */

export type IndustryPattern =
  | "circuit"
  | "grid"
  | "waves"
  | "hex"
  | "columns"
  | "gears"
  | "leaves"
  | "dots"
  | "bars"
  | "molecule"
  | "windows"
  | "chart";

export type IndustryVisualIdentity = {
  gradient: string;
  accent: string;
  pattern: IndustryPattern;
};

const V: Record<string, IndustryVisualIdentity> = {
  // ── Tech / software family ─────────────────────────────────────────────
  "tech":            { gradient: "from-[#1a1440] via-[#3b2e8c] to-[#7c5cff]", accent: "text-[#b8a6ff]", pattern: "circuit" },
  "saas":            { gradient: "from-[#0b1e3f] via-[#1f4b8a] to-[#4c86d6]", accent: "text-[#a8c9ee]", pattern: "grid" },
  "data-analytics":  { gradient: "from-[#0a1b2f] via-[#134063] to-[#3aa0d1]", accent: "text-[#8fd0ea]", pattern: "chart" },
  "cybersecurity":   { gradient: "from-[#050914] via-[#111a3d] to-[#2c3e7a]", accent: "text-[#7f8fd6]", pattern: "hex" },
  "ai-ml":           { gradient: "from-[#160b3a] via-[#3d1f7a] to-[#a06fe8]", accent: "text-[#d6bfff]", pattern: "molecule" },
  "devops":          { gradient: "from-[#0d1a25] via-[#1e3a52] to-[#3e7ba0]", accent: "text-[#9dc5db]", pattern: "circuit" },
  "gaming":          { gradient: "from-[#2a0a3a] via-[#6a1b7a] to-[#e94eb8]", accent: "text-[#ffb3e0]", pattern: "hex" },
  "web3":            { gradient: "from-[#1a0930] via-[#4a1b7a] to-[#8b3ee8]", accent: "text-[#c9a6ff]", pattern: "hex" },
  "design":          { gradient: "from-[#3a1b3d] via-[#7a2d6b] to-[#e07aa8]", accent: "text-[#f7c9dd]", pattern: "dots" },
  "product-management": { gradient: "from-[#1a2540] via-[#3b4e85] to-[#7891d0]", accent: "text-[#bdc9ea]", pattern: "grid" },

  // ── Finance / capital family ───────────────────────────────────────────
  "finance":            { gradient: "from-[#0b2740] via-[#144670] to-[#2b7fb8]", accent: "text-[#7dc5ef]", pattern: "chart" },
  "accounting":         { gradient: "from-[#0f2a3d] via-[#1e4a5f] to-[#3d7a95]", accent: "text-[#9dc5d6]", pattern: "grid" },
  "insurance":          { gradient: "from-[#0a1e3d] via-[#1a3d6a] to-[#3a70a8]", accent: "text-[#9ac0e0]", pattern: "columns" },
  "private-equity":     { gradient: "from-[#0a1a30] via-[#1a3355] to-[#2e5c8f]", accent: "text-[#8db5df]", pattern: "chart" },
  "investment-banking": { gradient: "from-[#050f24] via-[#0e2244] to-[#1e4680]", accent: "text-[#7fa5d6]", pattern: "chart" },
  "wealth-management":  { gradient: "from-[#0f2440] via-[#254a75] to-[#4a7ab0]", accent: "text-[#a3c3e2]", pattern: "chart" },
  "venture-capital":    { gradient: "from-[#1a1440] via-[#3d2a75] to-[#7050c8]", accent: "text-[#b8a6e8]", pattern: "chart" },
  "fintech":            { gradient: "from-[#0b1e3f] via-[#1e4680] to-[#4a92d6]", accent: "text-[#a8cfee]", pattern: "circuit" },

  // ── Healthcare / life sciences ─────────────────────────────────────────
  "healthcare":       { gradient: "from-[#0f3d3a] via-[#137a63] to-[#4fbfa1]", accent: "text-[#7fe0c4]", pattern: "chart" },
  "healthtech":       { gradient: "from-[#0d3a4a] via-[#166a7a] to-[#3ea8b8]", accent: "text-[#8fd8e0]", pattern: "chart" },
  "pharmaceuticals":  { gradient: "from-[#0f2e3d] via-[#1e5566] to-[#4a94a5]", accent: "text-[#9ec8d1]", pattern: "molecule" },
  "biotech":          { gradient: "from-[#0d2e2a] via-[#155a4f] to-[#3ea08a]", accent: "text-[#8ed8c5]", pattern: "molecule" },
  "medical-devices":  { gradient: "from-[#122a3d] via-[#264a66] to-[#4a7a95]", accent: "text-[#a3c5d6]", pattern: "gears" },

  // ── Legal / public / social ────────────────────────────────────────────
  "legal":         { gradient: "from-[#1a1a22] via-[#3a3547] to-[#7a6a85]", accent: "text-[#c9b8d6]", pattern: "columns" },
  "public-sector": { gradient: "from-[#0f2540] via-[#1e4470] to-[#3a75b0]", accent: "text-[#9dc0e2]", pattern: "columns" },
  "nonprofit":     { gradient: "from-[#1a3a2a] via-[#2f6a4a] to-[#5aa87a]", accent: "text-[#a5d6b8]", pattern: "leaves" },

  // ── Go-to-market ───────────────────────────────────────────────────────
  "sales":            { gradient: "from-[#3d1a1a] via-[#7a2f2a] to-[#c85a4a]", accent: "text-[#f0a598]", pattern: "chart" },
  "marketing":        { gradient: "from-[#3d1a3d] via-[#7a2d6b] to-[#c85a95]", accent: "text-[#f0a5ce]", pattern: "dots" },
  "media":            { gradient: "from-[#1a1a3d] via-[#3a2d75] to-[#755ec8]", accent: "text-[#c0b0ee]", pattern: "bars" },
  "customer-success": { gradient: "from-[#0f3a3d] via-[#1e6a6d] to-[#3ea8a8]", accent: "text-[#8fd8d8]", pattern: "dots" },

  // ── People / services ──────────────────────────────────────────────────
  "human-resources":    { gradient: "from-[#2a1a3d] via-[#5a3a75] to-[#a075c8]", accent: "text-[#d8bfee]", pattern: "dots" },
  "staffing-agencies":  { gradient: "from-[#2a2540] via-[#4e4585] to-[#8a7ec8]", accent: "text-[#c9c0ee]", pattern: "grid" },
  "consulting":         { gradient: "from-[#1a2540] via-[#3d4a80] to-[#7a85c8]", accent: "text-[#b8c0ee]", pattern: "grid" },

  // ── Real assets / build ────────────────────────────────────────────────
  "construction":  { gradient: "from-[#3d2a12] via-[#7a5a2a] to-[#c89a5a]", accent: "text-[#f0d09a]", pattern: "bars" },
  "real-estate":   { gradient: "from-[#2a1e12] via-[#5a4a2a] to-[#a08a5a]", accent: "text-[#e0c99a]", pattern: "windows" },
  "architecture":  { gradient: "from-[#1a1a1a] via-[#3d3d3d] to-[#8a8a8a]", accent: "text-[#c9c9c9]", pattern: "grid" },
  "proptech":      { gradient: "from-[#1a2a3d] via-[#3a4e70] to-[#7a95c0]", accent: "text-[#bfd0e2]", pattern: "windows" },

  // ── Industrial / mobility ──────────────────────────────────────────────
  "manufacturing":  { gradient: "from-[#1e1a12] via-[#4a3a1f] to-[#c8933a]", accent: "text-[#f5cf7a]", pattern: "gears" },
  "automotive":     { gradient: "from-[#1a1a24] via-[#3a3d55] to-[#7080a8]", accent: "text-[#c0cbe0]", pattern: "gears" },
  "aviation":       { gradient: "from-[#0a1e3d] via-[#1e4680] to-[#4a8cd6]", accent: "text-[#a5c9ee]", pattern: "waves" },
  "logistics":      { gradient: "from-[#1a2a1e] via-[#3a5a3d] to-[#7ab08a]", accent: "text-[#bfe0ca]", pattern: "grid" },
  "defense":        { gradient: "from-[#1a221a] via-[#3d4a3a] to-[#7a8a75]", accent: "text-[#c0cbb8]", pattern: "hex" },

  // ── Energy / earth ─────────────────────────────────────────────────────
  "energy":           { gradient: "from-[#1a1a12] via-[#3d3a1e] to-[#a08a3a]", accent: "text-[#e0cf7a]", pattern: "bars" },
  "renewable-energy": { gradient: "from-[#0f3a2a] via-[#1e7a55] to-[#5abf8a]", accent: "text-[#a5e0c2]", pattern: "leaves" },
  "oil-gas":          { gradient: "from-[#12180d] via-[#2a3320] to-[#5a6a45]", accent: "text-[#b0bd95]", pattern: "gears" },
  "agriculture":      { gradient: "from-[#1a2a12] via-[#3d5a2a] to-[#7ab04a]", accent: "text-[#c9e0a5]", pattern: "leaves" },

  // ── Consumer ───────────────────────────────────────────────────────────
  "hospitality":  { gradient: "from-[#7c4a1e] via-[#a56a3b] to-[#d4a15a]", accent: "text-[#f0d19a]", pattern: "windows" },
  "retail":       { gradient: "from-[#5c1c3a] via-[#a02d5d] to-[#e77aa8]", accent: "text-[#f7c2d9]", pattern: "dots" },
  "ecommerce":    { gradient: "from-[#3d1a5a] via-[#752d95] to-[#c05ae0]", accent: "text-[#e8bff5]", pattern: "grid" },
  "fashion":      { gradient: "from-[#2a1a24] via-[#5a3a4e] to-[#a075a0]", accent: "text-[#e0c0dc]", pattern: "dots" },
  "food-beverage":{ gradient: "from-[#3d2412] via-[#7a4a2a] to-[#c88a5a]", accent: "text-[#f0c99a]", pattern: "leaves" },
  "sports":       { gradient: "from-[#1a3d2a] via-[#2f7a5a] to-[#5abf8a]", accent: "text-[#a5e0c2]", pattern: "chart" },
  "travel":       { gradient: "from-[#0f3a5a] via-[#1e6a95] to-[#4aa5d6]", accent: "text-[#9dd0ee]", pattern: "waves" },

  // ── Education ──────────────────────────────────────────────────────────
  "education":        { gradient: "from-[#1a2a5a] via-[#3d4a95] to-[#7a8ad6]", accent: "text-[#bfcbee]", pattern: "columns" },
  "higher-education": { gradient: "from-[#3d1e12] via-[#7a3a24] to-[#c8785a]", accent: "text-[#f0b89a]", pattern: "columns" },
  "edtech":           { gradient: "from-[#1a2a5a] via-[#3d5aa0] to-[#7a95e0]", accent: "text-[#bfd0f5]", pattern: "grid" },

  // ── Telecom ────────────────────────────────────────────────────────────
  "telecom": { gradient: "from-[#0f1a3d] via-[#1e3a80] to-[#4a75d6]", accent: "text-[#a5c0ee]", pattern: "waves" },
};

const FALLBACK: IndustryVisualIdentity = {
  gradient: "from-[#0b2740] via-[#144670] to-[#2b7fb8]",
  accent: "text-[#7dc5ef]",
  pattern: "grid",
};

export function getIndustryVisualIdentity(slug: string): IndustryVisualIdentity {
  return V[slug] ?? FALLBACK;
}
