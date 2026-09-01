/**
 * An architecture document may not claim PASS about code it does not describe.
 *
 * docs/architecture/dashboard-read-models.md gave every dashboard a "primary
 * aggregate read" — client_dashboard_kpis for Client Overview, and twelve more
 * — carried a Verification section, and ended "Verdict: PASS". Not one of those
 * views is read anywhere in the application. Every surface issues direct
 * .from() reads against base tables and aggregates in TypeScript (audit 1 Sep,
 * F29; duplicate-source-report.md flags the same drift independently).
 *
 * Not user-facing, which is exactly why it was worth fixing. Two findings this
 * repository spent a week on — the client dashboard reporting "Nothing needs
 * you today" while candidates waited (F1), and the client counts silently
 * dropping an unreadable candidate (F5) — were both hand-written aggregate
 * reads on surfaces this document says are served by a view. Anyone reasoning
 * from the document would not have thought to look there.
 *
 * The guard holds both directions. While a documented view has no readers, the
 * document must say so and must not claim PASS. When the views are actually
 * implemented, this test fails and names the document to promote — so it
 * cannot end up understating the system either.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filesMatching } from "@tests/helpers/scan-source";

const DOC = "docs/architecture/dashboard-read-models.md";

/** Views the document names as a primary aggregate or secondary read. */
const DOCUMENTED_VIEWS = [
  "client_dashboard_kpis",
  "client_positions_view",
  "client_kanban_view",
  "client_candidate_matches_view",
  "admin_pipeline_health",
  "admin_work_inbox",
  "admin_candidate_matches_view",
  "candidate_my_applications",
  "candidate_messages_view",
];

const doc = readFileSync(join(process.cwd(), DOC), "utf8");

/** The generated types file names every view; it is not a reader. */
const NOT_A_READER = [/integrations\/supabase\/types\.ts$/, /__tests__/];

function readersOf(view: string): string[] {
  return filesMatching(join(process.cwd(), "src"), new RegExp(`["']${view}["']`), {
    exclude: NOT_A_READER,
  });
}

const implemented = DOCUMENTED_VIEWS.filter((v) => readersOf(v).length > 0);

describe("dashboard-read-models.md against the code", () => {
  it("does not claim PASS while its read models are unimplemented", () => {
    if (implemented.length === DOCUMENTED_VIEWS.length) {
      expect(
        doc,
        "every documented view now has a reader — promote this document back to PASS",
      ).toMatch(/\*\*Status:\*\*\s*PASS/);
      return;
    }
    expect(doc, `${DOC} claims PASS while views have no readers`).not.toMatch(
      /\*\*Status:\*\*\s*PASS/,
    );
    expect(doc, `${DOC} must not end on a PASS verdict`).not.toMatch(/\*\*Verdict: PASS\*\*/);
  });

  it("says which read models are not implemented", () => {
    if (implemented.length === DOCUMENTED_VIEWS.length) return;
    expect(doc, `${DOC} needs an Implementation status section`).toMatch(
      /## Implementation status/,
    );
    for (const view of DOCUMENTED_VIEWS.filter((v) => readersOf(v).length === 0)) {
      expect(doc, `${DOC} does not disclose that ${view} has no readers`).toMatch(
        new RegExp(`\`${view}\``),
      );
    }
  });

  it("reports the state accurately at the time of writing", () => {
    // If this fails, someone implemented a read model — good. Update the
    // Implementation status table and this list together.
    expect(implemented).toEqual([]);
  });
});
