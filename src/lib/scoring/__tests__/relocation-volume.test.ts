import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "../../scoring-engine.server";
import { reconcile } from "../../scoring-service.server";

const START_OPTS = ["Logo após o visto", "Até 1 mês depois do visto", "2 a 3 meses depois", "Mais tarde"];
const FLEX_OPTS = ["Turnos noturnos", "Turnos de 12 horas", "Fins de semana", "Folga em dia variável"];
const QUESTION_TEXT: Record<string, string> = {
  passport: "Você tem passaporte válido ou consegue tirar um antes da viagem?",
};
const yesDB = (id: string, value: boolean): ScreeningAnswer => ({
  question_id: id, question: QUESTION_TEXT[id] ?? id, required: true, answer_type: "boolean", value,
  disqualifying_condition: { operator: "equals", value: false },
});

function answers(o: { relocate?: boolean; passport?: boolean; start?: string | null; flex?: string[] | null; plan?: string | null; experience?: boolean | null } = {}): ScreeningAnswer[] {
  const a: ScreeningAnswer[] = [
    yesDB("relocate", o.relocate ?? true),
    yesDB("flight", true),
    { ...yesDB("shifts", true), scoring_dimension: "flexibility" },
    yesDB("passport", o.passport ?? true),
    yesDB("visa_start", true),
  ];
  if (o.plan !== null) a.push({ question_id: "plan", question: "plan", required: true, answer_type: "long_text", value: o.plan ?? "Quero ficar pelo menos 2 anos e juntar dinheiro", scoring_dimension: "commitment" });
  if (o.start !== null) a.push({ question_id: "start", question: "start", required: true, answer_type: "single_choice", value: o.start ?? START_OPTS[1], options: START_OPTS, scoring_dimension: "start" });
  if (o.flex !== null) a.push({ question_id: "flex", question: "flex", required: true, answer_type: "multi_choice", value: o.flex ?? FLEX_OPTS.slice(0, 3), options: FLEX_OPTS, scoring_dimension: "flexibility" });
  if (o.experience !== undefined && o.experience !== null) a.push({ question_id: "exp", question: "exp", required: false, answer_type: "boolean", value: o.experience, scoring_dimension: "experience" });
  return a;
}

const requirements = [
  { id: "req-0", text: "Disponibilidade para se mudar para a Polônia", required: true, keywords: [] },
  { id: "pref-0", text: "Experiência em armazém, estoque ou logística", required: false, keywords: [] },
];
const shortCv = "Maria Souza. São Paulo, Brasil. Ensino médio completo. Gosto de trabalhar em equipe.";

const run = (screening: ScreeningAnswer[], cv = shortCv, mode: string | null = "relocation_volume") =>
  scoreCandidate({ cv_text: cv, requirements, screening, scoring_mode: mode });

describe("relocation_volume scoring (Respekt roles)", () => {
  it("no experience, short CV, all checks passed lands in the strong range (>= 75)", () => {
    const r = run(answers());
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.fit_label).toBe("strong_fit");
    expect(r.applied_caps).toEqual([]);
    expect(reconcile(r).reconciled).toBe(true);
  });

  it("weights are commitment 40, start 20, flexibility 20, experience 20", () => {
    const top = run(answers({ start: START_OPTS[0], flex: FLEX_OPTS, experience: true }));
    expect(top.score).toBeGreaterThanOrEqual(95);
    expect(top.relocation_breakdown?.dimensions.commitment.score).toBe(1);
  });

  it("experience only adds points; no experience is never below the baseline", () => {
    const none = run(answers({ experience: false }));
    const some = run(answers({ experience: true }));
    expect(some.score).toBeGreaterThan(none.score);
    expect(none.relocation_breakdown?.dimensions.experience.score).toBe(0.75);
    expect(none.score).toBe(run(answers()).score);
  });

  it.each(["relocate", "flight", "shifts", "passport", "visa_start"])("a 'no' on %s makes the candidate not eligible", (id) => {
    const a = answers().map((x) => (x.question_id === id ? { ...x, value: false } : x));
    const r = run(a);
    expect(r.fit_label).toBe("not_a_fit");
    expect(r.score).toBeLessThanOrEqual(15);
    expect(r.disqualifying_answers.map((d) => d.question_id)).toEqual([id]);
  });

  it("unanswered scored questions count as unknown, not as a fail", () => {
    const r = run(answers({ start: null, flex: null, plan: null }));
    expect(r.disqualifying_answers).toEqual([]);
    expect(r.fit_label).not.toBe("not_a_fit");
    expect(r.relocation_breakdown?.dimensions.start.source).toBe("unanswered");
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it("standard roles are unchanged by the new fields", () => {
    const a = answers();
    const standard = run(a, shortCv, null);
    const explicit = run(a, shortCv, "standard");
    expect(standard.relocation_breakdown).toBeUndefined();
    expect(explicit.score).toBe(standard.score);
    expect(standard.category_weights).not.toEqual({ must_have: 0.8, preferred: 0.2, screening_alignment: 0 });
  });
});

describe("live Respekt question set (8 questions)", () => {
  const db = (id: string, question: string, value: boolean, dim?: string): ScreeningAnswer => ({
    question_id: id, question, required: true, answer_type: "boolean", value,
    disqualifying_condition: { operator: "equals", value: false }, ...(dim ? { scoring_dimension: dim } : {}),
  });
  const live = (start: string): ScreeningAnswer[] => [
    db("relocate", "Você tem disponibilidade para se mudar para a Polônia nos próximos 3 meses?", true),
    db("flight", "Você consegue pagar a sua passagem aérea até a Polônia?", true),
    db("shifts", "Você aceita trabalhar no turno da noite (das 18h às 4h45) durante um mês a cada três meses?", true, "flexibility"),
    { question_id: "stay", question: "Por quanto tempo você pretende trabalhar na Polônia?", required: true, answer_type: "text", value: "Pretendo ficar um bom tempo", scoring_dimension: "commitment" },
    { question_id: "costs", question: "Você entende que a moradia e o transporte são descontados do salário?", required: false, answer_type: "boolean", value: true },
    db("passport", "Você tem passaporte válido ou consegue tirar um antes da viagem?", true),
    db("visa", "Você pode começar a trabalhar depois do processo de visto, que leva cerca de 6 semanas?", true),
    { question_id: "start", question: "Quando você pode começar, depois que o visto sair?", required: true, answer_type: "single_choice", value: start, options: START_OPTS, scoring_dimension: "start" },
  ];
  it("no experience, passes everything, ordinary answers: 75 or higher", () => {
    const r = run(live(START_OPTS[1]!));
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.disqualifying_answers).toEqual([]);
    expect(reconcile(r).reconciled).toBe(true);
  });
  it("a 'no' on the passport question disqualifies", () => {
    const r = run(live(START_OPTS[1]!).map((a) => (a.question_id === "passport" ? { ...a, value: false } : a)));
    expect(r.fit_label).toBe("not_a_fit");
  });
});
