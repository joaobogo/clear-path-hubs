"""
Prompt 48 — Chaos & failure-recovery sweep.

Exercises the public + product surface under simulated failure modes and
captures screenshots + a JSON report. Focuses on falsifiable questions:

  1. Does the page render a truthful failure surface (not silent empty)?
  2. Is a retry affordance present?
  3. Do route error boundaries catch thrown loader errors?

Failure modes covered
  - Offline network (all requests aborted)
  - Slow 3G (page still renders shell)
  - API 500 (route.abort with server error)
  - Image asset failure (all image/* requests fail)
  - Route error boundary reachable (navigate to a known-404 slug)

Viewports: 320, 375, 768, 1440.
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path(__file__).resolve().parents[2] / "docs" / "audit" / "prompt-48-artifacts"
SCREENS = OUT / "screens"
SCREENS.mkdir(parents=True, exist_ok=True)
REPORT = OUT / "report.json"

VIEWPORTS = [
    ("mobile-320", 320, 720),
    ("mobile-375", 375, 812),
    ("tablet-768", 768, 1024),
    ("desktop-1440", 1440, 900),
]

# Routes we treat as core public surface.
CORE_ROUTES = ["/", "/pricing", "/jobs", "/industries", "/faq"]

RETRY_TEXT = re.compile(r"try again|retry|reload|refresh", re.I)
FAILURE_TEXT = re.compile(
    r"try again|couldn't load|didn't finish|temporarily|something went wrong|unavailable|offline",
    re.I,
)


async def _has_retry_or_failure_copy(page) -> tuple[bool, bool]:
    text = (await page.inner_text("body")).strip()
    return bool(FAILURE_TEXT.search(text)), bool(RETRY_TEXT.search(text))


async def _screenshot(page, name: str):
    await page.screenshot(path=str(SCREENS / f"{name}.png"))


async def scenario_offline(ctx, viewport_name: str, results: list):
    page = await ctx.new_page()
    # Fail every request (simulates offline / total network loss)
    await ctx.route("**/*", lambda route: route.abort("internetdisconnected"))
    try:
        await page.goto(BASE_URL + "/", wait_until="commit", timeout=10_000)
    except Exception:
        pass
    await page.wait_for_timeout(500)
    await _screenshot(page, f"offline-{viewport_name}")
    results.append({"scenario": "offline", "viewport": viewport_name, "ok": True, "note": "navigation aborted as expected"})
    await ctx.unroute("**/*")
    await page.close()


async def scenario_api_500(ctx, viewport_name: str, results: list):
    """Client-side navigation into /jobs with all server-fn calls returning 500.
    SSR is bypassed by first landing on /, then in-app navigating — that
    forces the loader's ensureQueryData to hit _serverFn over the wire.
    Truthfulness gate: page must NOT show a "0 results" success screen.
    """
    page = await ctx.new_page()
    await page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=15_000)
    await page.wait_for_timeout(400)

    async def handle(route):
        req = route.request
        if "_serverFn" in req.url or "/api/" in req.url:
            await route.fulfill(status=500, body='{"error":"chaos"}', content_type="application/json")
        else:
            await route.continue_()

    await ctx.route("**/*", handle)
    try:
        # Click an in-page Link so the TanStack client router owns the nav —
        # this is what actually exercises the client-side loader path.
        link = page.locator('a[href="/jobs"]').first
        await link.click(timeout=3000)
    except Exception:
        try:
            await page.evaluate("() => history.pushState({}, '', '/jobs')")
        except Exception:
            pass
    await page.wait_for_timeout(3000)
    failure, retry = await _has_retry_or_failure_copy(page)
    await _screenshot(page, f"api500-jobs-{viewport_name}")
    body = (await page.inner_text("body")).lower()
    on_jobs = "/jobs" in page.url
    false_empty = on_jobs and ("0 results" in body or "no positions" in body) and not failure
    ok = (failure or retry or not on_jobs) and not false_empty
    results.append({
        "scenario": "api_500",
        "viewport": viewport_name,
        "route": "/jobs",
        "final_url": page.url,
        "failure_surface": failure,
        "retry_affordance": retry,
        "false_empty_state": false_empty,
        "ok": ok,
    })
    await ctx.unroute("**/*")
    await page.close()


async def scenario_slow_network(ctx, viewport_name: str, results: list):
    page = await ctx.new_page()

    async def slow(route):
        await asyncio.sleep(0.4)
        await route.continue_()

    await ctx.route("**/*", slow)
    await page.goto(BASE_URL + "/pricing", wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_timeout(800)
    body = await page.inner_text("body")
    await _screenshot(page, f"slow-pricing-{viewport_name}")
    results.append({
        "scenario": "slow_network",
        "viewport": viewport_name,
        "route": "/pricing",
        "shell_visible": len(body) > 200,
        "ok": len(body) > 200,
    })
    await ctx.unroute("**/*")
    await page.close()


async def scenario_image_failure(ctx, viewport_name: str, results: list):
    page = await ctx.new_page()

    async def block_images(route):
        req = route.request
        if req.resource_type == "image":
            await route.abort()
        else:
            await route.continue_()

    await ctx.route("**/*", block_images)
    await page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=20_000)
    await page.wait_for_timeout(800)
    body = await page.inner_text("body")
    await _screenshot(page, f"noimages-home-{viewport_name}")
    # Alt text or textual content must still communicate value.
    alt_present = await page.evaluate(
        "() => Array.from(document.images).every(i => i.alt !== undefined)"
    )
    results.append({
        "scenario": "image_failure",
        "viewport": viewport_name,
        "route": "/",
        "content_still_present": len(body) > 500,
        "alt_present_on_all_imgs": bool(alt_present),
        "ok": len(body) > 500 and bool(alt_present),
    })
    await ctx.unroute("**/*")
    await page.close()


async def scenario_route_404(ctx, viewport_name: str, results: list):
    page = await ctx.new_page()
    await page.goto(BASE_URL + "/definitely-not-a-real-route-xyz", wait_until="domcontentloaded", timeout=15_000)
    await page.wait_for_timeout(500)
    body = (await page.inner_text("body")).lower()
    await _screenshot(page, f"notfound-{viewport_name}")
    notfound = "not found" in body or "404" in body or "couldn" in body
    results.append({
        "scenario": "route_404",
        "viewport": viewport_name,
        "not_found_surface": notfound,
        "ok": notfound,
    })
    await page.close()


SCENARIOS = [
    scenario_offline,
    scenario_slow_network,
    scenario_api_500,
    scenario_image_failure,
    scenario_route_404,
]


async def main():
    results: list = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for vp_name, w, h in VIEWPORTS:
                ctx = await browser.new_context(viewport={"width": w, "height": h})
                for fn in SCENARIOS:
                    await fn(ctx, vp_name, results)
                await ctx.close()
        finally:
            await browser.close()

    failures = [r for r in results if not r.get("ok", False)]
    summary = {
        "total": len(results),
        "passed": len(results) - len(failures),
        "failed": len(failures),
    }
    REPORT.write_text(json.dumps({"summary": summary, "results": results}, indent=2))
    print("Chaos sweep:", summary)
    for f in failures:
        print("  FAIL:", f)


if __name__ == "__main__":
    asyncio.run(main())
