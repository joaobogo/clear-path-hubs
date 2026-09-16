/**
 * The job description builds the role, and never overwrites the client.
 *
 * The intake promised "upload the job description and TaaSFlow will build the
 * complete role blueprint" while doing neither: an uploaded file was attached
 * and ignored, and pasted text produced requirements ONLY — title, location,
 * compensation, seniority and employment type were still typed by hand (audit
 * 15 Sep: INT-010, INT-013, INT-014).
 *
 * Two things have to hold for the fix to be safe rather than merely clever:
 *
 *  1. Nothing the model returns is trusted. A value outside the product's own
 *     vocabulary, a placeholder like "not stated", a salary range that runs
 *     backwards — each is dropped rather than shown. A missing field is a
 *     field the client fills in, which is what happens today; an invented one
 *     is a lie about their role.
 *  2. Re-reading is non-destructive. The description is now re-read on every
 *     change, so if a re-parse could overwrite an answer the client had
 *     already given, typing would fight the parser.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BLUEPRINT_FIELD_ORDER,
  blueprintFieldCount,
  cleanBlueprint,
  cleanRequirements,
} from "@/lib/jd-blueprint";
import { COMP_CURRENCIES, WORK_MODELS } from "@/lib/express-intake-schema";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const f = (value: unknown, confidence = "high") => ({ value, confidence });

describe("the blueprint keeps only what it can stand behind", () => {
  it("reads a well-formed reply", () => {
    const b = cleanBlueprint({
      title: f("Senior Accountant"),
      seniority: f("senior"),
      location: f("Austin, TX"),
      workModel: f("hybrid"),
      employmentType: f("full_time"),
      salaryMin: f(95000),
      salaryMax: f(115000),
      currency: f("usd"),
      compensationPeriod: f("year"),
    });
    expect(b.title?.value).toBe("Senior Accountant");
    expect(b.seniority?.value).toBe("senior");
    expect(b.workModel?.value).toBe("hybrid");
    expect(b.salaryMin?.value).toBe(95000);
    expect(b.currency?.value, "currency is normalised to the product's casing").toBe("USD");
    expect(blueprintFieldCount(b)).toBe(9);
  });

  it("drops placeholders instead of writing them into the role", () => {
    for (const placeholder of ["", "  ", "not stated", "Unknown", "N/A", "none", "-"]) {
      const b = cleanBlueprint({ title: f(placeholder), location: f(placeholder) });
      expect(b.title, `"${placeholder}" must not become a title`).toBeUndefined();
      expect(b.location, `"${placeholder}" must not become a location`).toBeUndefined();
    }
  });

  it("refuses vocabulary the product does not speak", () => {
    const b = cleanBlueprint({
      seniority: f("rockstar"),
      workModel: f("work-from-anywhere"),
      employmentType: f("freelance-ish"),
      currency: f("XBT"),
      compensationPeriod: f("fortnight"),
    });
    expect(b.seniority).toBeUndefined();
    expect(b.workModel).toBeUndefined();
    expect(b.employmentType).toBeUndefined();
    expect(b.currency).toBeUndefined();
    expect(b.compensationPeriod).toBeUndefined();
  });

  it("only accepts vocabularies the rest of the app already uses", () => {
    for (const wm of WORK_MODELS) {
      expect(cleanBlueprint({ workModel: f(wm) }).workModel?.value).toBe(wm);
    }
    for (const c of COMP_CURRENCIES) {
      expect(cleanBlueprint({ currency: f(c) }).currency?.value).toBe(c);
    }
  });

  it("drops a salary range that runs backwards, rather than showing min > max", () => {
    const b = cleanBlueprint({ salaryMin: f(150000), salaryMax: f(90000) });
    expect(b.salaryMin).toBeUndefined();
    expect(b.salaryMax).toBeUndefined();
  });

  it("rejects numbers that are not money", () => {
    expect(cleanBlueprint({ salaryMin: f(0) }).salaryMin).toBeUndefined();
    expect(cleanBlueprint({ salaryMin: f(-5000) }).salaryMin).toBeUndefined();
    expect(cleanBlueprint({ salaryMin: f(999_999_999) }).salaryMin).toBeUndefined();
    // Formatted money is still money.
    expect(cleanBlueprint({ salaryMin: f("$95,000") }).salaryMin?.value).toBe(95000);
  });

  it("takes only a real ISO date", () => {
    expect(cleanBlueprint({ targetStartDate: f("2026-11-02") }).targetStartDate?.value).toBe(
      "2026-11-02",
    );
    for (const bad of ["ASAP", "Q1", "02/11/2026", "2026-13-40"]) {
      expect(cleanBlueprint({ targetStartDate: f(bad) }).targetStartDate).toBeUndefined();
    }
  });

  it("defaults an unrecognised confidence to low rather than assuming high", () => {
    expect(cleanBlueprint({ title: { value: "Analyst" } }).title?.confidence).toBe("low");
    expect(cleanBlueprint({ title: f("Analyst", "banana") }).title?.confidence).toBe("low");
  });

  it("survives a reply that is not a blueprint at all", () => {
    for (const junk of [null, undefined, "", 42, [], "sorry, I cannot help with that"]) {
      expect(cleanBlueprint(junk)).toEqual({});
    }
  });
});

describe("requirements keep the quality they already had", () => {
  it("tags, de-duplicates and bounds them", () => {
    const out = cleanRequirements([
      { text: "• Five years in audit", tag: "must_have" },
      { text: "Five years in audit", tag: "nice_to_have" },
      { text: "CPA licence", tag: "nice_to_have" },
      { text: "x", tag: "must_have" },
      { text: "Valid", tag: "not_a_tag" },
      { text: "NetSuite exposure", tag: "trainable" },
    ]);
    expect(out.map((r) => r.text)).toEqual([
      "Five years in audit",
      "CPA licence",
      "NetSuite exposure",
    ]);
    expect(out[0].tag, "the bullet marker is stripped, the tag is kept").toBe("must_have");
  });

  it("returns nothing for a malformed reply instead of throwing", () => {
    for (const junk of [null, undefined, "nope", 7, {}]) {
      expect(cleanRequirements(junk)).toEqual([]);
    }
  });
});

describe("re-reading never overwrites the client", () => {
  const intake = strip(src("src/routes/intake.tsx"));
  const applyBlock = intake.slice(
    intake.indexOf("const applyBlueprint"),
    intake.indexOf("const runJdParse"),
  );

  it("skips any field the client has edited", () => {
    expect(applyBlock).toMatch(/editedRef\.current\.has\(/);
  });

  it("skips any field that already holds a value", () => {
    expect(applyBlock).toMatch(/isEmpty/);
  });

  it("re-reads on the CONTENT of the description, not its length", () => {
    // Keying on length meant replacing a description with a different one of
    // the same length left the old suggestions in place (INT-012/INT-016).
    expect(intake).toMatch(/signature = `text:\$\{state\.roleTitle\.trim\(\)\}::\$\{jd\}`/);
    expect(intake, "the old length-keyed signature must be gone").not.toMatch(
      /::\$\{jd\.length\}/,
    );
  });

  it("debounces, so typing does not bill a model call per keystroke", () => {
    expect(intake).toMatch(/JD_REPARSE_DELAY_MS/);
    expect(intake).toMatch(/window\.clearTimeout\(timer\)/);
  });
});

describe("an uploaded file and a link are read, not just attached", () => {
  const intake = strip(src("src/routes/intake.tsx"));
  const endpoint = strip(src("src/routes/api/public/jd-requirements.ts"));

  it("uploading runs the parser", () => {
    const pick = intake.slice(intake.indexOf("const onPickFile"), intake.indexOf("const submit ="));
    expect(pick, "the file must be read, not only stored").toMatch(/runJdParse\(/);
  });

  it("the endpoint accepts a file and a url, not only text", () => {
    expect(endpoint).toMatch(/file: fileSchema\.optional\(\)/);
    expect(endpoint).toMatch(/url: z\.string\(\)/);
    expect(endpoint, "text is no longer the only accepted input").toMatch(
      /jobDescriptionText\.length > 0 \|\| v\.file \|\| v\.url/,
    );
  });

  it("file text comes from the one extractor this product already uses", () => {
    // Imported lazily, so the PDF/DOCX libraries only load on a request that
    // actually carries a file.
    expect(endpoint, "a second extractor would drift from the CV one").toMatch(
      /import\("@\/lib\/cv-extractor\.server"\)/,
    );
  });

  it("an unreadable file says so instead of silently doing nothing", () => {
    expect(endpoint).toMatch(/jd_unreadable/);
    expect(endpoint).toMatch(/paste the text instead/);
  });

  it("only fetches http(s) links", () => {
    expect(endpoint).toMatch(/protocol !== "https:" && .*protocol !== "http:"/);
  });

  it("keeps the existing suggestions contract intact for the old caller", () => {
    expect(endpoint).toMatch(/ok: true,\s*\n?\s*suggestions,/);
  });
});

describe("the field order the review screen reads", () => {
  it("covers every field a blueprint can carry", () => {
    const b = cleanBlueprint({
      title: f("A"), seniority: f("mid"), location: f("Lisbon"), workModel: f("remote"),
      employmentType: f("contract"), salaryMin: f(1), salaryMax: f(2), currency: f("EUR"),
      compensationPeriod: f("month"), team: f("Finance"), reportingLine: f("CFO"),
      targetStartDate: f("2026-01-05"), requiresExistingWorkAuth: f(true),
      screeningQuestions: f(["Why this role?"]),
    });
    for (const k of Object.keys(b)) {
      expect(BLUEPRINT_FIELD_ORDER, `${k} is missing from the display order`).toContain(k);
    }
    expect(blueprintFieldCount(b)).toBe(BLUEPRINT_FIELD_ORDER.length);
  });
});
