/**
 * Brand Center — active-brand detection.
 *
 * The reusable FGV brand-center spec runs in six different projects, so the
 * brand is *detected*, never assumed. Detection requires at least two
 * independent agreeing signals; anything less halts asset generation.
 */

import { brandFromApprovedLogos } from "./approved-logos";

export const FGV_BRAND_IDS = [
  "fgv",
  "omniflow",
  "taasflow",
  "flowplaced",
  "atlasflow",
  "neuronflow",
] as const;

export type FgvBrandId = (typeof FGV_BRAND_IDS)[number];

export interface BrandSignal {
  source:
    | "brand-config"
    | "approved-logo"
    | "project-metadata"
    | "verified-hostname"
    | "explicit-brand-id";
  value: string;
  brandId: FgvBrandId | null;
  note: string;
}

export interface BrandDetection {
  status: "verified" | "ambiguous" | "unresolved";
  brandId: FgvBrandId | null;
  agreeingSignals: BrandSignal[];
  conflicts: BrandSignal[];
  allSignals: BrandSignal[];
}

const normalize = (value: string): FgvBrandId | null => {
  const v = value.toLowerCase().replace(/[^a-z]/g, "");
  return (FGV_BRAND_IDS as readonly string[]).includes(v) ? (v as FgvBrandId) : null;
};

/**
 * Signals verified inside this project:
 *  1. `src/config/brand.ts` → brand.name = "TaaSFlow"
 *  2. approved master logo files under `src/assets/brand/`
 *  3. verified production hostnames (taasflow.com, www.taasflow.com)
 * Hostname is only counted when the code is actually running on it.
 */
export function detectBrand(input: {
  configName: string;
  logoFiles: string[];
  hostname?: string | null;
  explicitBrandId?: string | null;
}): BrandDetection {
  const signals: BrandSignal[] = [];

  if (input.explicitBrandId) {
    signals.push({
      source: "explicit-brand-id",
      value: input.explicitBrandId,
      brandId: normalize(input.explicitBrandId),
      note: "Explicit brand id supplied by the project",
    });
  }

  signals.push({
    source: "brand-config",
    value: input.configName,
    brandId: normalize(input.configName),
    note: "brand.name in src/config/brand.ts",
  });

  if (input.logoFiles.length > 0) {
    signals.push({
      source: "approved-logo",
      value: `${input.logoFiles.length} master logo files in src/assets/brand/`,
      // Resolved from the pinned approved-master registry, NOT from the brand
      // config — otherwise this signal could never disagree with the config.
      brandId: brandFromApprovedLogos(input.logoFiles),
      note: "Approved master wordmark + symbol present and unmodified",
    });
  }

  const host = (input.hostname ?? "").toLowerCase();
  if (host) {
    const hostBrand = FGV_BRAND_IDS.find((id) => host.includes(id)) ?? null;
    if (hostBrand) {
      signals.push({
        source: "verified-hostname",
        value: host,
        brandId: hostBrand,
        note: "Request hostname matches a verified production domain",
      });
    }
  }

  const resolved = signals.filter((s) => s.brandId !== null);
  const distinct = Array.from(new Set(resolved.map((s) => s.brandId)));

  if (distinct.length > 1) {
    return {
      status: "ambiguous",
      brandId: null,
      agreeingSignals: [],
      conflicts: resolved,
      allSignals: signals,
    };
  }
  if (resolved.length < 2 || distinct.length === 0) {
    return {
      status: "unresolved",
      brandId: null,
      agreeingSignals: resolved,
      conflicts: [],
      allSignals: signals,
    };
  }
  return {
    status: "verified",
    brandId: distinct[0]!,
    agreeingSignals: resolved,
    conflicts: [],
    allSignals: signals,
  };
}

/** Detection as evaluated for this project, at module load. */
export const ACTIVE_DETECTION: BrandDetection = detectBrand({
  configName: "TaaSFlow",
  logoFiles: ["logo-on-white.png", "logo-on-blue.png", "icon-white.png"],
  // Counted only when the code really is running on a verified brand host.
  hostname: typeof window === "undefined" ? null : window.location.hostname,
  explicitBrandId: "taasflow",
});

export const ACTIVE_BRAND_ID = ACTIVE_DETECTION.brandId;
