/**
 * Accessibility guards for the signed-in desks.
 *
 * 1. Exactly one <main> landmark per page: WorkspaceShell owns it, so no route
 *    or dashboard component rendered inside the shell may declare another.
 * 2. Icon-only buttons must carry an accessible name (aria-label, title, or a
 *    sr-only span inside).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = join(process.cwd(), "src/routes/_authenticated");

/** Layout routes that render outside the shell may own a <main>. */
const SHELL_OWNERS = new Set(["me.tsx"]);

function routeFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx"));
}

describe("single main landmark inside the workspace shell", () => {
  it("WorkspaceShell declares the one main landmark", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/workspace/workspace-shell.tsx"),
      "utf8",
    );
    expect(shell.match(/<main\b/g)?.length ?? 0).toBe(1);
  });

  it("no authenticated route nests a second main landmark", () => {
    const offenders = routeFiles()
      .filter((f) => !SHELL_OWNERS.has(f))
      .filter((f) => /<main\b/.test(readFileSync(join(ROUTES_DIR, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no client/admin dashboard component declares a main landmark", () => {
    const dirs = ["src/components/client", "src/components/admin", "src/components/workspace"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith(".tsx")) {
          const src = readFileSync(join(process.cwd(), rel), "utf8");
          if (/<main\b/.test(src) && !rel.endsWith("workspace-shell.tsx")) offenders.push(rel);
        }
      }
    };
    dirs.forEach(walk);
    expect(offenders).toEqual([]);
  });
});

describe("icon-only buttons have accessible names", () => {
  it("every size=icon Button is labelled", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith(".tsx")) {
          const src = readFileSync(join(process.cwd(), rel), "utf8");
          for (const m of src.matchAll(/<Button\b[^>]*?size="icon"/g)) {
            // Arrow functions inside props contain ">", so scan a window
            // covering the rest of the tag plus its children.
            const window = src.slice(m.index!, m.index! + 600);
            const labelled = /aria-label|title=|aria-labelledby|sr-only/.test(window);
            if (!labelled) offenders.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
          }
        }
      }
    };
    walk("src/components/client");
    walk("src/components/admin");
    walk("src/components/workspace");
    walk("src/routes/_authenticated");
    expect(offenders).toEqual([]);
  });
});
