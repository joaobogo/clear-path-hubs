/**
 * Non-failing audit: reports titles over 60 and descriptions over 160
 * characters across content entries and route fallbacks. It never fails the
 * suite; it prints a summary so authors can shorten the source copy instead of
 * relying on the clamp in `head.ts`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blog, industries, pages } from "@/lib/marketing/content";
import { DESCRIPTION_WARN_LENGTH, TITLE_WARN_LENGTH } from "@/lib/marketing/head";

type Meta = Record<string, string | undefined>;

describe("head length audit (warnings only)", () => {
  it("reports over-long titles and descriptions", () => {
    const warnings: string[] = [];
    const check = (where: string, title?: string, description?: string) => {
      if (title && title.length > TITLE_WARN_LENGTH)
        warnings.push(`title ${title.length}>${TITLE_WARN_LENGTH} ${where}: ${title}`);
      if (description && description.length > DESCRIPTION_WARN_LENGTH)
        warnings.push(`description ${description.length}>${DESCRIPTION_WARN_LENGTH} ${where}`);
    };

    for (const [group, entries] of [["page", pages], ["blog", blog], ["industry", industries]] as const) {
      for (const [slug, entry] of Object.entries(entries)) {
        const meta = entry.meta as Meta;
        check(`${group}:${slug}`, meta.title || meta["og:title"], meta.description || meta["og:description"]);
      }
    }

    // Route fallbacks: `title: "..."` / `description: "..."` string literals in route heads.
    const dir = join(process.cwd(), "src/routes");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, file), "utf8");
      for (const m of src.matchAll(/\btitle:\s*"([^"\n]{10,})"/g)) check(`route:${file}`, m[1]);
      for (const m of src.matchAll(/\bdescription:\s*\n?\s*"([^"\n]{20,})"/g)) check(`route:${file}`, undefined, m[1]);
    }

    if (warnings.length > 0) {
      console.warn(`[head audit] ${warnings.length} over-length title/description(s):\n${warnings.join("\n")}`);
    }
    expect(Array.isArray(warnings)).toBe(true); // warnings never fail the suite
  });
});
