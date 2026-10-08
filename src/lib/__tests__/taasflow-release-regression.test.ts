import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { editableFieldNames, positionSchemaFor } from "@/lib/positions/field-registry";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("role editing", () => {
  it("allows the client to edit every essential field without changing the server vocabulary", () => {
    const fields = editableFieldNames("client");
    for (const key of [
      "title",
      "department",
      "description",
      "work_model",
      "employment_type",
      "seniority",
      "headcount",
      "budget_min",
      "budget_max",
    ]) {
      expect(fields, key).toContain(key);
    }
    const schema = positionSchemaFor("client").shape;
    expect(schema.title.parse("  Director of Finance  ")).toBe("Director of Finance");
    expect(schema.title.safeParse("X").success).toBe(false);
    expect(schema.work_model.parse("hybrid")).toBe("hybrid");
    expect(schema.work_model.safeParse("somewhere").success).toBe(false);
    expect(schema.employment_type.parse("full_time")).toBe("full_time");
    expect(schema.description.parse("A detailed job description.")).toBe(
      "A detailed job description.",
    );
    expect(schema.budget_min.parse("55000")).toBe("55000");
    expect(schema.budget_max.parse("75000")).toBe("75000");
  });

  it("edits the actual role, preserves extended context, and reloads the saved version", () => {
    const server = source("src/lib/position-edit.functions.ts");
    const wizard = source("src/components/positions/PositionEditWizard.tsx");
    const route = source("src/routes/_authenticated/client.positions.$id_.edit.tsx");
    const save = server.slice(
      server.indexOf("export const savePositionEdit"),
      server.indexOf("const publishInput"),
    );
    expect(save).toContain("await assertCanEdit");
    expect(save).toContain(".update(patch)");
    expect(save).toContain('.select("*")');
    expect(save).toContain("...priorCtx");
    expect(save).toContain("...priorComp");
    expect(save).toContain("...priorWA");
    expect(save).toContain("roleTitle: data.title");
    expect(save).toContain("team: data.department");
    expect(save).toContain("jobDescriptionText: data.description");
    expect(route).toContain("getPositionForEdit");
    expect(route).toContain('audience="client"');
    expect(wizard).toContain('toast.success("Role saved")');
    expect(wizard).toContain("qc.invalidateQueries");
  });

  it("persists structured locations before saving the brief", () => {
    const wizard = source("src/components/positions/PositionEditWizard.tsx");
    const step = wizard.slice(
      wizard.indexOf("const stepSaveMutation"),
      wizard.indexOf("const stepSaveMutation") + 950,
    );
    expect(step).toMatch(/await reqSaveRef\.current\(\)/);
    expect(step).toMatch(/await saveMutation\.mutateAsync\(\)/);
    expect(step.indexOf("reqSaveRef.current()")).toBeLessThan(
      step.indexOf("saveMutation.mutateAsync()"),
    );
  });

  it("prevents discarded demo fixtures from appearing in normal client roles", () => {
    const roles = source("src/lib/client-positions.functions.ts");
    expect(roles).toMatch(/\.eq\("is_test_record"(?:\s+as\s+any)?,\s*false\)/);
  });
});

describe("intake parsing and preview contract", () => {
  it("starts reading the JD before the client reaches step two", () => {
    const intake = source("src/routes/intake.tsx");
    expect(intake).toContain("if (stepIndex > 1) return;");
    expect(intake).toContain('if (bp.title) put("roleTitle"');
    expect(intake).toContain('if (bp.team) put("team"');
    expect(intake).toContain("editedRef.current.has(key as string)");
    expect(intake).toContain("requestId !== jdRequestSeqRef.current");
  });

  it("keeps full confirmation visible, preserves JD, and excludes reassurance filler", () => {
    const intake = source("src/routes/intake.tsx");
    expect(intake).toContain("<IntakeReviewPanel");
    expect(intake).not.toContain("Show summary");
    expect(intake).not.toContain("We will tell you honestly if it is achievable.");
    expect(intake).toContain("jobDescriptionText: state.jobDescriptionText");
    expect(intake).toContain("seniorityLabel:");
    expect(intake).toContain("employmentTypeLabel:");
    expect(intake).toContain("collaboratorLine:");
  });
});


describe("off-platform interviews and offers", () => {
  it("does not expose direct stage-change buttons in client candidate lists", () => {
    const list = source("src/components/client/candidates/compact-list.tsx");
    const card = source("src/components/client/candidate-card.tsx");
    const board = source("src/components/client/candidates/board-view.tsx");
    expect(list).not.toContain("CandidatePrimaryAction");
    expect(list).not.toContain('>Action</th>');
    expect(card).not.toContain("CandidatePrimaryAction");
    expect(board).toContain("attemptMove={attemptMove}");
    expect(board).toContain("<PipelineBoard");
  });

  it("keeps interview and offer stages on Kanban without creating external workflows", () => {
    const code = source("src/lib/client-decisions.functions.ts");
    const move = code.slice(
      code.indexOf("export const moveMatchStage"),
      code.indexOf("export const undoClientDecision"),
    );
    const action = code.slice(code.indexOf("export const clientAction"));
    expect(move).toContain("toStage: data.toStage");
    expect(move).not.toMatch(/\.from\(["']interviews["']\)\s*\.insert\(/);
    expect(move).not.toContain("upsertOfferDraft");
    expect(move).not.toContain('interview_process: "request_interview"');
    expect(move).not.toContain('offer: "offer"');
    expect(action).toContain("if (ACTION_TO_STAGE[data.action])");
  });

  it("blocks legacy staff offer mutations before writing and retains role closure", () => {
    const code = source("src/lib/offer-hire.functions.ts");
    for (const name of ["recordOfferOutcomeFn", "setHireStartDateFn"]) {
      const handler = code.slice(code.indexOf(`export const ${name}`));
      expect(handler).toContain("if (offSystemWorkflowRequired())");
    }
    expect(code).toContain("export const closePositionWithOutcomeFn");
  });

  it("redirects old client booking and offer routes to candidate tracking", () => {
    const interviews = source("src/routes/_authenticated/client.interviews.tsx");
    const offers = source("src/routes/_authenticated/client.offers.tsx");
    for (const route of [interviews, offers]) {
      expect(route).toContain('to: "/client/candidates"');
      expect(route).not.toMatch(/RequestInterviewDialog|upsertOfferDraft/);
    }
  });
});
