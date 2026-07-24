#!/usr/bin/env python3
"""Prompt 47 — End-to-end journey suite."""
import asyncio, json, os, time
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
OUT = Path("docs/audit/prompt-47-artifacts")
(OUT/"screens").mkdir(parents=True, exist_ok=True)

VIEWPORTS = [("mobile",375,812),("tablet",768,1024),("desktop",1440,900)]

results = []
async def step(name, coro):
    t = time.time()
    try:
        await coro
        results.append({"name":name,"status":"pass","ms":int((time.time()-t)*1000)})
    except Exception as e:
        results.append({"name":name,"status":"fail","ms":int((time.time()-t)*1000),"error":str(e)})

async def run_journeys(page, vp):
    async def goto(path):
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=20000)
    async def has_h1():
        await page.locator("h1").first.wait_for(timeout=8000)

    await step(f"[{vp}] employer: home", (async_h1 := (goto("/"), has_h1))[0]) if False else None
    # simpler linear:
    await step(f"[{vp}] employer: home", _seq(goto("/"), has_h1))
    await step(f"[{vp}] employer: platform", _seq(goto("/platform"), has_h1))
    await step(f"[{vp}] employer: pricing", _seq(goto("/pricing"), has_h1))
    await step(f"[{vp}] employer: intake loads", _seq(goto("/intake"), page.locator("main, [role=main]").first.wait_for(timeout=8000)))
    await step(f"[{vp}] candidate: jobs list", _seq(goto("/jobs"), has_h1))
    await step(f"[{vp}] industry: hospitality", _seq(goto("/industries/hospitality"), has_h1))
    await step(f"[{vp}] resource: blog index", _seq(goto("/blog"), has_h1))
    async def roi_copy():
        body = await page.text_content("body")
        if not body or not any(k in body.lower() for k in ("roi","savings","calculator")):
            raise Exception("no ROI copy")
    await step(f"[{vp}] pricing: ROI copy present", _seq(goto("/pricing"), roi_copy()))
    await step(f"[{vp}] auth: entry renders", _seq(goto("/auth"), page.locator("input, button").first.wait_for(timeout=8000)))
    async def refresh_deep():
        await page.reload(wait_until="domcontentloaded")
        await page.locator("h1").first.wait_for(timeout=8000)
    await step(f"[{vp}] refresh: industries deep route", _seq(goto("/industries"), refresh_deep()))

async def _seq(*coros):
    for c in coros:
        await c

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name,w,h in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width":w,"height":h})
            page = await ctx.new_page()
            await run_journeys(page, name)
            await page.screenshot(path=str(OUT/"screens"/f"{name}_last.png"))
            await ctx.close()
        await browser.close()
    summary = {"total":len(results),"passed":sum(1 for r in results if r["status"]=="pass"),
               "failed":sum(1 for r in results if r["status"]=="fail"),"results":results}
    (OUT/"report.json").write_text(json.dumps(summary, indent=2))
    print(f"E2E: {summary['passed']}/{summary['total']} passed")
    for r in results:
        if r["status"]=="fail": print(" - FAIL", r["name"], "→", r["error"])

asyncio.run(main())
