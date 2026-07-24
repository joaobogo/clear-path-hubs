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

async def step(name, fn):
    t = time.time()
    try:
        await fn()
        results.append({"name":name,"status":"pass","ms":int((time.time()-t)*1000)})
    except Exception as e:
        results.append({"name":name,"status":"fail","ms":int((time.time()-t)*1000),"error":str(e)})

async def run_journeys(page, vp):
    async def goto_h1(path):
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=20000)
        await page.locator("h1").first.wait_for(timeout=8000)

    await step(f"[{vp}] employer: home",       lambda: goto_h1("/"))
    await step(f"[{vp}] employer: platform",   lambda: goto_h1("/platform"))
    await step(f"[{vp}] employer: pricing",    lambda: goto_h1("/pricing"))

    async def intake():
        await page.goto(BASE + "/intake", wait_until="domcontentloaded", timeout=20000)
        await page.locator("main, [role=main]").first.wait_for(timeout=8000)
    await step(f"[{vp}] employer: intake loads", intake)

    await step(f"[{vp}] candidate: jobs list",       lambda: goto_h1("/jobs"))
    await step(f"[{vp}] industry: hospitality",      lambda: goto_h1("/industries/hospitality"))
    await step(f"[{vp}] resource: blog index",       lambda: goto_h1("/blog"))

    async def pricing_roi():
        await page.goto(BASE + "/pricing", wait_until="domcontentloaded", timeout=20000)
        body = (await page.text_content("body")) or ""
        if not any(k in body.lower() for k in ("roi","savings","calculator")):
            raise Exception("no ROI copy on /pricing")
    await step(f"[{vp}] pricing: ROI copy present", pricing_roi)

    async def auth_entry():
        await page.goto(BASE + "/auth", wait_until="domcontentloaded", timeout=20000)
        await page.locator("input, button").first.wait_for(timeout=8000)
    await step(f"[{vp}] auth: entry renders", auth_entry)

    async def refresh_industries():
        await page.goto(BASE + "/industries", wait_until="domcontentloaded", timeout=20000)
        await page.reload(wait_until="domcontentloaded")
        await page.locator("h1").first.wait_for(timeout=8000)
    await step(f"[{vp}] refresh: industries index", refresh_industries)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name,w,h in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width":w,"height":h})
            page = await ctx.new_page()
            await run_journeys(page, name)
            try: await page.screenshot(path=str(OUT/"screens"/f"{name}_last.png"))
            except Exception: pass
            await ctx.close()
        await browser.close()
    summary = {"total":len(results),
               "passed":sum(1 for r in results if r["status"]=="pass"),
               "failed":sum(1 for r in results if r["status"]=="fail"),
               "results":results}
    (OUT/"report.json").write_text(json.dumps(summary, indent=2))
    print(f"E2E: {summary['passed']}/{summary['total']} passed")
    for r in results:
        if r["status"]=="fail": print(" - FAIL", r["name"], "→", r["error"])

asyncio.run(main())
