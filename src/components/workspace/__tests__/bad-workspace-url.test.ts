/**
 * A bad workspace id in the URL is a bad link, not a form error.
 *
 * `/client?org=<junk>` rendered "Some details need fixing / Check the
 * highlighted fields. Everything you typed was kept." — form-validation copy,
 * on a page with no form, where nothing had been typed. Two separate faults
 * produced it (audit 16 Sep, finding 10):
 *
 *  1. `/client` validated its search with a BARE zod object, so a malformed
 *     `?org=` threw out of validateSearch. TanStack wraps that as a
 *     SearchParamError whose message is the raw zod JSON, and the error
 *     taxonomy reads the word "validation" in it. `/client` is the layout for
 *     every `/client/*` page, so one junk query string took out the subtree.
 *  2. The recovery link rebuilt the same URL, because on a validation failure
 *     the RAW search is what a non-strict `useSearch` returns — so "Back to
 *     dashboard" failed the same way, with no way out but the address bar.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceLinkSearch } from "@/components/workspace/route-states";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const ORG = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed";

describe("the recovery link never hands back a rejected workspace id", () => {
  it("drops an org that is not a workspace id", () => {
    for (const bad of ["not-a-uuid", "0c86fa1b", "", "  ", "../../etc", "null", "undefined"]) {
      expect(workspaceLinkSearch({ org: bad }), bad).toBeUndefined();
    }
  });

  it("keeps a valid one, and the preview alongside it", () => {
    expect(workspaceLinkSearch({ org: ORG })).toEqual({ org: ORG, preview: undefined });
    expect(workspaceLinkSearch({ org: ORG, preview: "client_viewer" })).toEqual({
      org: ORG,
      preview: "client_viewer",
    });
  });

  it("accepts either case, as the router does", () => {
    expect(workspaceLinkSearch({ org: ORG.toUpperCase() })?.org).toBe(ORG.toUpperCase());
  });

  it("returns nothing when there is no org at all", () => {
    expect(workspaceLinkSearch({})).toBeUndefined();
  });
});

describe("the client layout cannot throw on a malformed query string", () => {
  const route = src("src/routes/_authenticated/client.tsx");

  it("validates search through the adapter, like its sibling routes", () => {
    // A bare `validateSearch: searchSchema` throws; zodValidator + fallback
    // drops the offending field and lets the page load.
    expect(route).toMatch(/validateSearch:\s*zodValidator\(searchSchema\)/);
    expect(route, "a bare schema throws instead of falling back").not.toMatch(
      /validateSearch:\s*searchSchema\b/,
    );
  });

  it("falls back per field, so a bad preview cannot discard a good org", () => {
    // An object-level `.catch({})` would throw away BOTH values.
    expect(route).toMatch(/org:\s*fallback\(/);
    expect(route).toMatch(/preview:\s*fallback\(/);
    expect(route).not.toMatch(/\}\)\.catch\(\{\}\)/);
  });

  it("both recovery components use the guarded link builder", () => {
    const states = src("src/components/workspace/route-states.tsx");
    expect(states.match(/workspaceLinkSearch\(search\)/g) ?? []).toHaveLength(2);
    expect(states, "the raw org must not be forwarded again").not.toMatch(
      /linkSearch = search\.org \? \{ org: search\.org/,
    );
  });
});
