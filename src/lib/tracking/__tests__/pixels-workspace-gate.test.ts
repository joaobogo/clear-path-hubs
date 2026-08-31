/**
 * No analytics inside the signed-in workspace.
 *
 * Route-gating the tracking observer and the consent banner in __root.tsx was
 * not enough: GA boots from an inline snippet in the server-rendered <head>,
 * which runs before any React gate. gtag.js therefore loaded on /admin,
 * /client and /me, and Consent Mode transmitted the workspace URL — with the
 * client organisation id in the query string — to Google (audit #8, TF8-03 and
 * TF8-04).
 *
 * The snippet is a string of JavaScript and cannot import the path list, so it
 * is built from the same array. These tests hold the two together.
 */
import { describe, expect, it } from "vitest";
import {
  HEAD_BOOT_SNIPPETS,
  WORKSPACE_PATH_PREFIXES,
  isWorkspacePath,
} from "@/lib/tracking/pixels";

const ga = () => HEAD_BOOT_SNIPPETS.find((s) => s.key === "ga4");

describe("isWorkspacePath", () => {
  it("matches each workspace root and its subtree", () => {
    for (const p of WORKSPACE_PATH_PREFIXES) {
      expect(isWorkspacePath(`/${p}`), `/${p}`).toBe(true);
      expect(isWorkspacePath(`/${p}/anything/deep`), `/${p}/…`).toBe(true);
    }
  });

  it("leaves the public site alone", () => {
    for (const p of ["/", "/platform", "/jobs", "/jobs/senior-engineer", "/apply/123", "/pricing"]) {
      expect(isWorkspacePath(p), p).toBe(false);
    }
  });

  it("does not match a public path that merely starts with a workspace word", () => {
    // /members is not /me, and /clients is not /client.
    expect(isWorkspacePath("/members")).toBe(false);
    expect(isWorkspacePath("/clients")).toBe(false);
    expect(isWorkspacePath("/administration")).toBe(false);
  });
});

describe("the GA head snippet", () => {
  it("is present", () => {
    expect(ga()?.children).toBeTruthy();
  });

  it("names every workspace prefix the runtime gate knows about", () => {
    const code = ga()!.children;
    for (const p of WORKSPACE_PATH_PREFIXES) {
      expect(code, `snippet does not mention /${p}`).toContain(`"/${p}"`);
    }
  });

  it("returns before booting gtag, and sets GA's kill switch", () => {
    const code = ga()!.children;
    // The order matters: the guard has to precede the script injection.
    const guardAt = code.indexOf("ga-disable-");
    const injectAt = code.indexOf("googletagmanager");
    expect(guardAt).toBeGreaterThan(-1);
    expect(injectAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(injectAt);
    expect(code).toContain("return;");
  });

  it("actually skips the boot on workspace paths and runs elsewhere", () => {
    // Execute the snippet against a fake window/document for each path, and
    // check whether it tried to append the gtag script.
    const run = (pathname: string) => {
      const appended: string[] = [];
      const win: Record<string, unknown> = {};
      const doc = {
        createElement: () => ({ setAttribute() {}, set src(v: string) { appended.push(v); } }),
        head: { appendChild() {} },
      };
      // The snippet assigns window.gtag and then calls bare `gtag(...)`,
      // relying on window being the global object. `with` reproduces that
      // binding inside the sandbox; new Function bodies are sloppy mode, so
      // it is allowed here.
      const fn = new Function(
        "window",
        "document",
        "location",
        `with (window) { ${ga()!.children} }`,
      );
      fn(win, doc, { pathname });
      return { appended, win };
    };

    for (const p of WORKSPACE_PATH_PREFIXES) {
      const { appended, win } = run(`/${p}/somewhere`);
      expect(appended, `gtag.js was injected on /${p}`).toEqual([]);
      expect(
        Object.keys(win).some((k) => k.startsWith("ga-disable-") && win[k] === true),
        `kill switch not set on /${p}`,
      ).toBe(true);
    }

    const publicRun = run("/jobs");
    expect(publicRun.appended.length, "gtag.js did not load on a public page").toBe(1);
    expect(publicRun.appended[0]).toContain("googletagmanager.com/gtag/js");
  });
});
