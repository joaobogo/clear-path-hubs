import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

MANIFEST = json.loads(Path("/dev-server/reports/dashboard-recovery/phase-02-qa-manifest.json").read_text())
BASE = "http://localhost:8080"
PWD = os.environ["QA_PERSONA_PASSWORD"]
OUT = Path("/tmp/browser/phase-02"); OUT.mkdir(parents=True, exist_ok=True)

PERSONAS_TO_TEST = [
    ("platform-admin", "/admin"),
    ("operations",     "/admin"),
    ("alpha-admin",    "/client"),
    ("alpha-editor",   "/client"),
    ("alpha-viewer",   "/client"),
    ("beta-admin",     "/client"),
    ("cand-single",    "/me"),
    ("cand-multi",     "/me"),
    ("cand-none",      "/me"),
]

async def login(context, email):
    page = await context.new_page()
    await page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    await page.get_by_label("Email", exact=False).first.fill(email)
    await page.get_by_label("Password", exact=False).first.fill(PWD)
    await page.get_by_role("button", name="Sign in", exact=False).first.click()
    # Wait until session lands in localStorage (Supabase persists here after signIn resolves)
    for _ in range(40):
        has = await page.evaluate("() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))")
        if has: break
        await page.wait_for_timeout(250)
    return page

async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # simultaneous contexts (isolated storage per persona)
        contexts = {}
        for slug, target in PERSONAS_TO_TEST:
            email = MANIFEST["personas"][slug]["email"]
            ctx = await browser.new_context(viewport={"width":1280,"height":1800})
            contexts[slug] = ctx
            try:
                page = await login(ctx, email)
                await page.goto(f"{BASE}{target}", wait_until="domcontentloaded")
                await page.wait_for_timeout(1500)
                shot = OUT / f"{slug}.png"
                await page.screenshot(path=str(shot))
                url = page.url
                title = await page.title()
                results.append({"persona": slug, "email_masked": email.split("@")[0][:12]+"…", "target": target, "final_url": url.replace(BASE,""), "title": title, "screenshot": shot.name, "status": "PASS"})
            except Exception as e:
                results.append({"persona": slug, "target": target, "status": "FAIL", "error": str(e)[:200]})

        # Simultaneous multi-context sanity: admin, client, candidate all still authenticated in parallel
        async def probe(slug, url):
            p = await contexts[slug].new_page()
            await p.goto(f"{BASE}{url}", wait_until="domcontentloaded")
            await p.wait_for_timeout(800)
            return {"persona": slug, "url": url, "final": p.url.replace(BASE, ""), "authed": "/login" not in p.url}
        parallel = await asyncio.gather(
            probe("platform-admin", "/admin/positions"),
            probe("alpha-admin",   "/client"),
            probe("cand-single",   "/me/applications"),
        )
        # Isolation check: alpha-admin should NOT be able to open beta-admin's org data
        alpha_probe = await contexts["alpha-admin"].new_page()
        await alpha_probe.goto(f"{BASE}/client?org={MANIFEST['orgs']['beta']}", wait_until="domcontentloaded")
        await alpha_probe.wait_for_timeout(1500)
        alpha_body = (await alpha_probe.content())[:2000]
        # crude isolation signal: no beta org name leak
        isolation_leak = "TaaSFlow QA Client Beta" in alpha_body
        for c in contexts.values(): await c.close()
        await browser.close()

        summary = {
            "logins": results,
            "parallel_probes": parallel,
            "isolation_check": {"alpha_saw_beta_data": isolation_leak, "status": "FAIL" if isolation_leak else "PASS"},
        }
        Path(OUT / "results.json").write_text(json.dumps(summary, indent=2))
        print(json.dumps(summary, indent=2))

asyncio.run(main())
