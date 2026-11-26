/**
 * Reads the two facts behind the "CV only" label: which roles ask screening
 * questions, and which applications have any answer on file. Server-only, with
 * the service-role client: a client-scoped read must not depend on what the
 * caller may see of the screening tables.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type ScreeningFacts = {
  rolesWithQuestions: Set<string>;
  applicationsWithAnswers: Set<string>;
};

const uniq = (ids: ReadonlyArray<string | null | undefined>): string[] => [
  ...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0)),
];

export async function loadScreeningFacts(
  positionIds: ReadonlyArray<string | null | undefined>,
  applicationIds: ReadonlyArray<string | null | undefined>,
): Promise<ScreeningFacts> {
  const positions = uniq(positionIds);
  const applications = uniq(applicationIds);
  const facts: ScreeningFacts = {
    rolesWithQuestions: new Set(),
    applicationsWithAnswers: new Set(),
  };
  if (positions.length === 0) return facts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = supabaseAdmin as Any;
  const [q, a] = await Promise.all([
    s.from("screening_questions").select("position_id").in("position_id", positions),
    applications.length > 0
      ? s.from("application_answers").select("application_id").in("application_id", applications)
      : Promise.resolve({ data: [] as Any[], error: null }),
  ]);
  // The label is a caution, not a gate: if the facts cannot be read, no row is
  // labelled rather than every row.
  if (q.error || a.error) {
    console.error("[cv-only] screening facts read failed", (q.error ?? a.error)?.message);
    return facts;
  }
  for (const r of (q.data ?? []) as Any[]) facts.rolesWithQuestions.add(String(r.position_id));
  for (const r of (a.data ?? []) as Any[])
    facts.applicationsWithAnswers.add(String(r.application_id));
  return facts;
}

/** The two facts for one row, in the shape toClientCandidateDTO reads. */
export function screeningFactsFor(
  facts: ScreeningFacts,
  row: { position_id?: string | null; application_id?: string | null },
): { role_has_questions: boolean; has_answers: boolean } {
  return {
    role_has_questions: !!row.position_id && facts.rolesWithQuestions.has(String(row.position_id)),
    has_answers:
      !!row.application_id && facts.applicationsWithAnswers.has(String(row.application_id)),
  };
}

/** Rows with their screening facts attached, in one read for the whole list. */
export async function withScreeningFacts<
  T extends { position_id?: string | null; application_id?: string | null },
>(
  rows: readonly T[],
): Promise<Array<T & { screening_facts: ReturnType<typeof screeningFactsFor> }>> {
  const facts = await loadScreeningFacts(
    rows.map((r) => r.position_id),
    rows.map((r) => r.application_id),
  );
  return rows.map((r) => ({ ...r, screening_facts: screeningFactsFor(facts, r) }));
}
