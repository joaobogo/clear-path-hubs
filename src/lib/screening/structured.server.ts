/**
 * Structured screening pilot: reads and writes (server only, service role).
 * The rules are in ./structured.ts.
 */
import {
  FORM_FIELD_KEYS,
  questionFromRow,
  sortQuestions,
  type StructuredAnswer,
  type StructuredQuestion,
  type StructuredScreening,
  type StructuredValue,
} from "./structured";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const QUESTION_COLUMNS =
  "key,label,type,options,required,section,maps_to_requirement,pass_rule,sort_order,help,unit,show_when,short_label,staff_only";

/**
 * The job's switch and its questions. A job without the switch on reads as
 * not enabled with no questions, whatever rows exist, so nothing changes for
 * it. A read that fails reads as not enabled: the standard form is the safe
 * fallback.
 */
export async function loadStructuredScreening(
  positionId: string,
  db?: Db,
): Promise<StructuredScreening> {
  const s = db ?? (await admin());
  const off: StructuredScreening = { enabled: false, enabled_at: null, questions: [] };
  const { data: pos, error } = await s
    .from("positions")
    .select("structured_screening_enabled,structured_screening_enabled_at")
    .eq("id", positionId)
    .maybeSingle();
  if (error || !pos?.structured_screening_enabled) return off;
  const { data: rows, error: qErr } = await s
    .from("structured_screening_questions")
    .select(QUESTION_COLUMNS)
    .eq("position_id", positionId);
  if (qErr) {
    console.error("[structured-screening] question read failed", positionId, qErr.message);
    return off;
  }
  const questions = sortQuestions(
    ((rows ?? []) as Record<string, unknown>[])
      .map(questionFromRow)
      .filter((q): q is StructuredQuestion => q != null),
  );
  if (questions.length === 0) return off;
  return {
    enabled: true,
    enabled_at: (pos.structured_screening_enabled_at as string | null) ?? null,
    questions,
  };
}

/**
 * The questions for a job whatever its switch says, for reading answers back
 * (admin view, scoring) after the switch was turned off: answers given stay
 * readable and keep counting.
 */
export async function loadStructuredQuestions(positionId: string, db?: Db): Promise<StructuredQuestion[]> {
  const s = db ?? (await admin());
  const { data: rows, error } = await s
    .from("structured_screening_questions")
    .select(QUESTION_COLUMNS)
    .eq("position_id", positionId);
  if (error) throw new Error(`structured_questions_read_failed: ${error.message}`);
  return sortQuestions(
    ((rows ?? []) as Record<string, unknown>[])
      .map(questionFromRow)
      .filter((q): q is StructuredQuestion => q != null),
  );
}

export async function loadStructuredAnswers(applicationId: string, db?: Db): Promise<StructuredAnswer[]> {
  const s = db ?? (await admin());
  const { data, error } = await s
    .from("structured_screening_answers")
    .select("question_key,value,status,source")
    .eq("application_id", applicationId);
  if (error) throw new Error(`structured_answers_read_failed: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    key: String(r.question_key),
    value: (r.value as StructuredValue | null) ?? null,
    status: (r.status as StructuredAnswer["status"]) ?? "answered",
    source: (r.source as StructuredAnswer["source"]) ?? "candidate",
  }));
}

/**
 * Store a new application's answers: the ones the candidate gave on the
 * form, plus LinkedIn and where they are based, which the form asks as its
 * own fields. An answer already stored for the application is never replaced
 * from here.
 */
export async function storeApplicationAnswers(
  db: Db,
  args: {
    applicationId: string;
    positionId: string;
    answers: Array<{ key: string; value: StructuredValue }>;
    linkedinUrl: string | null;
    basedIn: string | null;
    questions: readonly StructuredQuestion[];
  },
): Promise<void> {
  const keys = new Set(args.questions.map((q) => q.key));
  const rows: Array<Record<string, unknown>> = args.answers
    .filter((a) => keys.has(a.key))
    .map((a) => ({
      application_id: args.applicationId,
      position_id: args.positionId,
      question_key: a.key,
      value: a.value,
      source: "candidate",
      status: "answered",
    }));
  const fromForm: Record<(typeof FORM_FIELD_KEYS)[number], string | null> = {
    linkedin_url: args.linkedinUrl,
    based_in: args.basedIn,
  };
  for (const key of FORM_FIELD_KEYS) {
    const v = fromForm[key];
    if (keys.has(key) && v && v.trim()) {
      rows.push({
        application_id: args.applicationId,
        position_id: args.positionId,
        question_key: key,
        value: v.trim(),
        source: "candidate",
        status: "answered",
      });
    }
  }
  if (rows.length === 0) return;
  const { error } = await db
    .from("structured_screening_answers")
    .upsert(rows, { onConflict: "application_id,question_key", ignoreDuplicates: true });
  if (error) throw new Error(`structured_answers_write_failed: ${error.message}`);
}

export type StructuredReviewRow = {
  key: string;
  label: string;
  section: StructuredQuestion["section"];
  answer: string;
  /** answered, not asked (applied before the pilot), or skipped. */
  status: StructuredAnswer["status"];
  source: StructuredAnswer["source"] | null;
  /** Whether the answer meets its must-have; null when the question has no rule or no answer. */
  passes: boolean | null;
  staff_only: boolean;
};

export type StructuredReview = {
  rows: StructuredReviewRow[];
  flags: import("./structured").StructuredFlag[];
  summary: string;
  /** Applied before the switch was turned on: unanswered questions were never asked. */
  pre_pilot: boolean;
};

/**
 * What the reviewer sees at the top of the candidate page: every pilot
 * question with its answer, and the flags. Null for a candidate on a job
 * without pilot questions. Questions a candidate who applied before the pilot
 * never saw read as "not asked" and raise no flag.
 */
export async function loadStructuredReview(
  args: { applicationId: string | null; positionId: string; currentRunId: string | null },
  db?: Db,
): Promise<StructuredReview | null> {
  if (!args.applicationId) return null;
  const s = db ?? (await admin());
  const questions = await loadStructuredQuestions(args.positionId, s);
  if (questions.length === 0) return null;
  const [answers, { data: pos }, { data: app }, run] = await Promise.all([
    loadStructuredAnswers(args.applicationId, s),
    s
      .from("positions")
      .select("structured_screening_enabled,structured_screening_enabled_at,compensation")
      .eq("id", args.positionId)
      .maybeSingle(),
    s.from("applications").select("created_at").eq("id", args.applicationId).maybeSingle(),
    args.currentRunId
      ? s.from("score_runs").select("result").eq("id", args.currentRunId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const enabledAt = (pos?.structured_screening_enabled_at as string | null) ?? null;
  const prePilot =
    !enabledAt || (app?.created_at ? new Date(app.created_at).getTime() < new Date(enabledAt).getTime() : true);
  // A job that never had the pilot switched on, and a candidate with no
  // answers: nothing to show.
  if (!pos?.structured_screening_enabled && !enabledAt && answers.length === 0) return null;

  const m = await import("./structured");
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const values = Object.fromEntries(answers.map((a) => [a.key, a.value]));
  const rows: StructuredReviewRow[] = questions
    .filter((q) => !q.show_when || byKey.has(q.key) || m.isShown(q, values))
    .map((q) => {
      const a = byKey.get(q.key);
      const status: StructuredAnswer["status"] = a?.status ?? (prePilot ? "not_asked" : "skipped");
      return {
        key: q.key,
        label: m.shortLabel(q),
        section: q.section,
        answer: status === "answered" ? m.displayValue(q, a?.value) : status === "not_asked" ? "Not asked" : "Skipped",
        status,
        source: a?.source ?? null,
        passes: status === "answered" ? m.passes(q, a?.value) : null,
        staff_only: q.staff_only,
      };
    });
  const comp = (pos?.compensation ?? null) as { min?: number | null; max?: number | null } | null;
  const resultRows = ((run?.data as { result?: { requirement_assessment?: unknown[] } } | null)?.result
    ?.requirement_assessment ?? []) as Parameters<typeof m.verifyFlags>[1];
  const pay = m.payFlag(questions, answers, comp ? { min: comp.min ?? null, max: comp.max ?? null } : null);
  const flags = [
    ...m.answerFlags(questions, answers),
    ...m.verifyFlags(questions, resultRows),
    ...(pay ? [pay] : []),
  ];
  return { rows, flags, summary: m.summaryLine(questions, answers, flags), pre_pilot: prePilot };
}
