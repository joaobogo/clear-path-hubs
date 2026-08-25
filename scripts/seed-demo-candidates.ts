/**
 * Demo candidate seeder.
 *
 * Creates ten high-quality candidates (70-100 points) for the Engineering role
 * of a demo workspace, each with:
 *   - a complete profile (name, email, location, timezone, summary),
 *   - evidence from three sources: parsed CV, technical interview recording,
 *     assessment submission (partial credit where the score warrants it),
 *   - a completed scoring trail (CV run -> interview run -> approved final run),
 *   - the delivered stage (assessment complete, awaiting offer decision),
 *   - one open offer between EUR 55,000 and EUR 75,000, scaled by score.
 *
 * Evidence depth follows the final score: higher scores get more quoted
 * requirements, a richer CV, and more aligned interview answers.
 *
 * Run with:
 *   npm run seed:demo
 *
 * Safety: refuses to run unless the target organisation is a demo/fixture
 * workspace. Re-running replaces the rows it created previously (they carry
 * legacy_source_system = 'seed-demo-candidates').
 */

import { readFileSync } from "node:fs";

const SEED_MARKER = "seed-demo-candidates";
const ENGINE_VERSION = "taasflow-scoring-v1.2.0";


type Seed = {
  name: string;
  score: number;
  city: string;
  country: string;
  timezone: string;
  years: number;
  headline: string;
  summary: string;
  stack: string[];
};

const SEEDS: Seed[] = [
  {
    name: "Joana Silva",
    score: 78,
    city: "Lisbon",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 6,
    headline: "Full-stack engineer — React, TypeScript, Postgres",
    summary:
      "Full-stack engineer with six years building product features end to end at Lisbon SaaS companies. Owns schema design through shipped UI, and has led two Postgres migrations without downtime.",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL", "Playwright"],
  },
  {
    name: "Miguel Ferreira",
    score: 82,
    city: "Porto",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 7,
    headline: "Senior full-stack engineer — multi-tenant SaaS",
    summary:
      "Senior engineer with seven years on multi-tenant SaaS products. Designed the tenant isolation model at his current employer using Postgres row-level security, and mentors two junior engineers.",
    stack: ["React", "TypeScript", "PostgreSQL", "row-level security", "Vitest"],
  },
  {
    name: "Sofia Santos",
    score: 75,
    city: "Braga",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 5,
    headline: "Product engineer — React and Node",
    summary:
      "Product engineer with five years shipping customer-facing features in React and Node. Strong on relational modelling; growing into infrastructure and test automation.",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL"],
  },
  {
    name: "Ricardo Oliveira",
    score: 88,
    city: "Lisbon",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 9,
    headline: "Staff engineer — platform and data modelling",
    summary:
      "Staff engineer with nine years of production React and TypeScript, and deep Postgres experience including partitioning and zero-downtime migrations. Ran the isolation review for a regulated customer base.",
    stack: ["React", "TypeScript", "PostgreSQL", "row-level security", "Playwright", "CI/CD"],
  },
  {
    name: "Mariana Costa",
    score: 85,
    city: "Coimbra",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 8,
    headline: "Senior full-stack engineer — fintech",
    summary:
      "Senior full-stack engineer with eight years in fintech. Owns features from migration to shipped UI, and introduced end-to-end test coverage that cut release regressions sharply.",
    stack: ["React", "TypeScript", "PostgreSQL", "Node.js", "Playwright"],
  },
  {
    name: "André Sousa",
    score: 72,
    city: "Aveiro",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 5,
    headline: "Full-stack engineer — TypeScript and SQL",
    summary:
      "Full-stack engineer with five years across agency and in-house product teams. Comfortable in TypeScript and SQL; limited exposure so far to multi-tenant isolation models.",
    stack: ["React", "TypeScript", "PostgreSQL"],
  },
  {
    name: "Francisca Martins",
    score: 91,
    city: "Lisbon",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 10,
    headline: "Principal engineer — SaaS platforms",
    summary:
      "Principal engineer with a decade of production React and TypeScript. Designed and documented the row-level security model for a platform serving 400 tenants, and keeps unit and end-to-end suites green as a habit.",
    stack: ["React", "TypeScript", "PostgreSQL", "row-level security", "Playwright", "Vitest", "CI/CD"],
  },
  {
    name: "Duarte Pinto",
    score: 79,
    city: "Setúbal",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 6,
    headline: "Full-stack engineer — product delivery",
    summary:
      "Full-stack engineer with six years of product delivery. Strong at owning a feature from data model to interface; writes unit tests as standard and is building end-to-end coverage.",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL", "Vitest"],
  },
  {
    name: "Vera Rocha",
    score: 86,
    city: "Funchal",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 8,
    headline: "Senior engineer — remote-first product teams",
    summary:
      "Senior engineer with eight years in remote-first product teams. Deep Postgres modelling background, comfortable with tenant isolation, and used to written-first collaboration in English.",
    stack: ["React", "TypeScript", "PostgreSQL", "row-level security", "Playwright"],
  },
  {
    name: "Nuno Teixeira",
    score: 80,
    city: "Faro",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    years: 7,
    headline: "Full-stack engineer — platform features",
    summary:
      "Full-stack engineer with seven years on platform features. Has shipped schema-to-UI work repeatedly and maintains the automated test suite on his current team.",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL", "Vitest"],
  },
];

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".");
}

function fitBand(score: number): string {
  if (score >= 90) return "exceptional";
  if (score >= 85) return "top";
  if (score >= 75) return "strong";
  return "worth_considering";
}

function offerSalary(score: number): number {
  // 70 points -> 55,000; 100 points -> 75,000; rounded to the nearest 500.
  const raw = 55000 + ((score - 70) / 30) * 20000;
  return Math.round(raw / 500) * 500;
}

// --- Evidence library ------------------------------------------------------
// CV templates, assessment submissions and interview transcripts live in
// scripts/demo-evidence.json so the text can be reviewed without reading code.

type CvTemplate = {
  id: string;
  language: string;
  seniority: string;
  years_range: [number, number];
  score_range: [number, number];
  expected_must_have_ratio: number;
  body: string;
};

type AssessmentQuestion = { prompt: string; verdict: "correct" | "partial" | "incorrect"; note: string };

type AssessmentSubmission = {
  id: string;
  accuracy: string;
  score_range: [number, number];
  questions_total: number;
  questions_correct: number;
  questions_partial: number;
  questions_incorrect: number;
  headline: string;
  summary: string;
  questions: AssessmentQuestion[];
};

type InterviewTranscript = {
  id: string;
  depth: string;
  score_range: [number, number];
  duration_minutes: number;
  assessor_note: string;
  turns: { speaker: string; text: string }[];
};

type EvidenceLibrary = {
  cv_templates: CvTemplate[];
  assessment_submissions: AssessmentSubmission[];
  interview_transcripts: InterviewTranscript[];
};

const LIBRARY: EvidenceLibrary = JSON.parse(
  readFileSync(new URL("./demo-evidence.json", import.meta.url), "utf8"),
) as EvidenceLibrary;

/** Picks the entry whose score band contains the score, else the nearest band. */
function pickByScore<T extends { score_range: [number, number] }>(items: T[], score: number): T {
  const inBand = items.find((item) => score >= item.score_range[0] && score < item.score_range[1]);
  if (inBand) return inBand;
  return items.reduce((best, item) => {
    const distance = Math.min(Math.abs(score - item.score_range[0]), Math.abs(score - item.score_range[1]));
    const bestDistance = Math.min(Math.abs(score - best.score_range[0]), Math.abs(score - best.score_range[1]));
    return distance < bestDistance ? item : best;
  }, items[0]!);
}

function fillTemplate(body: string, seed: Seed, email: string): string {
  const currentYear = 2026;
  const values: Record<string, string> = {
    name: seed.name,
    city: seed.city,
    country: seed.country,
    years: String(seed.years),
    email,
    stack: seed.stack.join(" · "),
    primary: seed.stack[0] ?? "TypeScript",
    secondary: seed.stack[1] ?? "PostgreSQL",
    startYear: String(currentYear - Math.max(2, Math.round(seed.years / 2))),
    endYear: String(currentYear - seed.years),
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_all, key: string) => values[key] ?? "");
}

function cvText(seed: Seed, email: string, quoted: number, total: number): string {
  const template = pickByScore(LIBRARY.cv_templates, seed.score);
  return [
    fillTemplate(template.body, seed, email),
    "",
    `Screening note: ${quoted} of ${total} role requirements are supported by a quoted passage in this CV.`,
  ].join("\n");
}

function interviewNotes(transcript: InterviewTranscript, seed: Seed): string {
  return [
    `Technical interview (recorded, ${transcript.duration_minutes} minutes) — ${seed.name}`,
    "",
    ...transcript.turns.map((turn) => `${turn.speaker}: ${turn.text}`),
    "",
    `Assessor note: ${transcript.assessor_note}`,
  ].join("\n");
}

function assessmentNotes(assessment: AssessmentSubmission, seed: Seed): string {
  return [
    `Take-home assessment submission — ${seed.name}`,
    "",
    assessment.headline,
    assessment.summary,
    "",
    ...assessment.questions.map((question, index) => {
      const verdict =
        question.verdict === "correct"
          ? "Correct"
          : question.verdict === "partial"
            ? "Partial credit"
            : "Incorrect";
      return `${index + 1}. ${question.prompt} — ${verdict}. ${question.note}`;
    }),
  ].join("\n");
}


async function main() {
  const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  const orgArg = process.argv.find((a) => a.startsWith("--org="))?.slice(6);

  const { data: orgs, error: orgError } = await sb
    .from("organizations")
    .select("id, name, is_demo")
    .order("created_at", { ascending: true });
  if (orgError) throw new Error(`organizations read failed: ${orgError.message}`);

  const org = orgArg
    ? orgs.find((o: any) => o.id === orgArg || o.name === orgArg)
    : orgs.find((o: any) => o.is_demo === true);
  if (!org) throw new Error("No demo workspace found. Pass --org=<id> for a demo/fixture workspace.");
  if (!org.is_demo) {
    throw new Error(
      `Refusing to seed demo candidates into "${org.name}": it is not marked as a demo or fixture workspace.`,
    );
  }

  const { data: positions, error: posError } = await sb
    .from("positions")
    .select("id, title, status")
    .eq("organization_id", org.id);
  if (posError) throw new Error(`positions read failed: ${posError.message}`);

  const position =
    positions.find((p: any) => /engineer/i.test(p.title) && p.status === "active") ??
    positions.find((p: any) => /engineer/i.test(p.title));
  if (!position) throw new Error(`No Engineering role found in workspace "${org.name}".`);

  const { data: rubric, error: rubricError } = await sb
    .from("rubric_versions")
    .select("id, dimensions")
    .eq("position_id", position.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rubricError) throw new Error(`rubric read failed: ${rubricError.message}`);
  if (!rubric) throw new Error(`No rubric version for role "${position.title}".`);

  const requirements: string[] = Array.isArray(rubric.dimensions)
    ? (rubric.dimensions as unknown[]).map((d) => (typeof d === "string" ? d : String((d as any)?.text ?? d)))
    : [];
  if (requirements.length === 0) throw new Error("Rubric has no requirements to evidence.");

  console.log(`Workspace: ${org.name}`);
  console.log(`Role:      ${position.title} (${position.id})`);
  console.log(`Rubric:    ${requirements.length} requirements`);

  // --- Idempotency: remove rows a previous run of this script created. -----
  const { data: priorProfiles } = await sb
    .from("candidate_profiles")
    .select("id")
    .eq("legacy_source_system", SEED_MARKER);
  const priorProfileIds = (priorProfiles ?? []).map((p: any) => p.id);

  if (priorProfileIds.length > 0) {
    const { data: priorMatches } = await sb
      .from("candidate_matches")
      .select("id")
      .in("candidate_profile_id", priorProfileIds);
    const matchIds = (priorMatches ?? []).map((m: any) => m.id);

    const wipe = async (table: string, column: string, ids: string[]) => {
      const { error } = await sb.from(table).delete().in(column, ids);
      if (error) throw new Error(`cleanup of ${table} failed: ${error.message}`);
    };

    if (matchIds.length > 0) {
      // Stage history is append-only, so matches are removed through the
      // audited hard-delete routine rather than a plain delete.
      const { data: staff } = await sb
        .from("memberships")
        .select("user_id")
        .eq("role", "platform_admin")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!staff?.user_id) throw new Error("No active platform admin found to authorise cleanup.");

      // Hide first: the publish gate blocks clearing an approved run while visible.
      await sb.from("candidate_matches").update({ client_visibility: "hidden" }).in("id", matchIds);

      for (const matchId of matchIds) {
        const { error } = await sb.rpc("hard_delete_candidate_match", {
          _match_id: matchId,
          _actor_user_id: staff.user_id,
          _reason: "Demo candidate seed refresh",
        });
        if (error) throw new Error(`cleanup of match ${matchId} failed: ${error.message}`);
      }
    }
    const { data: stillThere } = await sb
      .from("candidate_profiles")
      .select("id")
      .eq("legacy_source_system", SEED_MARKER);
    const leftoverIds = (stillThere ?? []).map((p: any) => p.id);
    if (leftoverIds.length > 0) {
      await wipe("applications", "candidate_profile_id", leftoverIds);
      await wipe("candidate_profiles", "id", leftoverIds);
    }
    console.log(`Removed ${priorProfileIds.length} candidate(s) from a previous seed run.`);


  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let created = 0;

  for (const [index, seed] of SEEDS.entries()) {
    const email = `${slug(seed.name)}@demo.taasflow.com`;
    const appliedAt = new Date(now - (28 - index) * day);
    const interviewAt = new Date(now - (16 - index) * day);
    const assessmentAt = new Date(now - (10 - index) * day);
    const deliveredAt = new Date(now - (7 - index * 0.5) * day);
    const offerSentAt = new Date(now - (4 - index * 0.3) * day);

    // Evidence depth comes from the library entries for this score band: the
    // CV template's expected coverage and the assessment's accuracy, averaged.
    const cvTemplate = pickByScore(LIBRARY.cv_templates, seed.score);
    const assessment = pickByScore(LIBRARY.assessment_submissions, seed.score);
    const transcript = pickByScore(LIBRARY.interview_transcripts, seed.score);
    const accuracyRatio = assessment.questions_correct / assessment.questions_total;
    const partialRatio = assessment.questions_partial / assessment.questions_total;
    const coverageRatio = (cvTemplate.expected_must_have_ratio + accuracyRatio) / 2;

    const quoted = Math.max(1, Math.min(requirements.length, Math.round(coverageRatio * requirements.length)));
    const partial = requirements.length - quoted;
    const partiallyCredited = Math.min(partial, Math.max(0, Math.round(partialRatio * requirements.length)));
    const mustHaveCoverage = Number((quoted / requirements.length).toFixed(4));
    const cv = cvText(seed, email, quoted, requirements.length);


    // --- Profile ---------------------------------------------------------
    const { data: profile, error: profileError } = await sb
      .from("candidate_profiles")
      .insert({
        full_name: seed.name,
        email,
        location: `${seed.city}, ${seed.country}`,
        city: seed.city,
        country: seed.country,
        timezone: seed.timezone,
        headline: seed.headline,
        summary: seed.summary,
        years_experience: seed.years,
        skills: seed.stack,
        languages: [
          { language: "Portuguese", level: "native" },
          { language: "English", level: "fluent" },
        ],
        education: [{ degree: "BSc Computer Science", institution: `University of ${seed.city}` }],
        work_authorization: { eu_work_authorised: true },
        availability: { notice_period_weeks: 4 },
        compensation_preferences: { currency: "EUR", expected_base: offerSalary(seed.score) },
        consent: { data_processing: true, granted_at: appliedAt.toISOString() },
        legacy_source_system: SEED_MARKER,
      })
      .select("id")
      .single();
    if (profileError) throw new Error(`profile insert failed for ${seed.name}: ${profileError.message}`);

    // --- Application -----------------------------------------------------
    const { data: application, error: appError } = await sb
      .from("applications")
      .insert({
        candidate_profile_id: profile.id,
        position_id: position.id,
        status: "ready_for_review",
        source: "demo-seed",
        source_kind: "inbound",
        applied_at: appliedAt.toISOString(),
        consent: { data_processing: true },
      })
      .select("id")
      .single();
    if (appError) throw new Error(`application insert failed for ${seed.name}: ${appError.message}`);

    // --- Match (delivered, awaiting offer decision) -----------------------
    const { data: match, error: matchError } = await sb
      .from("candidate_matches")
      .insert({
        application_id: application.id,
        candidate_profile_id: profile.id,
        position_id: position.id,
        organization_id: org.id,
        // Publishing is gated on an approved score run, so the match starts
        // hidden and is delivered once the scoring trail exists below.
        stage: "reviewing",
        admin_status: "approved",
        client_visibility: "hidden",
        processing_state: "scored",
        canonical_state: "provisional_scoring",

        eligibility_status: "eligible",
        recommendation: seed.score >= 75 ? "shortlist" : "review",
        recommendation_reason: `Final score ${seed.score}. ${quoted} of ${requirements.length} requirements carry a quoted passage.`,
        recommendation_updated_at: deliveredAt.toISOString(),
        integrity_status: "ok",
        evidence_confidence: Number((0.6 + (seed.score - 70) / 100).toFixed(2)),
        delivered_at: deliveredAt.toISOString(),
        submitted_to_client_at: deliveredAt.toISOString(),
        current_stage_entered_at: deliveredAt.toISOString(),
      })
      .select("id")
      .single();
    if (matchError) throw new Error(`match insert failed for ${seed.name}: ${matchError.message}`);

    // --- Stage history ---------------------------------------------------
    await sb.from("candidate_stage_history").insert(
      [
        { from: null, to: "new", at: appliedAt },
        { from: "new", to: "reviewing", at: new Date(appliedAt.getTime() + 2 * day) },
        { from: "reviewing", to: "delivered", at: deliveredAt },
      ].map((step) => ({
        candidate_match_id: match.id,
        organization_id: org.id,
        position_id: position.id,
        candidate_profile_id: profile.id,
        from_stage: step.from,
        to_stage: step.to,
        reason: "Demo seed",
        actor_role: "operations",
        created_at: step.at.toISOString(),
      })),
    );

    // --- Evidence container ----------------------------------------------
    const { data: evidence, error: evidenceError } = await sb
      .from("candidate_evidence")
      .insert({
        candidate_match_id: match.id,
        candidate_profile_id: profile.id,
        engine_version: ENGINE_VERSION,
        extracted: {
          summary: seed.summary,
          skills: seed.stack,
          years_experience: seed.years,
          languages: ["Portuguese", "English"],
        },
        screening_normalized: {
          eu_work_authorised: true,
          english_level: "fluent",
          notice_period_weeks: 4,
        },
        raw_text_sample: cv.slice(0, 1200),
        created_at: appliedAt.toISOString(),
      })
      .select("id")
      .single();
    if (evidenceError) throw new Error(`evidence insert failed for ${seed.name}: ${evidenceError.message}`);

    // --- Evidence items: CV, interview recording, assessment --------------
    const candidateTurns = transcript.turns.filter((turn) => turn.speaker === "Candidate");
    const interviewText = interviewNotes(transcript, seed);
    const assessmentText = assessmentNotes(assessment, seed);

    const items = requirements.flatMap((requirement, reqIndex) => {
      const isQuoted = reqIndex < quoted;
      const isPartiallyCredited = !isQuoted && reqIndex < quoted + partiallyCredited;
      const cvSnippetStart = Math.max(0, cv.search(/EXPERIENCE|EXPERI[ÊE]NCIA/));
      const cvSnippet = cv.slice(cvSnippetStart, cvSnippetStart + 320).replace(/\n/g, " ").trim();
      const turn = candidateTurns[reqIndex % Math.max(1, candidateTurns.length)];
      const question = assessment.questions[reqIndex % assessment.questions.length]!;
      const rows: Record<string, unknown>[] = [];

      rows.push({
        candidate_evidence_id: evidence.id,
        candidate_match_id: match.id,
        organization_id: org.id,
        rubric_criterion_key: `req-${reqIndex}`,
        rubric_dimension_key: `req-${reqIndex}`,
        match_type: isQuoted ? "direct" : "missing",
        confidence: isQuoted ? Number((0.78 + (seed.score - 70) / 200).toFixed(2)) : 0.25,
        source_passage: isQuoted ? cvSnippet : "",
        source_location: {
          source: "cv",
          template: cvTemplate.id,
          language: cvTemplate.language,
          range: `cv:${cvSnippetStart}-${cvSnippetStart + 320}`,
        },
        normalized_meaning: requirement,
        reviewer_status: "accepted",
        engine_version: ENGINE_VERSION,
        result: isQuoted ? "strong" : "missing",
        validation_need: isQuoted ? null : "no_evidence_in_cv",
        source_kind: "cv",
        created_at: appliedAt.toISOString(),
      });

      if ((isQuoted || isPartiallyCredited) && turn) {
        rows.push({
          candidate_evidence_id: evidence.id,
          candidate_match_id: match.id,
          organization_id: org.id,
          rubric_criterion_key: `req-${reqIndex}`,
          rubric_dimension_key: `req-${reqIndex}`,
          match_type: isQuoted ? "direct" : "transferable",
          confidence: isQuoted ? 0.9 : 0.5,
          source_passage: turn.text,
          source_location: {
            source: "interview",
            transcript: transcript.id,
            depth: transcript.depth,
            timestamp: `00:${String(8 + reqIndex * 6).padStart(2, "0")}:00`,
          },
          normalized_meaning: requirement,
          reviewer_status: "accepted",
          engine_version: ENGINE_VERSION,
          result: isQuoted ? "strong" : "partial",
          validation_need: isQuoted ? null : "confirm_in_interview",
          source_kind: "interview",
          created_at: interviewAt.toISOString(),
        });
      }

      rows.push({
        candidate_evidence_id: evidence.id,
        candidate_match_id: match.id,
        organization_id: org.id,
        rubric_criterion_key: `req-${reqIndex}`,
        rubric_dimension_key: `req-${reqIndex}`,
        match_type: question.verdict === "correct" ? "direct" : question.verdict === "partial" ? "transferable" : "missing",
        confidence: question.verdict === "correct" ? 0.85 : question.verdict === "partial" ? 0.45 : 0.2,
        source_passage:
          question.verdict === "incorrect" ? "" : `${question.prompt} — ${question.note}`,
        source_location: {
          source: "assessment",
          submission: assessment.id,
          accuracy: assessment.accuracy,
          section: `question-${reqIndex + 1}`,
        },
        normalized_meaning: requirement,
        reviewer_status: "accepted",
        engine_version: ENGINE_VERSION,
        result:
          question.verdict === "correct" ? "strong" : question.verdict === "partial" ? "partial" : "missing",
        validation_need: question.verdict === "correct" ? null : "confirm_in_interview",
        source_kind: "application_answer",
        created_at: assessmentAt.toISOString(),
      });

      return rows;
    });


    const { error: itemsError } = await sb.from("candidate_evidence_items").insert(items);
    if (itemsError) throw new Error(`evidence items insert failed for ${seed.name}: ${itemsError.message}`);

    // --- Score runs: CV, interview-informed, approved final ---------------
    const requirementAssessment = requirements.map((requirement, reqIndex) => {
      const isQuoted = reqIndex < quoted;
      const isPartiallyCredited = !isQuoted && reqIndex < quoted + partiallyCredited;
      const question = assessment.questions[reqIndex % assessment.questions.length]!;
      const cvStart = Math.max(0, cv.search(/EXPERIENCE|EXPERI[ÊE]NCIA/));
      const turn = candidateTurns[reqIndex % Math.max(1, candidateTurns.length)];
      const evidence = [
        {
          source: "cv",
          snippet: isQuoted ? cv.slice(cvStart, cvStart + 320).replace(/\n/g, " ").trim() : "",
          location: `cv:${cvStart}-${cvStart + 320}`,
          requirement_id: `req-${reqIndex}`,
          requirement_text: requirement,
        },
        {
          source: "interview",
          snippet: (isQuoted || isPartiallyCredited) && turn ? turn.text : "",
          location: `interview:${transcript.id}`,
          requirement_id: `req-${reqIndex}`,
          requirement_text: requirement,
        },
        {
          source: "assessment",
          snippet: question.verdict === "incorrect" ? "" : `${question.prompt} — ${question.note}`,
          location: `assessment:${assessment.id}:question-${reqIndex + 1}`,
          requirement_id: `req-${reqIndex}`,
          requirement_text: requirement,
        },
      ].filter((e) => e.snippet.length > 0);

      return {
        id: `req-${reqIndex}`,
        text: requirement,
        status: isQuoted ? "met" : evidence.length > 0 ? "partial" : "unknown",
        required: true,
        needs_validation: !isQuoted,
        evidence,
      };
    });


    const makeRun = async (opts: {
      score: number;
      completedAt: Date;
      method: string;
      label: string;
      sources: string[];
      supersedes?: { runId: string; reason: string };
    }) => {
      if (opts.supersedes) {
        const { error } = await sb
          .from("score_runs")
          .update({
            superseded_at: opts.completedAt.toISOString(),
            superseded_reason: opts.supersedes.reason,
          })
          .eq("id", opts.supersedes.runId);
        if (error) throw new Error(`superseding run failed for ${seed.name}: ${error.message}`);
      }

      const { data: run, error: runError } = await sb
        .from("score_runs")
        .insert({
          candidate_match_id: match.id,
          application_id: application.id,
          candidate_submission_id: application.id,
          candidate_profile_id: profile.id,
          organization_id: org.id,
          position_id: position.id,
          rubric_version_id: rubric.id,
          engine_version: ENGINE_VERSION,
          blueprint_version: "demo-blueprint-v1",
          evaluation_method: opts.method,
          status: "completed",
          score: opts.score,
          raw_score: opts.score,
          final_score: opts.score,
          fit_band: fitBand(opts.score),
          fit_label: fitBand(opts.score),
          confidence: Number((0.6 + (seed.score - 70) / 120).toFixed(2)),
          evidence_confidence: Number((0.6 + (seed.score - 70) / 120).toFixed(2)),
          must_have_coverage: mustHaveCoverage,
          preferred_coverage: mustHaveCoverage,
          contradiction_status: "none",
          started_at: new Date(opts.completedAt.getTime() - 60_000).toISOString(),
          completed_at: opts.completedAt.toISOString(),
          requirement_coverage: { must_have: mustHaveCoverage, preferred: mustHaveCoverage },
          evidence: requirementAssessment.flatMap((r) => r.evidence),
          explanation: `${opts.label}: ${quoted} of ${requirements.length} requirements carry a quoted passage. Assessment: ${assessment.headline}.`,
          result: {
            score: opts.score,
            fit_label: fitBand(opts.score),
            engine_version: ENGINE_VERSION,
            evaluation_method: opts.method,
            sources: opts.sources,
            must_have_coverage: mustHaveCoverage,
            preferred_coverage: mustHaveCoverage,
            category_breakdown: {
              must_have: mustHaveCoverage,
              preferred: mustHaveCoverage,
              screening_alignment: Number((0.7 + (seed.score - 70) / 150).toFixed(2)),
            },
            requirement_assessment: requirementAssessment,
            strengths: requirements.slice(0, quoted).map((r) => `Demonstrated: ${r}`),
            concerns: requirements
              .slice(quoted)
              .map((r) => `Partly evidenced — worth confirming: ${r}`),
            inputs: {
              cv_text: cv,
              cv_template: cvTemplate.id,
              interview_transcript: interviewText,
              interview_depth: transcript.depth,
              assessment_submission: assessmentText,
              assessment_result: {
                id: assessment.id,
                accuracy: assessment.accuracy,
                headline: assessment.headline,
                questions_total: assessment.questions_total,
                questions_correct: assessment.questions_correct,
                questions_partial: assessment.questions_partial,
                questions_incorrect: assessment.questions_incorrect,
              },
            },
          },
        })
        .select("id")
        .single();
      if (runError) throw new Error(`score run insert failed for ${seed.name}: ${runError.message}`);
      return run.id as string;
    };

    // Only one completed run may stay current per submission, so each earlier
    // run in the trail is superseded by the one that follows it.
    const cvRunId = await makeRun({
      score: Math.max(50, seed.score - 8),
      completedAt: new Date(appliedAt.getTime() + day),
      method: "deterministic",
      label: "CV only",
      sources: ["cv"],
    });
    const interviewRunId = await makeRun({
      score: Math.max(55, seed.score - 3),
      completedAt: new Date(interviewAt.getTime() + 2 * 60 * 60 * 1000),
      method: "deterministic",
      label: "CV and interview recording",
      sources: ["cv", "interview"],
      supersedes: { runId: cvRunId, reason: "Interview recording scored" },
    });
    const finalRunId = await makeRun({
      score: seed.score,
      completedAt: new Date(assessmentAt.getTime() + 3 * 60 * 60 * 1000),
      method: "deterministic",
      label: "CV, interview recording and assessment",
      sources: ["cv", "interview", "assessment"],
      supersedes: { runId: interviewRunId, reason: "Assessment submission scored" },
    });


    // The canonical state machine only allows one step at a time.
    for (const state of ["human_review", "approved", "published_to_client"] as const) {
      const { error } = await sb
        .from("candidate_matches")
        .update(
          state === "published_to_client"
            ? {
                canonical_state: state,
                current_score_run_id: finalRunId,
                approved_score_run_id: finalRunId,
                stage: "delivered",
                client_visibility: "visible",
              }
            : state === "approved"
              ? { canonical_state: state, current_score_run_id: finalRunId, approved_score_run_id: finalRunId }
              : { canonical_state: state, current_score_run_id: finalRunId },
        )
        .eq("id", match.id);
      if (error) throw new Error(`publish (${state}) failed for ${seed.name}: ${error.message}`);
    }


    // --- Interview (completed, recorded and scored) -----------------------
    // Interviews must be created in a pre-completion status, then completed.
    const { data: interview, error: interviewError } = await sb
      .from("interviews")
      .insert({
        candidate_match_id: match.id,
        organization_id: org.id,
        position_id: position.id,
        status: "scheduled",
        interview_type: "technical",
        duration_minutes: 60,
        timezone: seed.timezone,
        scheduling_method: "manual",
        candidate_response: "accepted",
        requested_at: new Date(interviewAt.getTime() - 4 * day).toISOString(),
        scheduled_at: interviewAt.toISOString(),
        confirmed_at: new Date(interviewAt.getTime() - 2 * day).toISOString(),
        notes: interviewText,
        participants: [{ name: "Technical panel", role: "interviewer" }],
        proposed_times: [interviewAt.toISOString()],
      })
      .select("id")
      .single();
    if (interviewError) throw new Error(`interview insert failed for ${seed.name}: ${interviewError.message}`);

    const { error: interviewCompleteError } = await sb
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date(interviewAt.getTime() + 60 * 60 * 1000).toISOString(),
        feedback: assessmentText,
      })
      .eq("id", interview.id);
    if (interviewCompleteError)
      throw new Error(`interview completion failed for ${seed.name}: ${interviewCompleteError.message}`);

    // --- Open offer -------------------------------------------------------
    const salary = offerSalary(seed.score);
    const { error: hireError } = await sb.from("hire_records").insert({
      candidate_match_id: match.id,
      organization_id: org.id,
      position_id: position.id,
      candidate_profile_id: profile.id,
      application_id: application.id,
      status: "offer_sent",
      salary_amount: salary,
      salary_currency: "EUR",
      salary_period: "annual",
      employment_type: "full_time",
      work_model: "hybrid",
      location: `${seed.city}, ${seed.country}`,
      offer_notes: `Offer sent at EUR ${salary.toLocaleString("en-GB")} base, in line with a final score of ${seed.score}.`,
      drafted_at: new Date(offerSentAt.getTime() - day).toISOString(),
      sent_at: offerSentAt.toISOString(),
      start_date: new Date(now + 45 * day).toISOString().slice(0, 10),
      expected_response_date: new Date(offerSentAt.getTime() + 7 * day).toISOString().slice(0, 10),
    });
    if (hireError) throw new Error(`offer insert failed for ${seed.name}: ${hireError.message}`);

    created += 1;
    console.log(
      `  ${seed.name.padEnd(20)} score ${seed.score}  ${quoted}/${requirements.length} quoted  offer EUR ${salary.toLocaleString("en-GB")}`,
    );
  }

  console.log(`\nSeeded ${created} candidates into "${org.name}" for "${position.title}".`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
