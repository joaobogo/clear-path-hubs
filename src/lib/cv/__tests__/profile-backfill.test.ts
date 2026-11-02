import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCertificationNoise,
  isFieldProtected,
  normalizeParsedCertifications,
  normalizeParsedYears,
  planProfileBackfill,
  writeProfileBackfill,
  type ProfileBackfillRow,
} from "@/lib/cv/profile-backfill";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";
import { orderCertificationsForRole } from "@/lib/client/certification-order";
import { mergeReapplyConsent } from "@/lib/apply-consent";

/**
 * Hughes research, item 5: "Parser output never reaches the profile."
 * Each profile below is the backfill-relevant slice of the live row for a
 * Mushroom Harvesting Manager applicant as it stood on 2 Nov 2026 before the
 * hand edits of 11:39-11:42: consent.extracted held the certifications, the
 * certifications column was [] (NOT NULL DEFAULT '[]' on live; NULL is tested
 * separately), and the client page showed none of them.
 */
const noFacts = { years_experience: null, linkedin_url: null, languages: [], skills: [] };

const vijay = {
  certifications: [],
  years_experience: 5,
  linkedin_url: "https://www.linkedin.com/in/vijay-mane-a77805211/",
  languages: [],
  skills: ["Crop assessment"],
  consent: {
    provenance: { certifications: { source: "cv_parsed" } },
    extracted: {
      certifications: [
        "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
        "Practical Shiitake Mushroom Production Training",
      ],
    },
  },
};

const daim = {
  certifications: [],
  years_experience: null,
  linkedin_url: "https://linkedin.com/in/daimahmedshah/",
  languages: [],
  skills: [],
  consent: {
    extracted: {
      certifications: ["IOSH Managing Safely", "LANTRA Temporary Traffic Management"],
      years_of_experience: 5,
    },
  },
};

const anna = {
  certifications: [],
  years_experience: 3,
  linkedin_url: "https://www.linkedin.com/in/anna-2809m",
  consent: {
    extracted: {
      certifications: [
        "Germplasm Value Preservation (GVP)",
        "HSE Policy & Standards",
        "Lift Truck Operator",
        "Fire Safety",
        "Corporate Security",
        "Cybersecurity Awareness",
        "AI at Syngenta",
        "HACCP",
        "ISO/IEC 17025 Awareness",
        "Food Safety & Hygiene",
        "Food Labelling / FSS- related training",
        "FSSC / food-safety management training",
      ],
    },
  },
};

const chiedza = {
  certifications: [],
  years_experience: null,
  linkedin_url: null,
  consent: {
    provenance: { certifications: { source: "cv_parsed", confidence: 0.8 } },
    extracted: { certifications: ["Driver’s license code 10"] },
  },
};

/**
 * GMM applicant, approved and client-visible: the lowest-confidence parsed
 * list on live (0.75), two award lines and a fragment.
 */
const basma = {
  certifications: [],
  years_experience: null,
  linkedin_url: null,
  consent: {
    provenance: { certifications: { source: "cv_parsed", parser: "llm", confidence: 0.75 } },
    extracted: {
      certifications: [
        "Effie’s 2023 award Silver (Beverages Category) and Bronze (Influencers Marketing)",
        "Cannes Lions",
        "Shorts",
      ],
    },
  },
};

const mushroomRole = {
  id: "9466d8ac-0b74-4b14-94e9-0e9d56021fa2",
  title: "Mushroom Harvesting Manager",
  requirements: [
    { kind: "must_have", label: "Hands-on mushroom picking experience" },
    { kind: "must_have", label: "Previous supervisory experience on a mushroom farm" },
    { kind: "must_have", label: "Strong people management and communication skills, written and verbal" },
    { kind: "must_have", label: "Excellent organisational and interpersonal skills" },
    { kind: "must_have", label: "Good basic IT and numerical skills" },
    { kind: "must_have", label: "Flexible approach to working hours, including weekends and peak overtime" },
  ],
  preferred_requirements: [
    { kind: "nice_to_have", label: "Previous experience as a Harvesting Manager in the mushroom industry" },
    { kind: "nice_to_have", label: "Experience managing pick rates, manning plans and agency labour" },
    { kind: "nice_to_have", label: "Food safety team experience (HACCP, TACCP, VACCP, BRC)" },
    { kind: "nice_to_have", label: "Advanced Food Hygiene qualification" },
    { kind: "nice_to_have", label: "Degree-level education" },
  ],
};

describe("planProfileBackfill — the Hughes Mushrooms applicants", () => {
  it("writes Vijay's two mushroom courses and leaves what he already has", () => {
    const patch = planProfileBackfill(vijay, noFacts);
    expect(patch.certifications?.map((c) => c.name)).toEqual([
      "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      "Practical Shiitake Mushroom Production Training",
    ]);
    expect(patch.certifications?.[0]).toEqual({
      name: "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      issuer: null,
      date: null,
    });
    expect(Object.keys(patch)).toEqual(["certifications"]);
  });

  it("writes Daim's IOSH and LANTRA and the five years hydration parsed", () => {
    const patch = planProfileBackfill(daim, noFacts);
    expect(patch.certifications?.map((c) => c.name)).toEqual([
      "IOSH Managing Safely",
      "LANTRA Temporary Traffic Management",
    ]);
    expect(patch.years_experience).toBe(5);
    expect(patch.linkedin_url).toBeUndefined();
  });

  it("writes all twelve of Anna's, HACCP and FSSC included", () => {
    const patch = planProfileBackfill(anna, noFacts);
    const names = patch.certifications?.map((c) => c.name) ?? [];
    expect(names).toHaveLength(12);
    expect(names).toContain("HACCP");
    expect(names).toContain("FSSC / food-safety management training");
    expect(patch.years_experience).toBeUndefined();
  });

  it("writes Chiedza's driving licence (confidence 0.8, at the floor)", () => {
    const patch = planProfileBackfill(chiedza, noFacts);
    expect(patch.certifications).toEqual([
      { name: "Driver’s license code 10", issuer: null, date: null },
    ]);
    // A NULL column (older rows) is a gap too.
    expect(planProfileBackfill({ ...chiedza, certifications: null }, noFacts).certifications).toHaveLength(1);
  });

  it("copies none of Basma's award lines or the fragment 'Shorts'", () => {
    expect(planProfileBackfill(basma, noFacts).certifications).toBeUndefined();
    // Not only the confidence floor: the same list at 0.9 is still all noise.
    const confident = {
      ...basma,
      consent: { ...basma.consent, provenance: { certifications: { source: "cv_parsed", confidence: 0.9 } } },
    };
    expect(planProfileBackfill(confident, noFacts).certifications).toBeUndefined();
  });

  it("skips a whole parsed list below the 0.8 confidence floor", () => {
    const low = {
      ...daim,
      consent: { ...daim.consent, provenance: { certifications: { source: "cv_parsed", confidence: 0.79 } } },
    };
    expect(planProfileBackfill(low, noFacts).certifications).toBeUndefined();
    // Years are a separate field and still fill.
    expect(planProfileBackfill(low, noFacts).years_experience).toBe(5);
  });

  it("refreshing evidence without a CV fact still repairs the profile from consent.extracted", () => {
    expect(planProfileBackfill(daim, null).certifications).toHaveLength(2);
  });
});

describe("planProfileBackfill — additive only", () => {
  it("never replaces certifications the candidate or a recruiter entered", () => {
    const patch = planProfileBackfill(
      { ...daim, certifications: [{ name: "CSCS Card", issuer: "CITB", date: "2024" }] },
      noFacts,
    );
    expect(patch.certifications).toBeUndefined();
  });

  it("never replaces a stored years_experience, LinkedIn, languages or skills", () => {
    const patch = planProfileBackfill(
      {
        certifications: [{ name: "x" }],
        years_experience: 7,
        linkedin_url: "https://linkedin.com/in/own-entry",
        // A language line stored as text is a value, not a gap.
        languages: "English (native), Shona (fluent)",
        skills: ["Harvest planning"],
        consent: { extracted: { years_of_experience: 12 } },
      },
      {
        years_experience: 10,
        linkedin_url: "https://linkedin.com/in/from-cv",
        languages: ["English"],
        skills: ["Picking"],
      },
    );
    expect(patch).toEqual({});
  });

  it("leaves an empty field alone when a person locked or corrected it", () => {
    expect(
      planProfileBackfill({ ...daim, consent: { ...daim.consent, locked_fields: ["certifications"] } }, noFacts)
        .certifications,
    ).toBeUndefined();
    expect(
      planProfileBackfill(
        {
          ...daim,
          consent: { ...daim.consent, provenance: { certifications: { source: "admin_corrected" } } },
        },
        noFacts,
      ).certifications,
    ).toBeUndefined();
    expect(
      planProfileBackfill(
        {
          ...daim,
          consent: { ...daim.consent, provenance: { years_of_experience: { source: "user_confirmed" } } },
        },
        noFacts,
      ).years_experience,
    ).toBeUndefined();
  });

  it("prefers the deterministic CV fact over the model's years", () => {
    expect(planProfileBackfill(daim, { ...noFacts, years_experience: 6 }).years_experience).toBe(6);
  });

  it("fills LinkedIn, languages and skills from the CV only when empty", () => {
    const patch = planProfileBackfill(
      { certifications: [], years_experience: null, linkedin_url: "", languages: [], skills: null, consent: null },
      {
        years_experience: null,
        linkedin_url: "https://linkedin.com/in/someone",
        languages: ["English (fluent)"],
        skills: ["Harvest planning"],
      },
    );
    expect(patch).toEqual({
      linkedin_url: "https://linkedin.com/in/someone",
      languages: ["English (fluent)"],
      skills: ["Harvest planning"],
    });
  });

  it("returns nothing for a missing profile", () => {
    expect(planProfileBackfill(null, noFacts)).toEqual({});
  });
});

describe("planProfileBackfill — once per CV", () => {
  const cv = "636d2a6c-f50b-4c52-804f-2eef521bdf9b";
  const stamped = (field: string, cvFileId: string | null) => ({
    ...vijay,
    current_cv_file_id: cv,
    consent: {
      ...vijay.consent,
      backfilled: { [field]: { at: "2026-11-02T12:00:00.000Z", cv_file_id: cvFileId, source: "auto_pipeline" } },
    },
  });

  it("does not refill a list a person cleared after it was filled from this CV", () => {
    expect(planProfileBackfill(stamped("certifications", cv), noFacts).certifications).toBeUndefined();
  });

  it("fills again from a new CV when the field is empty", () => {
    expect(planProfileBackfill(stamped("certifications", "older-cv"), noFacts).certifications).toHaveLength(2);
  });

  it("a marker on one field does not hold back the others", () => {
    const patch = planProfileBackfill(stamped("languages", cv), { ...noFacts, skills: [], languages: ["Marathi"] });
    expect(patch.languages).toBeUndefined();
    expect(patch.certifications).toHaveLength(2);
  });
});

/**
 * An in-memory candidate_profiles row behind the slice of the Supabase query
 * builder writeProfileBackfill uses. Filters are evaluated as PostgREST would:
 * `is.null`, and `eq` on a jsonb column compares the JSON text.
 */
function fakeProfileDb(initial: Record<string, unknown>) {
  const JSON_COLS = new Set(["certifications", "languages", "skills", "consent"]);
  const row: Record<string, unknown> = { updated_at: "2026-11-02T12:00:00.000001+00:00", ...structuredClone(initial) };
  let tick = 1;
  type Op = {
    kind: "select" | "update";
    payload?: Record<string, unknown>;
    filters: Array<["eq" | "is", string, unknown]>;
    single?: boolean;
  };
  const ops: Op[] = [];
  const hooks: { beforeUpdate?: (op: Op) => void } = {};
  const matches = (filters: Op["filters"]) =>
    filters.every(([kind, col, val]) =>
      kind === "is"
        ? row[col] == null
        : JSON_COLS.has(col)
          ? JSON.stringify(row[col]) === val
          : String(row[col]) === String(val),
    );
  const run = (op: Op) => {
    ops.push(op);
    if (op.kind === "update") {
      hooks.beforeUpdate?.(op);
      if (!matches(op.filters)) return { data: [], error: null };
      Object.assign(row, structuredClone(op.payload));
      row.updated_at = `2026-11-02T12:00:0${tick++}.000001+00:00`;
      return { data: [{ id: row.id }], error: null };
    }
    const hit = matches(op.filters);
    return op.single
      ? { data: hit ? structuredClone(row) : null, error: null }
      : { data: hit ? [structuredClone(row)] : [], error: null };
  };
  const builder = () => {
    const op: Op = { kind: "select", filters: [] };
    const b = {
      update(p: Record<string, unknown>) { op.kind = "update"; op.payload = p; return b; },
      select() { return b; },
      eq(c: string, v: unknown) { op.filters.push(["eq", c, v]); return b; },
      is(c: string, v: unknown) { op.filters.push(["is", c, v]); return b; },
      maybeSingle() { op.single = true; return b; },
      then<A, B>(res: (v: ReturnType<typeof run>) => A, rej?: (e: unknown) => B) {
        return Promise.resolve().then(() => run(op)).then(res, rej);
      },
    };
    return b;
  };
  return { db: { from: () => builder() }, row, ops, hooks };
}

describe("writeProfileBackfill — compare-and-set, never a lost update", () => {
  const cv = "4ed16f15-d91d-4795-81ff-1545a4da8947";
  const daimRow = {
    id: "p-daim",
    ...daim,
    linkedin_url: "",
    current_cv_file_id: cv,
  };
  const facts = { ...noFacts, linkedin_url: "https://linkedin.com/in/daimahmedshah/", skills: ["Lean management"] };

  it("guards every update on the value the plan read", async () => {
    const { db, ops, row } = fakeProfileDb(daimRow);
    const observed = structuredClone(daimRow) as ProfileBackfillRow;
    const patch = planProfileBackfill(observed, facts);
    const res = await writeProfileBackfill(db, "p-daim", patch, observed, { source: "auto_pipeline" });

    const updates = ops.filter((o) => o.kind === "update" && !("consent" in (o.payload ?? {})));
    expect(updates.map((o) => [Object.keys(o.payload ?? {})[0], o.filters])).toEqual([
      ["certifications", [["eq", "id", "p-daim"], ["eq", "certifications", "[]"]]],
      ["years_experience", [["eq", "id", "p-daim"], ["is", "years_experience", null]]],
      // Plan and write agree on a blank string: "" is a gap and the guard is eq "".
      ["linkedin_url", [["eq", "id", "p-daim"], ["eq", "linkedin_url", ""]]],
      ["skills", [["eq", "id", "p-daim"], ["eq", "skills", "[]"]]],
    ]);
    expect(res.written).toEqual(["certifications", "years_experience", "linkedin_url", "skills"]);
    expect(row.linkedin_url).toBe("https://linkedin.com/in/daimahmedshah/");
    expect((row.certifications as Array<{ name: string }>).map((c) => c.name)).toEqual([
      "IOSH Managing Safely",
      "LANTRA Temporary Traffic Management",
    ]);
  });

  it("keeps what the candidate saved while the insights call ran", async () => {
    const { db, row } = fakeProfileDb(daimRow);
    const observed = structuredClone(daimRow) as ProfileBackfillRow;
    const patch = planProfileBackfill(observed, facts);
    // The candidate saves their own certificate between the read and the write.
    row.certifications = [{ name: "CSCS Card", issuer: "CITB", date: "2024" }];
    const res = await writeProfileBackfill(db, "p-daim", patch, observed);
    expect(row.certifications).toEqual([{ name: "CSCS Card", issuer: "CITB", date: "2024" }]);
    expect(res.written).not.toContain("certifications");
    // The other gaps still fill.
    expect(res.written).toContain("years_experience");
  });

  it("records the fields it wrote with their CV, so a cleared list stays cleared", async () => {
    const { db, row } = fakeProfileDb(daimRow);
    const observed = structuredClone(daimRow) as ProfileBackfillRow;
    const now = new Date("2026-11-02T12:30:00.000Z");
    const res = await writeProfileBackfill(db, "p-daim", planProfileBackfill(observed, facts), observed, {
      now,
      source: "auto_pipeline",
    });
    expect(res.marked).toBe(true);
    const consent = row.consent as Record<string, unknown>;
    expect(consent.extracted).toEqual(daim.consent.extracted);
    expect((consent.backfilled as Record<string, unknown>).certifications).toEqual({
      at: "2026-11-02T12:30:00.000Z",
      cv_file_id: cv,
      source: "auto_pipeline",
    });

    // The candidate clears the list; the next run does not bring it back.
    row.certifications = [];
    expect(planProfileBackfill(row as ProfileBackfillRow, facts).certifications).toBeUndefined();
    // A new CV may fill the (still empty) field again.
    expect(
      planProfileBackfill({ ...(row as ProfileBackfillRow), current_cv_file_id: "new-cv" }, facts).certifications,
    ).toHaveLength(2);
  });

  it("skips the marker rather than overwrite a consent change made meanwhile", async () => {
    const { db, row, hooks } = fakeProfileDb(daimRow);
    const observed = structuredClone(daimRow) as ProfileBackfillRow;
    hooks.beforeUpdate = (op) => {
      if (op.payload && "consent" in op.payload) {
        // Another writer (hydration for a second role) lands first.
        row.consent = { ...(row.consent as object), hydrated_at: "2026-11-02T12:31:00.000Z" };
        row.updated_at = "2026-11-02T12:31:00.000001+00:00";
      }
    };
    const res = await writeProfileBackfill(db, "p-daim", planProfileBackfill(observed, facts), observed);
    expect(res.written.length).toBeGreaterThan(0);
    expect(res.marked).toBe(false);
    expect((row.consent as Record<string, unknown>).hydrated_at).toBe("2026-11-02T12:31:00.000Z");
    expect((row.consent as Record<string, unknown>).backfilled).toBeUndefined();
  });

  it("writes nothing and records nothing for an empty plan", async () => {
    const { db, ops } = fakeProfileDb(daimRow);
    const res = await writeProfileBackfill(db, "p-daim", {}, daimRow);
    expect(res).toEqual({ written: [], marked: false });
    expect(ops).toHaveLength(0);
  });
});

describe("isCertificationNoise — same table as the SQL in scripts/backfill/0001a", () => {
  // Checked against live Postgres with the 0001a/0001b expressions (2 Nov 2026).
  const table: Array<[string, boolean]> = [
    ["Effie’s 2023 award Silver (Beverages Category) and Bronze (Influencers Marketing)", true],
    ["Cannes Lions", true],
    ["Shorts", true],
    ["HACCP", false],
    ["IOSH", false],
    ["CFA", false],
    ["Level 2 Award in Food Safety", false],
    ["CSCS Gold Card", false],
    ["Forklift", false],
    ["Scrum", true],
    ["Prince2", false],
    ["NEBOSH Award", false],
    ["Duke of Edinburgh Gold Award", true],
    ["Shortlisted, Dubai Lynx", true],
    ["ab", true],
    ["CompTIA", false],
  ];
  it.each(table)("%s → noise: %s", (name, noise) => {
    expect(isCertificationNoise(name)).toBe(noise);
  });

  it("keeps every certification the live parse produced for the other 25 profiles", () => {
    for (const name of [
      ...anna.consent.extracted.certifications,
      ...daim.consent.extracted.certifications,
      ...vijay.consent.extracted.certifications,
      "Driver’s license code 10",
      "Pakistan Veterinary Medical Council (PVMC)",
      "German Class B driving licence",
      "Google Certification",
      "C.A Foundation",
      "Power BI (2022)",
      "Certified Clever Tap",
    ]) {
      expect(isCertificationNoise(name)).toBe(false);
    }
  });
});

describe("normalizeParsedCertifications", () => {
  it("maps objects with alias keys onto name/issuer/date", () => {
    expect(
      normalizeParsedCertifications([
        { title: "Food Hygiene Level 3", organization: "  Highfield ", year: 2021 },
        { name: "IOSH Managing Safely", issuer: "IOSH", date: "2023-04" },
      ]),
    ).toEqual([
      { name: "Food Hygiene Level 3", issuer: "Highfield", date: "2021" },
      { name: "IOSH Managing Safely", issuer: "IOSH", date: "2023-04" },
    ]);
  });

  it("drops blanks, collapses whitespace and keeps repeats once", () => {
    expect(
      normalizeParsedCertifications(["  HACCP ", "haccp", "", null, 7, { issuer: "no name" }, "Fire\n Safety"]),
    ).toEqual([
      { name: "HACCP", issuer: null, date: null },
      { name: "Fire Safety", issuer: null, date: null },
    ]);
  });

  it("caps the list at the profile editor's limit of 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Course ${i}`);
    expect(normalizeParsedCertifications(many)).toHaveLength(50);
  });

  it("reads nothing from a non-list", () => {
    expect(normalizeParsedCertifications(undefined)).toEqual([]);
    expect(normalizeParsedCertifications({})).toEqual([]);
  });
});

describe("normalizeParsedYears", () => {
  it("rounds down and keeps 1..60", () => {
    expect(normalizeParsedYears(5)).toBe(5);
    expect(normalizeParsedYears(4.6)).toBe(4);
    expect(normalizeParsedYears("5+")).toBe(5);
    expect(normalizeParsedYears(0)).toBeNull();
    expect(normalizeParsedYears(0.5)).toBeNull();
    expect(normalizeParsedYears(61)).toBeNull();
    expect(normalizeParsedYears("five")).toBeNull();
    expect(normalizeParsedYears(null)).toBeNull();
  });
});

describe("isFieldProtected", () => {
  it("is false without consent and true for any locked alias", () => {
    expect(isFieldProtected(null, ["certifications"])).toBe(false);
    expect(isFieldProtected({ locked_fields: ["years_of_experience"] }, ["years_experience", "years_of_experience"])).toBe(true);
  });
});

describe("the client workspace sees the backfilled certifications", () => {
  function clientRow(certifications: unknown, positions: Record<string, unknown> = {
    id: "p1", title: "Mushroom Harvesting Manager", requirements: [], preferred_requirements: [],
  }) {
    return {
      id: "m1",
      stage: "delivered",
      delivered_at: "2026-11-02T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      candidate_profiles: { full_name: "Vijay Mane", certifications, updated_at: "2026-11-02T00:00:00Z" },
      positions,
    };
  }

  it("shows Vijay's courses once the plan is written", () => {
    const written = planProfileBackfill(vijay, noFacts).certifications;
    const dto = toClientCandidateDTO(clientRow(written));
    expect(dto.certifications.map((c) => c.name)).toEqual([
      "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      "Practical Shiitake Mushroom Production Training",
    ]);
  });

  it("shows a certification stored as a plain string instead of dropping it", () => {
    const dto = toClientCandidateDTO(clientRow(["IOSH Managing Safely", { name: "LANTRA", issuer: "Lantra" }, "  "]));
    expect(dto.certifications).toEqual([
      { name: "IOSH Managing Safely", issuer: null, date: null },
      { name: "LANTRA", issuer: "Lantra", date: null },
    ]);
  });
  it("shows all twelve of Anna's, FSSC and the food-safety courses included, role-relevant first", () => {
    const written = planProfileBackfill(anna, noFacts).certifications;
    const dto = toClientCandidateDTO(clientRow(written, mushroomRole));
    const names = dto.certifications.map((c) => c.name);
    expect(names).toHaveLength(12);
    expect(names).toContain("FSSC / food-safety management training");
    expect(names).toContain("ISO/IEC 17025 Awareness");
    expect(names).toContain("Food Labelling / FSS- related training");
    // The role asks for food safety, HACCP and food hygiene: those lead.
    expect(names.slice(0, 5)).toEqual([
      "Food Safety & Hygiene",
      "FSSC / food-safety management training",
      "Fire Safety",
      "HACCP",
      "Food Labelling / FSS- related training",
    ]);
    // Everything else keeps the stored order.
    expect(names.slice(5)).toEqual([
      "Germplasm Value Preservation (GVP)",
      "HSE Policy & Standards",
      "Lift Truck Operator",
      "Corporate Security",
      "Cybersecurity Awareness",
      "AI at Syngenta",
      "ISO/IEC 17025 Awareness",
    ]);
  });

  it("shows more than eight certifications, up to the editor's cap of 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `Course ${i + 1}` }));
    expect(toClientCandidateDTO(clientRow(many)).certifications).toHaveLength(50);
  });
});

describe("orderCertificationsForRole", () => {
  it("keeps the stored order when the role names nothing they share", () => {
    const certs = [{ name: "B" }, { name: "A" }, { name: "C" }];
    expect(orderCertificationsForRole(certs, { title: "Analyst", requirements: [] })).toEqual(certs);
    expect(orderCertificationsForRole(certs, null)).toEqual(certs);
  });

  it("reads plain-string requirements and the issuer", () => {
    const certs = [
      { name: "First Aid at Work", issuer: null },
      { name: "Managing Safely", issuer: "IOSH" },
    ];
    expect(
      orderCertificationsForRole(certs, { title: "Site Lead", requirements: ["IOSH or NEBOSH"] }).map((c) => c.name),
    ).toEqual(["Managing Safely", "First Aid at Work"]);
  });
});

describe("mergeReapplyConsent", () => {
  it("keeps parsed facts, provenance and locks when a verified owner re-applies", () => {
    const existing = {
      terms: true,
      network_opt_in: false,
      created_at: "2026-10-01T00:00:00.000Z",
      extracted: anna.consent.extracted,
      provenance: { certifications: { source: "cv_parsed", confidence: 0.95 } },
      locked_fields: ["skills"],
      backfilled: { certifications: { at: "2026-11-02T12:00:00.000Z", cv_file_id: "cv1", source: "auto_pipeline" } },
    };
    const merged = mergeReapplyConsent(existing, true, new Date("2026-11-03T09:00:00.000Z"));
    expect(merged).toEqual({
      ...existing,
      terms: true,
      network_opt_in: true,
      updated_at: "2026-11-03T09:00:00.000Z",
    });
  });

  it("starts from nothing when there was no consent object", () => {
    expect(mergeReapplyConsent(null, false, new Date("2026-11-03T09:00:00.000Z"))).toEqual({
      terms: true,
      network_opt_in: false,
      updated_at: "2026-11-03T09:00:00.000Z",
    });
  });
});

describe("scripts/backfill: the dry run cannot write", () => {
  const dir = join(process.cwd(), "scripts", "backfill");
  const dry = readFileSync(join(dir, "0001a_profile_certifications_dry_run.sql"), "utf8");
  const apply = readFileSync(join(dir, "0001b_profile_certifications_apply.sql"), "utf8");
  const code = (sql: string) => sql.replace(/--.*$/gm, "");

  it("holds SELECTs only, so running the whole file changes nothing", () => {
    expect(code(dry)).not.toMatch(/\b(UPDATE|INSERT|DELETE|BEGIN|COMMIT|ALTER|TRUNCATE)\b/i);
    expect(code(dry)).toMatch(/\bSELECT\b/);
  });

  it("the apply file uses exactly the dry run's selection rules", () => {
    const rules = (sql: string) => {
      const c = code(sql);
      const take = (from: string, to: string) => {
        const a = c.indexOf(from);
        return c.slice(a, c.indexOf(to, a)).replace(/\s+/g, " ").trim();
      };
      return [
        take("WHERE (cp.certifications IS NULL", "items AS ("),
        take("deduped AS (", "ORDER BY id, lower(name), ord"),
        take("WHERE cp.years_experience IS NULL", "proposed AS ("),
      ];
    };
    const [dc, dd, dy] = rules(dry);
    const [ac, ad, ay] = rules(apply);
    expect(dc).toContain("::numeric < 0.8");
    expect(dc).toContain("IS NOT DISTINCT FROM cp.current_cv_file_id::text)");
    expect(dy).toContain("'backfilled' -> 'years_experience'");
    expect(dd).toContain("effies?|cannes lions");
    expect(ac).toBe(dc);
    expect(ad).toBe(dd);
    expect(ay).toBe(dy);
  });

  it("the apply file records the marker in the same UPDATE as each write", () => {
    expect(code(apply).match(/consent = jsonb_set\(/g)).toHaveLength(2);
    expect(code(apply)).toMatch(/COMMIT;\s*$/);
  });
});
