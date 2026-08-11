/**
 * Brand Center — approved master logo registry.
 *
 * Detection requires *independent* signals. A logo signal that reads the brand
 * name out of `src/config/brand.ts` is not independent — it would agree with a
 * wrong config every time. So the approved masters are pinned here by content
 * fingerprint, recorded when the files were approved. The logo signal resolves
 * its brand from this table alone.
 *
 * Fingerprints are sha256 of the untouched master files in src/assets/brand/.
 * If a master is ever re-exported, update the hash in the same commit — a
 * mismatch is meant to withhold the signal, not to be silenced.
 */

import type { FgvBrandId } from "./detect-types";

export interface ApprovedLogo {
  file: string;
  brandId: FgvBrandId;
  sha256: string;
  role: "wordmark-light" | "wordmark-dark" | "symbol";
}

export const APPROVED_LOGOS: readonly ApprovedLogo[] = [
  {
    file: "logo-on-white.png",
    brandId: "taasflow",
    sha256: "17c6e0484ba0da88a6d4ca1caedfa7c059a90a30e6b6a478ec0e94d8cbd9360b",
    role: "wordmark-light",
  },
  {
    file: "logo-on-blue.png",
    brandId: "taasflow",
    sha256: "289f0df6e3f8888750a502ce0eb8366eab711c9f145dc3d44923dc5456931323",
    role: "wordmark-dark",
  },
  {
    file: "icon-white.png",
    brandId: "taasflow",
    sha256: "290ec9e27473987578022e1744b074548c2633db5e62d46f6730fc6c69700b4a",
    role: "symbol",
  },
];

/**
 * Brand that owns the given master files, or null when the files are unknown
 * or when they are split across brands (which must never resolve).
 */
export function brandFromApprovedLogos(files: readonly string[]): FgvBrandId | null {
  const owners = new Set<FgvBrandId>();
  for (const file of files) {
    const match = APPROVED_LOGOS.find((logo) => logo.file === file);
    if (!match) return null;
    owners.add(match.brandId);
  }
  return owners.size === 1 ? [...owners][0]! : null;
}
