/**
 * What boots from the server-rendered <head>, and what must NOT.
 *
 * GA4 boots from the head on every page, exactly once: a missing snippet loses
 * the first pageview of a hard load, a duplicated one double-counts every visit.
 * It ships with consent denied by default and is granted later.
 *
 * RB2B and LinkedIn are deliberately NOT in the head. They identify visitors,
 * so they load only after marketing consent — `initRB2B` in
 * src/lib/tracking/pixels.ts is, in its own words, "the ONLY path that loads
 * RB2B, and it runs only after marketing consent is granted". HEAD_BOOT_SNIPPETS
 * contains ga4 and nothing else.
 *
 * This spec used to list all three as required in the head. That was left over
 * from the design before consent-gating, and it asserted the exact opposite of
 * the privacy behaviour the app now implements — so it read as "the RB2B pixel
 * is missing from the build" during the launch test pass, when the pixel was
 * absent precisely because it was working correctly.
 *
 * These assertions run against the raw HTML response (no browser JS), so they
 * check what the server actually ships — not the post-hydration DOM. That
 * distinction matters for GA4 too: `window.__tfGa4=1` is present in the shipped
 * head but the inline tag removes itself once executed, so looking for it in
 * document.head at runtime reports a false failure.
 */
import { test, expect } from "@playwright/test";

/** Public routes a visitor can land on directly. */
const PAGES = [
  "/",
  "/pricing",
  "/jobs",
  "/contact",
  "/pilot",
  "/intake",
  "/candidate-join",
];

/**
 * One unique marker per tag. Each is a literal from the head-boot snippet in
 * src/lib/tracking/pixels.ts, chosen so it cannot appear anywhere else.
 */
const REQUIRED_MARKERS: Record<string, string> = {
  ga4: "window.__tfGa4=1",
};

/**
 * Consent-gated identity trackers. These must be ABSENT from the shipped head:
 * they are injected by the client only once marketing consent is granted, so
 * finding one here means a visitor is being identified before they agreed.
 */
const CONSENT_GATED_MARKERS: Record<string, string> = {
  rb2b: "ddwl4m2hdecbv.cloudfront.net/b/",
  linkedin: "window.__tfLi=1",
};

/** Configured only when its env var is set — never more than once when present. */
const OPTIONAL_MARKERS: Record<string, string> = {
  meta: "connect.facebook.net/en_US/fbevents.js",
};

function countOccurrences(haystack: string, needle: string) {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function headOf(html: string) {
  const match = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return match?.[1] ?? "";
}

for (const path of PAGES) {
  test(`pixel snippets appear exactly once in the server-rendered head of ${path}`, async ({
    request,
  }) => {
    const response = await request.get(path);
    expect(response.status(), `${path} should render`).toBeLessThan(400);

    const html = await response.text();
    const head = headOf(html);
    expect(head.length, `${path} should server-render a <head>`).toBeGreaterThan(0);

    for (const [tracker, marker] of Object.entries(REQUIRED_MARKERS)) {
      expect(
        countOccurrences(head, marker),
        `${tracker} must boot exactly once in the head of ${path}`,
      ).toBe(1);
      expect(
        countOccurrences(html, marker),
        `${tracker} must appear only in the head of ${path}`,
      ).toBe(1);
    }

    // Identity trackers must not ship before consent. This is the assertion the
    // spec previously had backwards.
    for (const [tracker, marker] of Object.entries(CONSENT_GATED_MARKERS)) {
      expect(
        countOccurrences(html, marker),
        `${tracker} identifies the visitor and must not load before marketing consent — ` +
          `finding it in the shipped HTML of ${path} means it boots for everyone`,
      ).toBe(0);
    }

    for (const [tracker, marker] of Object.entries(OPTIONAL_MARKERS)) {
      expect(
        countOccurrences(html, marker),
        `${tracker} must never be duplicated on ${path}`,
      ).toBeLessThanOrEqual(1);
    }

    // The LinkedIn <noscript> fallback fires on render with no way to ask
    // first, so it is consent-gated with the rest of LinkedIn and must not be
    // in the shipped HTML either. This assertion also used to be inverted.
    expect(
      countOccurrences(html, "px.ads.linkedin.com/collect/"),
      `the LinkedIn noscript pixel fires without consent and must not ship on ${path}`,
    ).toBe(0);
  });
}

test("hydration does not duplicate any tag, and gates the identity trackers", async ({
  page,
}) => {
  // No consent is granted in this run, so only GA4 should be present — and it
  // must be present exactly once, not twice, after hydration.
  await page.goto("/", { waitUntil: "networkidle" });

  const counts = await page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const key of ["ga4", "rb2b", "linkedin"]) {
      out[key] = document.querySelectorAll(`script[data-tracker="${key}"]`).length;
    }
    return out;
  });

  expect(counts.ga4, "ga4 should be injected exactly once").toBe(1);

  for (const tracker of ["rb2b", "linkedin"]) {
    expect(
      counts[tracker],
      `${tracker} identifies the visitor — it must not be injected without marketing consent`,
    ).toBe(0);
  }
});
