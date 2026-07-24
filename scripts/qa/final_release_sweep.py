import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("docs/audit/prompt-50-artifacts")
SCR = OUT / "screens"; SCR.mkdir(parents=True, exist_ok=True)

ROUTES = ["/", "/platform", "/pricing", "/trust", "/system", "/pitch",
          "/industries", "/industries/hospitality", "/industries/healthcare",
          "/industries/finance", "/faq", "/jobs", "/talent-network"]
VIEWPORTS = [320, 375, 768, 1024, 1440, 1920]
BASE = "http://localhost:8080"

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for w in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width": w, "height": 900})
            page = await ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            for route in ROUTES:
                url = BASE + route
                try:
                    r = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    status = r.status if r else 0
                    # hard refresh
                    await page.reload(wait_until="domcontentloaded", timeout=15000)
                    has_main = await page.evaluate("!!document.querySelector('main')")
                    h1_count = await page.evaluate("document.querySelectorAll('h1').length")
                    if w in (375, 1440):
                        safe = route.replace("/", "_") or "_home"
                        await page.screenshot(path=str(SCR / f"{w}{safe}.png"))
                    results.append({"vp": w, "route": route, "status": status,
                                    "has_main": has_main, "h1": h1_count, "ok": status < 400 and has_main})
                except Exception as e:
                    results.append({"vp": w, "route": route, "status": 0, "ok": False, "err": str(e)[:200]})
            await ctx.close()
        await browser.close()
    OUT.joinpath("report.json").write_text(json.dumps(results, indent=2))
    total = len(results); passed = sum(1 for r in results if r["ok"])
    print(f"total={total} passed={passed} failed={total-passed}")
    for r in results:
        if not r["ok"]: print("FAIL", r)

asyncio.run(main())
