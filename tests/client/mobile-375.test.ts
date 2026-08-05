import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The client workspace has to work on a phone.
 *
 * These are static guards, not renders: a table that keeps its columns at
 * 375px, or a fixed-width board, silently reintroduces horizontal scroll and
 * pushes the decision buttons off screen. Catching it here is cheaper than
 * catching it on a hiring manager's phone.
 */

const ROUTES_DIR = join(process.cwd(), "src/routes/_authenticated");
const COMPONENTS_DIR = join(process.cwd(), "src/components/client");

function clientFiles(): { name: string; source: string }[] {
  const files: { name: string; source: string }[] = [];
  for (const f of readdirSync(ROUTES_DIR)) {
    if (f.startsWith("client.") && f.endsWith(".tsx")) {
      files.push({ name: `routes/${f}`, source: readFileSync(join(ROUTES_DIR, f), "utf8") });
    }
  }
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".tsx"))
        files.push({
          name: `components/client/${prefix}${entry.name}`,
          source: readFileSync(join(dir, entry.name), "utf8"),
        });
    }
  };
  walk(COMPONENTS_DIR, "");
  return files;
}

const FILES = clientFiles();

describe("client workspace at 375px", () => {
  it("scopes the phone ergonomics stylesheet from the client shell", () => {
    const shell = readFileSync(join(ROUTES_DIR, "client.tsx"), "utf8");
    expect(shell).toContain("data-client-workspace");
    const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    expect(styles).toContain("client-mobile.css");
  });

  it("keeps a 44px floor and a 14px floor in the mobile stylesheet", () => {
    const css = readFileSync(join(process.cwd(), "src/styles/client-mobile.css"), "utf8");
    expect(css).toContain("min-height: 2.75rem");
    expect(css).toContain("taas-stack-table");
    expect(css).toContain("0.875rem");
  });

  for (const { name, source } of FILES) {
    const tables = source.split("<table").length - 1;
    if (tables === 0) continue;
    it(`${name}: every table stacks or hides on a phone`, () => {
      // Either the table itself stacks, or the whole block is desktop-only
      // with a card list beside it for small screens.
      const stacks = source.includes("taas-stack-table");
      const desktopOnly = /hidden[^"]*(md|lg):(block|grid|table)/.test(source);
      expect(stacks || desktopOnly).toBe(true);
    });
  }

  for (const { name, source } of FILES) {
    const wide = source.match(/min-w-\[(\d{3,})px\]/g) ?? [];
    if (wide.length === 0) continue;
    it(`${name}: no unconditional wide block forces horizontal scroll`, () => {
      for (const cls of wide) {
        const width = Number(cls.replace(/\D/g, ""));
        if (width <= 375) continue;
        // A block wider than a phone must be gated behind a breakpoint.
        const gated = new RegExp(`(sm|md|lg):min-w-\\[${width}px\\]`).test(source);
        expect(gated, `${cls} in ${name} is not breakpoint-gated`).toBe(true);
      }
    });
  }

  it("keeps the decline decision visible in the pinned candidate bar", () => {
    const detail = readFileSync(join(ROUTES_DIR, "client.candidates.$id.tsx"), "utf8");
    const bar = detail.slice(detail.indexOf("function MobileActionBar"));
    expect(bar).toContain("Not a fit");
    expect(bar).toContain("fixed inset-x-0 bottom-0");
    expect(bar).toContain("min-h-11");
    // Content must clear the pinned bar rather than sit under it.
    expect(detail).toContain("pb-28");
  });
});
