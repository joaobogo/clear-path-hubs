#!/usr/bin/env python3
"""Prompt 46 — Accessibility & Visual regression sweep (heuristic, axe-free)."""
import asyncio, json, hashlib, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
ROUTES = ["/", "/platform", "/how-it-works", "/pricing", "/industries",
          "/industries/hospitality", "/jobs", "/faq", "/contact", "/trust", "/system"]
VIEWPORTS = [("vp320",320,720),("vp375",375,812),("vp768",768,1024),
             ("vp1024",1024,900),("vp1440",1440,900),("vp1920",1920,1080)]
OUT = Path("docs/audit/prompt-46-artifacts")
(OUT/"screens").mkdir(parents=True, exist_ok=True)
(OUT/"baseline").mkdir(parents=True, exist_ok=True)

A11Y_JS = r"""
() => {
  const findings = { critical: [], serious: [], moderate: [] };
  document.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('alt')) findings.serious.push({ rule:'image-alt', html: img.outerHTML.slice(0,120) });
  });
  document.querySelectorAll('button, a').forEach(el => {
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    const hasImgAlt = [...el.querySelectorAll('img')].some(i => i.getAttribute('alt'));
    if (!label && !hasImgAlt) findings.critical.push({ rule:'name-missing', tag: el.tagName, html: el.outerHTML.slice(0,120) });
  });
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const type = el.getAttribute('type');
    if (['hidden','submit','button'].includes(type)) return;
    const id = el.id;
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    const hasLabel = id && document.querySelector('label[for="'+id+'"]');
    if (!ariaLabel && !hasLabel) findings.serious.push({ rule:'form-label', html: el.outerHTML.slice(0,120) });
  });
  const mains = document.querySelectorAll('main').length;
  if (mains !== 1) findings.serious.push({ rule:'landmark-main', count: mains });
  const h1s = document.querySelectorAll('h1').length;
  if (h1s !== 1) findings.moderate.push({ rule:'heading-h1', count: h1s });
  const skip = document.querySelector('a[href^="#"][class*="sr-only"], a[href="#main"]');
  if (!skip) findings.moderate.push({ rule:'skip-link' });
  return findings;
}
"""

async def main():
    report = {"routes": [], "summary": {"critical":0,"serious":0,"moderate":0,"visualDiffs":0}}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for vp_name, w, h in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width":w,"height":h}, reduced_motion="reduce")
            for route in ROUTES:
                page = await ctx.new_page()
                url = BASE + route
                slug = "home" if route == "/" else route.strip("/").replace("/","_")
                entry = {"vp": vp_name, "route": route, "url": url}
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(400)
                    a11y = await page.evaluate(A11Y_JS)
                    shot = OUT/"screens"/f"{vp_name}_{slug}.png"
                    buf = await page.screenshot(path=str(shot), clip={"x":0,"y":0,"width":w,"height":min(h,1200)})
                    digest = hashlib.sha256(buf).hexdigest()[:16]
                    base = OUT/"baseline"/f"{vp_name}_{slug}.hash"
                    prev = base.read_text().strip() if base.exists() else None
                    if not prev: base.write_text(digest)
                    drift = bool(prev and prev != digest)
                    if drift: report["summary"]["visualDiffs"] += 1
                    for sev in ("critical","serious","moderate"):
                        report["summary"][sev] += len(a11y[sev])
                    entry.update({"a11y": a11y, "hash": digest, "baseline": prev or digest, "drift": drift})
                except Exception as e:
                    entry["error"] = str(e)
                await page.close()
                report["routes"].append(entry)
            await ctx.close()
        await browser.close()
    (OUT/"report.json").write_text(json.dumps(report, indent=2))
    print("A11y+visual sweep summary:", report["summary"])

asyncio.run(main())
