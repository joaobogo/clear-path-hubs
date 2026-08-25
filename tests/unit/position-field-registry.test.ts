import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  POSITION_FIELDS,
  PUBLIC_FIELD_NAMES,
  fieldLabel,
  fieldsFor,
  positionField,
  positionFieldByIntakeKey,
  positionSchemaFor,
  publicHeading,
} from "@/lib/positions/field-registry";

const read = (p: string) => readFileSync(p, "utf8");

describe("position field registry", () => {
  it("names every field once", () => {
    const names = POSITION_FIELDS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps intake keys unique and resolvable", () => {
    const keys = POSITION_FIELDS.map((f) => f.intakeKey).filter(Boolean) as string[];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(positionFieldByIntakeKey(k)?.label).toBeTruthy();
  });

  it("gives every field a label and a schema", () => {
    for (const f of POSITION_FIELDS) {
      expect(f.label.trim().length).toBeGreaterThan(0);
      expect(f.schema).toBeTruthy();
    }
  });

  it("validates from the schema, not from a form", () => {
    const schema = positionSchemaFor("admin");
    const parsed = schema.parse({ title: "Senior Engineer", work_model: "remote", headcount: 2 });
    expect((parsed as Record<string, unknown>)["department"]).toBe("");
    expect(() => schema.parse({ title: "no", work_model: "remote", headcount: 1 })).toThrow();
  });

  it("marks public fields explicitly", () => {
    expect(PUBLIC_FIELD_NAMES).toContain("title");
    expect(PUBLIC_FIELD_NAMES).toContain("responsibilities");
    // Sourcing rules are internal by definition.
    expect(PUBLIC_FIELD_NAMES).not.toContain("include_keywords");
    expect(PUBLIC_FIELD_NAMES).not.toContain("exclude_keywords");
    expect(PUBLIC_FIELD_NAMES).not.toContain("disqualifier_tags");
    expect(publicHeading("must_have_skills")).toBe("What we need");
  });

  it("client editors never render staff-only sourcing fields", () => {
    const clientNames = fieldsFor("client").map((f) => f.name);
    for (const staffOnly of [
      "target_titles",
      "title_match_timing",
      "target_company_types",
      "include_keywords",
      "exclude_keywords",
      "brand_tone",
    ]) {
      expect(clientNames).not.toContain(staffOnly);
      expect(positionField(staffOnly).adminEditable).toBe(true);
    }
  });

  it("the editors and the intake form define no labels of their own", () => {
    const wizard = read("src/components/positions/PositionEditWizard.tsx");
    for (const name of ["title", "work_model", "employment_type", "seniority", "budget_min"]) {
      expect(wizard).toContain(`fieldLabel("${name}")`);
    }
    // Old hand-written labels must not come back.
    for (const stale of ["Role Title", "Work Arrangement", "Seniority Level", "Positions to Fill"]) {
      expect(wizard).not.toContain(`label="${stale}"`);
    }
    const intake = read("src/routes/intake.tsx");
    for (const key of ["roleTitle", "location", "workModel", "salaryMin", "salaryMax"]) {
      expect(intake).toContain(`intakeFieldLabel("${key}")`);
    }
  });

  it("the save path validates with the shared shape", () => {
    const server = read("src/lib/position-edit.functions.ts");
    expect(server).toContain('positionShapeFor("admin")');
    // Public sections read posting.*, so the writer must fill them.
    expect(server).toContain("responsibilities: data.responsibilities");
  });

  it("the public listing takes its headings from the registry", () => {
    const page = read("src/routes/jobs.$id.index.tsx");
    expect(page).toContain("publicHeading(");
    expect(page).toContain("PUBLIC_FIELD_NAMES");
    expect(fieldLabel("title")).toBe("Job title");
  });
});
