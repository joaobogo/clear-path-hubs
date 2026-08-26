/**
 * Northwind demo cohort seeder.
 *
 * Creates the 15-candidate cohort for the demo role "Senior Full-Stack
 * Engineer" by going through the product's own write paths:
 *
 *   application submission  → src/lib/apply.server.ts (submitApplicationImpl)
 *   parse → hydrate → score → src/lib/pipeline-runner.server.ts
 *
 * Nothing is inserted by hand into score_runs, candidate_evidence,
 * eligibility_checks or processing rows, and no score is ever typed.
 *
 * Usage:
 *   bun run scripts/seed-northwind-demo.ts [--reset] [--only <slug>] [--stage apply|score]
 *
 * Safety:
 *   - refuses to run against anything but the demo organisation,
 *   - suppresses outbound notifications for every seeded e-mail address,
 *   - blocks outbound e-mail/Teams HTTP for the seed process only.
 */

import { renderCvPdf } from "./seed-northwind-demo/cv-pdf";
import type { Dossier } from "./seed-northwind-demo/types";
import { TARGETS, bandOf } from "./seed-northwind-demo/targets";

const ORG_ID = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed";
const POSITION_ID = "ee6d2a82-6122-4026-95e4-45a7821b7b7d";
const ADMIN_ACTOR = "e60fd0fc-3f4d-4911-b469-c672ca0ca369";
const SEED_MARKER = "northwind-demo-2026-08";
const SUPPRESSION_REASON = "demo candidate — never contact";

/** Candidate dossier modules, in cohort order. */
const SLUGS = [
  "helena-carvalho",
  "tomas-ferreira",
  "mariana-lopes",
  "rui-almeida",
  "marta-nunes",
  "diogo-martins",
  "sara-mendes",
  "vasco-santos",
  "catarina-ribeiro",
  "miguel-costa",
  "ana-sofia-pinto",
  "filipe-rocha",
  "laura-fernandez",
  "gabriel-souza",
  "joana-teixeira",
] as const;

// ── outbound kill switch ────────────────────────────────────────────────────
// E-mail (api.lovable.dev) and Teams (connector-gateway.lovable.dev) are the
// only outbound dispatchers in the write paths this script touches. AI gateway
// and Supabase traffic must keep working, so the block is host-scoped.
const BLOCKED_HOSTS = ["api.lovable.dev", "connector-gateway.lovable.dev"];
function installOutboundBlock() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) {
      console.log(`   [outbound blocked] ${url}`);
      return new Response(JSON.stringify({ ok: true, blocked: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

type Args = { reset: boolean; only: string | null; stage: "apply" | "score" };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const stage = (valueOf("--stage") ?? "score") as Args["stage"];
  if (stage !== "apply" && stage !== "score") {
    throw new Error(`--stage must be "apply" or "score" (got "${stage}")`);
  }
  return { reset: argv.includes("--reset"), only: valueOf("--only"), stage };
}

async function loadDossiers(only: string | null): Promise<Dossier[]> {
  const slugs = only ? SLUGS.filter((s) => s === only) : [...SLUGS];
  if (only && slugs.length === 0) throw new Error(`Unknown candidate slug "${only}"`);
  const out: Dossier[] = [];
  for (const slug of slugs) {
    try {
      const mod = await import(`./seed-northwind-demo/candidates/${slug}`);
      out.push((mod.dossier ?? mod.default) as Dossier);
    } catch {
      // Dossier module not written yet — reported by the caller, not fatal.
      if (only) throw new Error(`No dossier module for "${slug}"`);
      console.log(`   (skipping ${slug}: dossier module not written yet)`);
    }
  }
  return out;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  installOutboundBlock();
  const args = parseArgs();

  const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;

  // ── preflight ─────────────────────────────────────────────────────────────
  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id,name,is_demo")
    .eq("id", ORG_ID)
    .maybeSingle();
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`);
  if (!org) throw new Error("Demo organisation not found.");
  if (org.is_demo !== true) throw new Error(`Refusing to seed: "${org.name}" is not a demo workspace.`);

  const { data: position } = await sb
    .from("positions")
    .select("id,title,organization_id,status")
    .eq("id", POSITION_ID)
    .maybeSingle();
  if (!position || position.organization_id !== ORG_ID) {
    throw new Error("Target position is missing or belongs to another workspace.");
  }

  const { data: questions } = await sb
    .from("screening_questions")
    .select("id,question,answer_type,display_order")
    .eq("position_id", POSITION_ID)
    .order("display_order", { ascending: true });
  if (!questions || questions.length !== 4) {
    throw new Error(`Expected 4 screening questions, found ${questions?.length ?? 0}.`);
  }
  const [q1, q2, q3, q4] = questions;

  const dossiers = await loadDossiers(args.only);
  console.log(`Workspace: ${org.name}`);
  console.log(`Role:      ${position.title}`);
  console.log(`Cohort:    ${dossiers.length} candidate(s), stage=${args.stage}\n`);

  // ── suppressions: every cohort e-mail, before anything is created ─────────
  const allDossiers = await loadDossiers(null);
  for (const d of allDossiers) {
    const { data: active } = await sb
      .from("notification_suppressions")
      .select("id")
      .eq("email", d.email.toLowerCase())
      .is("released_at", null)
      .maybeSingle();
    if (active) continue;
    const { error } = await sb.from("notification_suppressions").insert({
      email: d.email.toLowerCase(),
      reason: SUPPRESSION_REASON,
      source: "manual",
      created_by: ADMIN_ACTOR,
    });
    if (error) throw new Error(`suppression for ${d.email} failed: ${error.message}`);
  }
  console.log(`Suppressed outbound mail for ${allDossiers.length} cohort addresses.`);

  // ── reset ─────────────────────────────────────────────────────────────────
  if (args.reset) {
    await resetCohort(sb, args.only ? dossiers.map((d) => d.email.toLowerCase()) : null);
  }

  const { submitApplicationImpl } = await import("../src/lib/apply.server");
  const { runPipelineForMatch } = await import("../src/lib/pipeline-runner.server");

  const rows: Array<Record<string, string>> = [];
  const problems: string[] = [];

  for (const d of dossiers) {
    console.log(`\n── ${d.full_name} (${d.slug})`);

    // 1. CV → real 2-page A4 PDF, verified by the product's own extractor.
    const pdf = await renderCvPdf(d.cv);
    const { extractCvText } = await import("../src/lib/cv-extractor.server");
    // The extractor detaches the buffer it is handed, so verify on a copy.
    const extracted = await extractCvText(
      new Uint8Array(pdf),
      "application/pdf",
      `${d.slug}.pdf`,
    );
    const flat = norm(extracted.text);
    const missing = d.evidence_sentences.filter((s) => !flat.includes(norm(s)));
    if (missing.length > 0) {
      problems.push(`${d.slug}: ${missing.length} evidence sentence(s) not extractable verbatim`);
      console.log(`   ! evidence sentences missing from extraction:\n     - ${missing.join("\n     - ")}`);
      continue;
    }
    console.log(`   CV: ${extracted.page_count} pages, ${extracted.chars} chars, all ${d.evidence_sentences.length} evidence sentences verbatim`);

    // 2. Submit through the product's application write path.
    const submitted = await submitApplicationImpl({
      position_id: POSITION_ID,
      full_name: d.full_name,
      email: d.email,
      phone: d.phone,
      country: d.country,
      region: d.region,
      city: d.city,
      cv: {
        filename: `${d.full_name.replace(/\s+/g, "-").toLowerCase()}-cv.pdf`,
        mime: "application/pdf",
        base64: Buffer.from(pdf).toString("base64"),
      },
      cover_letter: d.cover_letter ?? "",
      portfolio_url: d.portfolio_url ?? "",
      linkedin_url: d.linkedin_url ?? "",
      website_url: "",
      accommodation_request: "",
      answers: [
        { question_id: q1.id, value: d.react_ts_years },
        { question_id: q2.id, value: d.eu_right_to_work },
        { question_id: q3.id, value: d.multi_choice },
        { question_id: q4.id, value: d.q4 },
      ],
      consent_terms: true,
      network_opt_in: true,
      source: "public_job_board",
      idempotency_key: `${SEED_MARKER}-${d.slug}`,
      elapsed_seconds: 640,
    });

    if (!submitted.ok) {
      problems.push(`${d.slug}: submission failed (${submitted.code}) ${submitted.message}`);
      console.log(`   ! submission failed: ${submitted.code}`);
      continue;
    }
    const applicationId = submitted.application_id;
    const { data: appRow, error: appErr } = await sb
      .from("applications")
      .select("id,candidate_profile_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appErr || !appRow) {
      throw new Error(`application ${applicationId} not readable: ${appErr?.message ?? "not found"}`);
    }
    const profileId: string = appRow.candidate_profile_id;
    let matchId: string | undefined = submitted.match_id;
    if (!matchId) {
      const { data: m } = await sb
        .from("candidate_matches")
        .select("id")
        .eq("candidate_profile_id", profileId)
        .eq("position_id", POSITION_ID)
        .maybeSingle();
      matchId = m?.id;
    }
    if (!matchId) throw new Error(`no match created for ${d.slug}`);
    console.log(`   application ${applicationId} · match ${matchId}`);

    // Tag everything this seed created.
    await sb.from("candidate_profiles").update({ legacy_source_system: SEED_MARKER, is_test_record: false }).eq("id", profileId);
    await sb.from("applications").update({ legacy_source_system: SEED_MARKER, is_test_record: false }).eq("id", applicationId);
    await sb.from("candidate_matches").update({ legacy_source_system: SEED_MARKER, is_test_record: false }).eq("id", matchId);
    await sb.from("files").update({ legacy_source_system: SEED_MARKER }).eq("candidate_profile_id", profileId);

    if (args.stage === "apply") {
      rows.push({ candidate: d.full_name, match: matchId, state: "applied (stage=apply)", score: "—", band: "—" });
      continue;
    }

    // 3. Pipeline: parse → hydrate → insights → score. The submission path
    //    also kicks this off in the background, so wait for it to settle and
    //    only drive it ourselves when it has not reached a terminal state.
    const state = await waitForTerminal(sb, matchId, 20_000);
    if (!state) {
      const outcome = await runPipelineForMatch(matchId);
      console.log(`   pipeline: ${outcome.final_state} (${outcome.steps.map((s) => s.step).join(" → ")})`);
      await waitForTerminal(sb, matchId, 120_000);
    } else {
      console.log(`   pipeline settled by submission path: ${state}`);
    }

    // 4. Candidate-supplied facts the CV cannot carry, written after
    //    hydration so nothing is overwritten by the parser.
    await applyCandidateFacts(sb, profileId, d);

    rows.push({
      candidate: d.full_name,
      match: matchId,
      slug: d.slug,
      target: TARGETS[d.slug]?.band ?? d.targets.band,
    });
  }

  // ── report ────────────────────────────────────────────────────────────────
  console.log("\n\nRESULT\n");
  const pct = (v: unknown) =>
    v == null ? "—" : `${Math.round(Number(v) * 100)}%`;
  for (const r of rows) {
    const { data: match, error: matchErr } = await sb
      .from("candidate_matches")
      .select("id,processing_state,stage,admin_status,eligibility_status,current_score_run_id")
      .eq("id", r.match)
      .maybeSingle();
    if (matchErr) problems.push(`${r.candidate}: could not read match — ${matchErr.message}`);
    const { data: run, error: runErr } = await sb
      .from("score_runs")
      .select(
        "id,final_score,fit_label,fit_band,status,evidence_confidence,confidence,must_have_coverage,preferred_coverage,requirement_coverage,engine_version,rubric_version_id",
      )
      .eq("candidate_match_id", r.match)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runErr) problems.push(`${r.candidate}: could not read score run — ${runErr.message}`);

    const coverage = (run?.requirement_coverage ?? {}) as {
      screening_alignment?: number;
      requirement_assessment?: { id: string; status: string; required: boolean }[];
    };
    const verdicts = (coverage.requirement_assessment ?? [])
      .map((a) => {
        const short = a.status === "met" ? "M" : a.status === "partial" ? "P" : "X";
        return `${a.required ? "R" : "P"}${a.id.replace("req-", "")}:${short}`;
      })
      .join(" ");

    console.log(
      [
        (r.candidate ?? "").padEnd(18),
        (match?.processing_state ?? "?").padEnd(22),
        `score=${(run?.final_score != null ? String(run.final_score) : "—").padEnd(6)}`,
        `band=${(run?.final_score != null ? bandOf(Number(run.final_score)) : "—").padEnd(16)}`,
        `target=${(r.target ?? "—").padEnd(15)}`,
        `fit=${(run?.fit_label ?? "—").padEnd(18)}`,
        `must=${pct(run?.must_have_coverage).padEnd(5)}`,
        `pref=${pct(run?.preferred_coverage).padEnd(5)}`,
        `screen=${pct(coverage.screening_alignment).padEnd(5)}`,
        `evid_conf=${run?.evidence_confidence ?? "—"}`,
        `eligibility=${match?.eligibility_status ?? "—"}`,
        `stage=${match?.stage ?? "—"}/${match?.admin_status ?? "—"}`,
      ].join(" "),
    );
    if (verdicts) console.log(`${" ".repeat(18)} requirements: ${verdicts}`);
  }


  await runAssertions(sb, problems);

  if (problems.length > 0) {
    console.log("\nPROBLEMS\n");
    for (const p of problems) console.log(` ! ${p}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll assertions passed.");
  }
}

/** Poll until the match reaches a terminal processing state, or give up. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForTerminal(sb: any, matchId: string, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await sb
      .from("candidate_matches")
      .select("processing_state")
      .eq("id", matchId)
      .maybeSingle();
    const st = data?.processing_state as string | undefined;
    if (st === "scored" || st === "manual_review_required") return st;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return null;
}

/**
 * Facts the candidate gives us on the form or in the dossier: availability,
 * compensation, work authorisation, certifications, languages, timezone.
 * Stamped as candidate-confirmed so a later parse run leaves them alone.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyCandidateFacts(sb: any, profileId: string, d: Dossier) {
  const { data: profile } = await sb
    .from("candidate_profiles")
    .select("consent")
    .eq("id", profileId)
    .maybeSingle();
  const consent = (profile?.consent as Record<string, unknown>) ?? {};
  const provenance = (consent.provenance as Record<string, unknown>) ?? {};
  const stamp = (field: string) => {
    provenance[field] = {
      source: "user_confirmed",
      confidence: 1,
      extracted_at: new Date().toISOString(),
      source_surface: "candidate_application",
    };
  };
  for (const f of [
    "availability",
    "compensation_preferences",
    "work_authorization",
    "certifications",
    "languages",
    "timezone",
    "years_experience",
    "headline",
    "summary",
  ]) {
    stamp(f);
  }

  const { error } = await sb
    .from("candidate_profiles")
    .update({
      headline: d.headline,
      summary: d.recruiter_summary,
      timezone: d.timezone,
      years_experience: d.years_experience,
      linkedin_url: d.linkedin_url,
      portfolio_url: d.portfolio_url,
      city: d.city,
      region: d.region || null,
      country: d.country,
      skills: d.skills,
      languages: d.languages,
      education: d.education,
      certifications: d.certifications,
      experience: d.experience,
      availability: { status: "available", notice: d.availability, note: d.availability },
      compensation_preferences: {
        currency: "EUR",
        period: "year",
        target: d.compensation.target,
        expected_min: d.compensation.expected_min,
        expected_max: d.compensation.expected_max,
        display: d.compensation.display,
      },
      work_authorization: {
        eu_right_to_work: d.eu_right_to_work,
        visa_required: d.visa_required,
        notes: d.work_authorization_notes,
      },
      consent: { ...consent, provenance },
    })
    .eq("id", profileId);
  if (error) throw new Error(`profile fill for ${d.slug} failed: ${error.message}`);
}

/** Remove the cohort through the product's audited deletion path. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetCohort(sb: any, onlyEmails: string[] | null) {
  let q = sb.from("candidate_profiles").select("id,email").eq("legacy_source_system", SEED_MARKER);
  if (onlyEmails) q = q.in("email", onlyEmails);
  const { data: profiles } = await q;
  const ids = (profiles ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) {
    console.log("Reset: nothing to remove.");
    return;
  }

  const { data: files } = await sb
    .from("files")
    .select("id,storage_bucket,storage_path")
    .in("candidate_profile_id", ids);

  const { data: matches } = await sb
    .from("candidate_matches")
    .select("id")
    .in("candidate_profile_id", ids);
  const matchIds = (matches ?? []).map((m: { id: string }) => m.id);
  if (matchIds.length > 0) {
    // Hide first: the publish gate refuses to clear an approved run while visible.
    await sb.from("candidate_matches").update({ client_visibility: "hidden" }).in("id", matchIds);
    for (const id of matchIds) {
      const { error } = await sb.rpc("hard_delete_candidate_match", {
        _match_id: id,
        _actor_user_id: ADMIN_ACTOR,
        _reason: "Northwind demo cohort reseed",
      });
      if (error) throw new Error(`hard delete of ${id} failed: ${error.message}`);
    }
  }

  for (const f of files ?? []) {
    const { error } = await sb.storage.from(f.storage_bucket).remove([f.storage_path]);
    if (error) console.log(`   ! storage remove failed for ${f.storage_path}: ${error.message}`);
  }

  const { data: leftover } = await sb
    .from("candidate_profiles")
    .select("id")
    .eq("legacy_source_system", SEED_MARKER)
    .in("id", ids);
  const leftoverIds = (leftover ?? []).map((p: { id: string }) => p.id);
  if (leftoverIds.length > 0) {
    await sb.from("applications").delete().in("candidate_profile_id", leftoverIds);
    await sb.from("files").delete().in("candidate_profile_id", leftoverIds);
    await sb.from("candidate_profiles").delete().in("id", leftoverIds);
  }
  console.log(`Reset: removed ${ids.length} candidate(s) and ${(files ?? []).length} CV object(s).`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAssertions(sb: any, problems: string[]) {
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) problems.push(`assertion failed: ${label} ${detail}`.trim());
  };
  console.log("\nASSERTIONS\n");

  const { data: profiles } = await sb
    .from("candidate_profiles")
    .select("id,email,is_test_record")
    .eq("legacy_source_system", SEED_MARKER);
  const ids = (profiles ?? []).map((p: { id: string }) => p.id);
  check("15 tagged candidate profiles", (profiles ?? []).length === 15, `found ${(profiles ?? []).length}`);
  check("is_test_record false everywhere", (profiles ?? []).every((p: { is_test_record: boolean }) => p.is_test_record === false));

  if (ids.length === 0) return;

  const { data: matches } = await sb
    .from("candidate_matches")
    .select("id,position_id,processing_state,candidate_profile_id")
    .in("candidate_profile_id", ids);
  check("one match per candidate on the demo role", (matches ?? []).length === ids.length && (matches ?? []).every((m: { position_id: string }) => m.position_id === POSITION_ID), `${(matches ?? []).length} matches`);

  const { data: apps } = await sb
    .from("applications")
    .select("id,candidate_profile_id")
    .in("candidate_profile_id", ids);
  check("one application per candidate", (apps ?? []).length === ids.length, `${(apps ?? []).length} applications`);

  const { data: files } = await sb
    .from("files")
    .select("id,candidate_profile_id,page_count,parse_state")
    .in("candidate_profile_id", ids);
  check("one parsed CV per candidate", (files ?? []).length === ids.length && (files ?? []).every((f: { parse_state: string }) => f.parse_state === "parsed"), `${(files ?? []).length} files`);

  const matchIds = (matches ?? []).map((m: { id: string }) => m.id);
  const { data: runs } = await sb
    .from("score_runs")
    .select("id,candidate_match_id,engine_version,rubric_version_id,final_score,fit_label")
    .in("candidate_match_id", matchIds);
  const perMatch = new Map<string, number>();
  for (const r of runs ?? []) perMatch.set(r.candidate_match_id, (perMatch.get(r.candidate_match_id) ?? 0) + 1);
  check("exactly one score run per match", matchIds.every((id: string) => perMatch.get(id) === 1), `${(runs ?? []).length} runs`);
  const versions = new Set((runs ?? []).map((r: { engine_version: string }) => r.engine_version));
  check("single engine version across the cohort", versions.size <= 1, [...versions].join(", "));
  const rubrics = new Set((runs ?? []).map((r: { rubric_version_id: string }) => r.rubric_version_id));
  check("single rubric version across the cohort", rubrics.size <= 1, [...rubrics].join(", "));

  const { data: evidence } = await sb
    .from("candidate_evidence")
    .select("id,candidate_match_id")
    .in("candidate_match_id", matchIds);
  const evPerMatch = new Map<string, number>();
  for (const e of evidence ?? []) evPerMatch.set(e.candidate_match_id, (evPerMatch.get(e.candidate_match_id) ?? 0) + 1);
  check("every match carries evidence rows", matchIds.every((id: string) => (evPerMatch.get(id) ?? 0) > 0));

  // No seed markers or QA words in candidate-visible text.
  const bad = (profiles ?? []).filter((p: { email: string }) => /(test|qa|ignore|demo_seed)/i.test(p.email));
  check("no test/qa markers in cohort e-mails", bad.length === 0, bad.map((b: { email: string }) => b.email).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
