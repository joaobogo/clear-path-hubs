/**
 * Two things a candidate reads on a job page before deciding to apply.
 *
 * The time to apply: a posting with too few timed applications states an
 * estimate for someone with their CV ready (about 3 minutes, more only when
 * the form asks for several written answers); a posting with enough of them
 * states its own recorded median.
 *
 * The travel line: a stored option value ("frequent") is shown in words
 * ("Frequent"), never as the raw value, and without a percentage nobody
 * stated for the role.
 */
import { describe, expect, it } from "vitest";
import {
  EFFORT_DEFAULT,
  EFFORT_MIN_SAMPLE,
  applyEffortDefault,
  applyEffortLine,
  applyEffortProvenance,
  applyEffortTimeClause,
  resolveApplyEffort,
} from "@/lib/jobs/apply-effort";
import {
  TRAVEL_EXPECTATIONS,
  normalizeTravelExpectation,
  travelText,
} from "@/lib/requisition-schema";

const q = (...types: string[]) => types.map((answer_type) => ({ answer_type }));

describe("time to apply, before a posting has been timed", () => {
  it("is about 3 minutes for a form of ticks, choices and one written answer", () => {
    expect(EFFORT_DEFAULT.minutes).toBe(3);
    expect(applyEffortDefault([]).minutes).toBe(3);
    expect(applyEffortDefault(null).minutes).toBe(3);
    expect(
      applyEffortDefault(q("boolean", "boolean", "boolean", "boolean", "multi_choice")).minutes,
    ).toBe(3);
    // The two Enterprise Sales Director forms.
    expect(
      applyEffortDefault(q("boolean", "boolean", "boolean", "long_text", "number")).minutes,
    ).toBe(3);
    expect(
      applyEffortDefault(q("boolean", "boolean", "boolean", "boolean", "long_text")).minutes,
    ).toBe(3);
  });

  it("adds two minutes for each written answer after the first", () => {
    expect(applyEffortDefault(q("boolean", "boolean", "text", "text")).minutes).toBe(5);
    expect(applyEffortDefault(q("boolean", "boolean", "text", "text", "text")).minutes).toBe(7);
    expect(applyEffortDefault(q("date", "number", "single_choice")).minutes).toBe(3);
  });

  it("is never presented as measured", () => {
    const e = applyEffortDefault(q("text", "long_text"));
    expect(e.measured).toBe(false);
    expect(e.sampleSize).toBe(0);
    expect(applyEffortProvenance(e)).toContain("estimate");
    expect(applyEffortProvenance(e)).not.toContain("Median");
  });

  it("reads 'about 3 minutes' on every surface", () => {
    expect(applyEffortTimeClause(EFFORT_DEFAULT)).toBe("about 3 minutes");
    expect(applyEffortLine(EFFORT_DEFAULT, 5)).toBe(
      "5 steps, about 3 minutes. You'll need your CV as a PDF. Your answers are saved as you go.",
    );
    expect(applyEffortLine(EFFORT_DEFAULT, 5)).not.toMatch(/under|8 minutes/);
  });
});

describe("time to apply, from recorded applications", () => {
  const form = applyEffortDefault(q("boolean", "text", "text"));

  it("keeps the form's estimate below the sample threshold or on a bad read", () => {
    expect(
      resolveApplyEffort({ sample_size: EFFORT_MIN_SAMPLE - 1, median_seconds: 505 }, form),
    ).toBe(form);
    expect(resolveApplyEffort({ sample_size: 60, median_seconds: null }, form)).toBe(form);
    expect(resolveApplyEffort({ error: "boom" }, form)).toBe(form);
    expect(resolveApplyEffort(null, form)).toBe(form);
    expect(resolveApplyEffort(undefined)).toBe(EFFORT_DEFAULT);
  });

  it("states the posting's own median once there are enough", () => {
    const e = resolveApplyEffort({ sample_size: 60, median_seconds: 286 }, form);
    expect(e).toEqual({ minutes: 5, measured: true, sampleSize: 60 });
    expect(applyEffortTimeClause(e)).toBe("about 5 minutes");
    expect(applyEffortProvenance(e)).toBe("Median of 60 completed applications for this role.");
    expect(applyEffortTimeClause({ minutes: 1, measured: true, sampleSize: 20 })).toBe(
      "about 1 minute",
    );
  });
});

describe("travel line", () => {
  it("shows a stored option in words", () => {
    expect(travelText("frequent")).toBe("Frequent");
    expect(travelText("none")).toBe("No travel");
    expect(travelText("occasional")).toBe("Occasional");
    expect(travelText("regular")).toBe("Regular");
    expect(travelText("extensive")).toBe("Extensive");
    expect(travelText("  Frequent ")).toBe("Frequent");
    expect(travelText("None")).toBe("No travel");
  });

  it("never shows a raw option value or the editor's percentage band", () => {
    for (const t of TRAVEL_EXPECTATIONS) {
      const shown = travelText(t.value);
      expect(shown).not.toBe(t.value);
      expect(shown[0]).toBe(shown[0].toUpperCase());
      expect(shown).not.toMatch(/[%(]/);
    }
  });

  it("leaves the author's own sentence as written", () => {
    expect(travelText("Up to 20% domestic travel")).toBe("Up to 20% domestic travel");
    expect(travelText("None – fully site-based")).toBe("None – fully site-based");
    expect(travelText("Mudança para a Polônia. A passagem aérea é paga pelo candidato.")).toBe(
      "Mudança para a Polônia. A passagem aérea é paga pelo candidato.",
    );
  });

  it("shows nothing for an empty value or a placeholder", () => {
    for (const v of ["", "   ", null, undefined, 3, "unknown", "N/A", "TBD", "Not specified"]) {
      expect(travelText(v)).toBe("");
    }
  });

  it("saves back to the same stored option", () => {
    for (const t of TRAVEL_EXPECTATIONS) {
      expect(normalizeTravelExpectation(travelText(t.value))).toBe(t.value);
    }
  });
});
