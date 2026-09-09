/**
 * Render the branded system overview to PDF via Playwright's Chromium.
 *
 * Chromium rather than a PDF library: the document is laid out in CSS with real
 * brand tokens, web fonts and print rules, and print-to-PDF is the only way to
 * get that layout out faithfully.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The document lives outside the repo, beside its brand assets.
const here = dirname(fileURLToPath(import.meta.url));
const docDir = join(here, "..", "..", "taasflow-system-doc");
const source = join(docDir, "system-overview.html");
const out = process.argv[2] ?? join(docDir, "TaaSFlow-System-Overview.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();

// file:// so the logo and any local asset resolve.
await page.goto(`file:///${source.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

// Inter, to match the product. Falls back to the system stack if offline.
await page
  .addStyleTag({
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  })
  .catch(() => console.warn("web font unavailable — using the system stack"));
await page.waitForTimeout(1500);

await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  // Page numbers from page 2 on; the cover is full-bleed and carries none.
  footerTemplate: `
    <div style="width:100%;font-size:7pt;color:#8A93A6;
                font-family:Inter,Segoe UI,sans-serif;padding:0 15mm;
                display:flex;justify-content:space-between;">
      <span>TaaSFlow — System Overview v1.0</span>
      <span class="pageNumber"></span>
    </div>`,
  margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
});

await browser.close();
console.log(`PDF written: ${out}`);
