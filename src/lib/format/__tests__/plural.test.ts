import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "../plural";

describe("pluralization helpers", () => {
  describe("plural", () => {
    it("returns singular form for 1", () => {
      expect(plural(1, "candidate")).toBe("1 candidate");
      expect(plural(1, "role")).toBe("1 role");
      expect(plural(1, "entry", "entries")).toBe("1 entry");
    });

    it("returns plural form for 0 or >1", () => {
      expect(plural(0, "candidate")).toBe("0 candidates");
      expect(plural(2, "candidate")).toBe("2 candidates");
      expect(plural(10, "role")).toBe("10 roles");
      expect(plural(2, "entry", "entries")).toBe("2 entries");
    });
  });

  describe("pluralWord", () => {
    it("returns singular word for 1", () => {
      expect(pluralWord(1, "candidate")).toBe("candidate");
      expect(pluralWord(1, "entry", "entries")).toBe("entry");
    });

    it("returns plural word for 0 or >1", () => {
      expect(pluralWord(0, "candidate")).toBe("candidates");
      expect(pluralWord(2, "candidate")).toBe("candidates");
      expect(pluralWord(2, "entry", "entries")).toBe("entries");
    });
  });
});
