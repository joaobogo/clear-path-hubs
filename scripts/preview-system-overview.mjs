/**
 * Screenshot each page of the system overview so the layout can be checked
 * visually. pdftoppm is not available here, so this renders the same HTML the
 * PDF is printed from, at A4 proportions, one image per page break.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docDir = join(here, "..", "..", "taasflow-system-doc");
const source = join(docDir, "system-overview.html");

const browser = await chromium.launch();
// A4 at 96dpi ≈ 794 × 1123.
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.goto(`file:///${source.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page
  .addStyleTag({
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  })
  .catch(() => {});
// Print rules are what the PDF uses; screen media would show a different layout.
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(1200);

const blocks = await page.$$(".cover, .section");
console.log(`sections: ${blocks.length}`);
for (const [i, el] of blocks.entries()) {
  const out = join(docDir, `preview-${String(i + 1).padStart(2, "0")}.png`);
  await el.screenshot({ path: out });
  console.log(out);
}

await browser.close();
