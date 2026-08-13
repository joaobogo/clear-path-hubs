/**
 * Tracking pixels must boot from the server-rendered <head> on every page, and
 * exactly once: a missing snippet loses the first pageview of a hard load, a
 * duplicated one double-counts every visit.
 *
 * These assertions run against the raw HTML response (no browser JS), so they
 * check what the server actually ships — not the post-hydration DOM.
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
  "/book",
  "/candidate-join",
];

/**
 * One unique marker per tag. Each is a literal from the head-boot snippet in
 * src/lib/tracking/pixels.ts, chosen so it cannot appear anywhere else.
 */
const REQUIRED_MARKERS: Record<string, string> = {
  ga4: "window.__tfGa4=1",
  apollo: "window.__tfApollo=1",
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

    for (const [tracker, marker] of Object.entries(OPTIONAL_MARKERS)) {
      expect(
        countOccurrences(html, marker),
        `${tracker} must never be duplicated on ${path}`,
      ).toBeLessThanOrEqual(1);
    }

    // The LinkedIn <noscript> fallback belongs in the body, once per page.
    expect(
      countOccurrences(html, "px.ads.linkedin.com/collect/"),
      `LinkedIn noscript pixel must appear once on ${path}`,
    ).toBe(1);
    expect(countOccurrences(head, "px.ads.linkedin.com/collect/")).toBe(0);
  });
}

test("hydration does not duplicate any tag in the live DOM", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const counts = await page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const key of ["ga4", "apollo", "rb2b", "linkedin"]) {
      out[key] = document.querySelectorAll(
        `script[data-tracker="${key}"]`,
      ).length;
    }
    return out;
  });

  for (const [tracker, count] of Object.entries(counts)) {
    expect(count, `${tracker} script should be injected once`).toBe(1);
  }
});
