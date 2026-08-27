import { describe, expect, it } from "vitest";
import { toggleWrap, togglePrefix } from "@/components/intake/markdown-toolbar";

const sel = (start: number, end: number) => ({ start, end });

describe("toggleWrap", () => {
  it("wraps the selection and keeps it selected", () => {
    const r = toggleWrap("hire a senior dev", sel(7, 13), "**");
    expect(r.next).toBe("hire a **senior** dev");
    expect(r.next.slice(r.selection.start, r.selection.end)).toBe("senior");
  });

  it("unwraps when the markers sit just outside the selection", () => {
    const r = toggleWrap("hire a **senior** dev", sel(9, 15), "**");
    expect(r.next).toBe("hire a senior dev");
    expect(r.next.slice(r.selection.start, r.selection.end)).toBe("senior");
  });

  it("unwraps when the markers are inside the selection", () => {
    const r = toggleWrap("hire a **senior** dev", sel(7, 17), "**");
    expect(r.next).toBe("hire a senior dev");
    expect(r.next.slice(r.selection.start, r.selection.end)).toBe("senior");
  });

  it("inserts an empty pair when nothing is selected", () => {
    const r = toggleWrap("ab", sel(1, 1), "**");
    expect(r.next).toBe("a****b");
    expect(r.selection).toEqual({ start: 3, end: 3 });
  });

  it("does not mistake a single marker for a wrapped pair", () => {
    const r = toggleWrap("2 * 3", sel(0, 5), "*");
    expect(r.next).toBe("*2 * 3*");
  });
});

describe("togglePrefix", () => {
  const bullet = { fn: () => "- ", re: /^[-*]\s+/ };

  it("prefixes every line the selection touches", () => {
    const r = togglePrefix("React\nSQL\nDocker", sel(0, 12), bullet.fn, bullet.re);
    expect(r.next).toBe("- React\n- SQL\n- Docker");
  });

  it("stops at the line the selection ends on", () => {
    // End index 9 is the newline after SQL, so Docker is not touched.
    const r = togglePrefix("React\nSQL\nDocker", sel(0, 9), bullet.fn, bullet.re);
    expect(r.next).toBe("- React\n- SQL\nDocker");
  });

  it("removes the prefix when every line already has it", () => {
    const r = togglePrefix("- React\n- SQL", sel(0, 13), bullet.fn, bullet.re);
    expect(r.next).toBe("React\nSQL");
  });

  it("adds rather than removes when only some lines have it", () => {
    const r = togglePrefix("- React\nSQL", sel(0, 11), bullet.fn, bullet.re);
    expect(r.next).toBe("- - React\n- SQL");
  });

  it("expands a caret to the whole line it sits on", () => {
    const r = togglePrefix("React\nSQL", sel(2, 2), bullet.fn, bullet.re);
    expect(r.next).toBe("- React\nSQL");
  });

  it("numbers a list from one", () => {
    const r = togglePrefix("A\nB\nC", sel(0, 5), (i) => `${i + 1}. `, /^\d+\.\s+/);
    expect(r.next).toBe("1. A\n2. B\n3. C");
  });

  it("leaves blank lines alone", () => {
    const r = togglePrefix("React\n\nSQL", sel(0, 10), bullet.fn, bullet.re);
    expect(r.next).toBe("- React\n\n- SQL");
  });

  it("does not disturb text outside the touched lines", () => {
    const value = "Intro\nReact\nOutro";
    const r = togglePrefix(value, sel(6, 11), bullet.fn, bullet.re);
    expect(r.next).toBe("Intro\n- React\nOutro");
  });
});
