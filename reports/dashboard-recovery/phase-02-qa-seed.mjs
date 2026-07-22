// Phase 2 QA seed. Idempotent per test_run_id. Uses service role.
import { createClient } from "/dev-server/node_modules/@supabase/supabase-js/dist/index.mjs";
import fs from "node:fs";
import path from "node:path";

const RUN_ID = process.env.QA_RUN_ID || "qa20260722";
const PASSWORD = process.env.QA_PERSONA_PASSWORD || "QaPhase2!Recovery";
const TAG = `[QA:${RUN_ID}]`;

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (...a) => console.log("[seed]", ...a);

async function findUserIdByEmail(email) {
  let page = 1;
  while (page < 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if ((data?.users ?? []).length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureUser(email, fullName) {
  const existing = await findUserIdByEmail(email);
  if (existing) {
    await sb.auth.admin.updateUserById(existing, { password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, qa_run_id: RUN_ID } });
    return existing;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName, qa_run_id: RUN_ID },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

// -------- CLEANUP: only rows tagged with our RUN_ID --------
async function cleanupPriorRun() {
  log("cleanup: RUN_ID=", RUN_ID);
  // Orgs by tagged name
  const { data: orgs } = await sb.from("organizations").select("id,name").ilike("name", `%${TAG}%`);
  const orgIds = (orgs ?? []).map((o) => o.id);
  log("cleanup: orgs found =", orgIds.length);
  if (orgIds.length) {
    const { data: posRows } = await sb.from("positions").select("id").in("organization_id", orgIds);
    const posIds = (posRows ?? []).map((r) => r.id);
    if (posIds.length) {
      await sb.from("candidate_evidence").delete().in("candidate_match_id",
        ((await sb.from("candidate_matches").select("id").in("position_id", posIds)).data ?? []).map(x=>x.id));
      await sb.from("client_decisions").delete().in("organization_id", orgIds);
      await sb.from("candidate_matches").delete().in("position_id", posIds);
      await sb.from("applications").delete().in("position_id", posIds);
      await sb.from("screening_questions").delete().in("position_id", posIds);
      await sb.from("notification_events").delete().in("position_id", posIds);
      await sb.from("positions").delete().in("id", posIds);
    }
    await sb.from("memberships").delete().in("organization_id", orgIds);
    await sb.from("notification_events").delete().in("organization_id", orgIds);
    await sb.from("organizations").delete().in("id", orgIds);
  }
  // Candidate profiles tagged
  const { data: cps } = await sb.from("candidate_profiles").select("id,user_id").ilike("email", `%${RUN_ID}%`);
  const cpIds = (cps ?? []).map((c) => c.id);
  if (cpIds.length) {
    await sb.from("candidate_profiles").delete().in("id", cpIds);
  }
  // Delete tagged auth users
  let deleted = 0;
  for (let page = 1; page < 50; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if ((u.email ?? "").includes(RUN_ID)) {
        await sb.auth.admin.deleteUser(u.id);
        deleted++;
      }
    }
    if (users.length < 200) break;
  }
  log("cleanup: users deleted =", deleted);
}

// -------- SEED --------
async function seed() {
  await cleanupPriorRun();

  // Personas — email carries RUN_ID for safe cleanup.
  const p = (slug, name) => ({ slug, email: `qa+${slug}.${RUN_ID}@qa.taasflow.test`, name });
  const personas = [
    p("platform-admin", `QA Platform Admin ${TAG}`),
    p("operations",     `QA Operations ${TAG}`),
    p("alpha-admin",    `QA Alpha Admin ${TAG}`),
    p("alpha-editor",   `QA Alpha Editor ${TAG}`),
    p("alpha-viewer",   `QA Alpha Viewer ${TAG}`),
    p("beta-admin",     `QA Beta Admin ${TAG}`),
    p("beta-editor",    `QA Beta Editor ${TAG}`),
    p("beta-viewer",    `QA Beta Viewer ${TAG}`),
    p("cand-single",    `QA Candidate Single ${TAG}`),
    p("cand-multi",     `QA Candidate Multi ${TAG}`),
    p("cand-none",      `QA Candidate None ${TAG}`),
    p("deactivated",    `QA Deactivated ${TAG}`),
  ];
  const ids = {};
  for (const per of personas) {
    ids[per.slug] = await ensureUser(per.email, per.name);
    log("user", per.slug, ids[per.slug]);
  }

  // Profiles
  for (const per of personas) {
    const status = per.slug === "deactivated" ? "suspended" : "active";
    await sb.from("profiles").upsert(
      { auth_user_id: ids[per.slug], email: per.email, full_name: per.name, status },
      { onConflict: "auth_user_id" },
    );
  }

  // user_roles (app_role only has: admin, client, candidate)
  const roleRows = [
    { user_id: ids["platform-admin"], role: "admin" },
    { user_id: ids["operations"],     role: "admin" },
    { user_id: ids["alpha-admin"],    role: "client" },
    { user_id: ids["alpha-editor"],   role: "client" },
    { user_id: ids["alpha-viewer"],   role: "client" },
    { user_id: ids["beta-admin"],     role: "client" },
    { user_id: ids["beta-editor"],    role: "client" },
    { user_id: ids["beta-viewer"],    role: "client" },
    { user_id: ids["cand-single"],    role: "candidate" },
    { user_id: ids["cand-multi"],     role: "candidate" },
    { user_id: ids["cand-none"],      role: "candidate" },
  ];
  for (const r of roleRows) {
    await sb.from("user_roles").upsert(r, { onConflict: "user_id,role" });
  }

  // Orgs
  const mkOrg = async (name, domain) => {
    const { data, error } = await sb.from("organizations")
      .insert({ name, status: "active", domain })
      .select("id").single();
    if (error) throw error;
    return data.id;
  };
  const alphaId = await mkOrg(`TaaSFlow QA Client Alpha ${TAG}`, `alpha.${RUN_ID}.qa.test`);
  const betaId  = await mkOrg(`TaaSFlow QA Client Beta ${TAG}`,  `beta.${RUN_ID}.qa.test`);
  log("orgs", { alphaId, betaId });

  // Memberships (platform_admin + operations get membership on both, tagged staff)
  const mems = [
    { user_id: ids["platform-admin"], organization_id: alphaId, role: "platform_admin", status: "active" },
    { user_id: ids["platform-admin"], organization_id: betaId,  role: "platform_admin", status: "active" },
    { user_id: ids["operations"],     organization_id: alphaId, role: "operations",     status: "active" },
    { user_id: ids["operations"],     organization_id: betaId,  role: "operations",     status: "active" },
    { user_id: ids["alpha-admin"],    organization_id: alphaId, role: "client_admin",   status: "active" },
    { user_id: ids["alpha-editor"],   organization_id: alphaId, role: "client_editor",  status: "active" },
    { user_id: ids["alpha-viewer"],   organization_id: alphaId, role: "client_viewer",  status: "active" },
    { user_id: ids["beta-admin"],     organization_id: betaId,  role: "client_admin",   status: "active" },
    { user_id: ids["beta-editor"],    organization_id: betaId,  role: "client_editor",  status: "active" },
    { user_id: ids["beta-viewer"],    organization_id: betaId,  role: "client_viewer",  status: "active" },
    { user_id: ids["deactivated"],    organization_id: alphaId, role: "client_editor",  status: "suspended" },
  ];
  const { error: memErr } = await sb.from("memberships").insert(mems);
  if (memErr) throw memErr;

  // Positions — mix of statuses
  const posSpecs = [
    { org: alphaId, title: "Senior Backend Engineer",  status: "active", visibility: "public",  by: ids["alpha-admin"] },
    { org: alphaId, title: "Product Designer",         status: "active", visibility: "public",  by: ids["alpha-admin"] },
    { org: alphaId, title: "Data Analyst",             status: "draft",  visibility: "private", by: ids["alpha-editor"] },
    { org: alphaId, title: "DevOps Engineer",          status: "paused", visibility: "private", by: ids["alpha-admin"] },
    { org: alphaId, title: "Old Sales Rep",            status: "closed", visibility: "private", by: ids["alpha-admin"] },
    { org: betaId,  title: "Full-Stack Engineer",      status: "active", visibility: "public",  by: ids["beta-admin"] },
    { org: betaId,  title: "Head of Marketing",        status: "active", visibility: "public",  by: ids["beta-admin"] },
    { org: betaId,  title: "Customer Success Manager", status: "draft",  visibility: "private", by: ids["beta-editor"] },
    { org: betaId,  title: "SRE (Paused)",             status: "paused", visibility: "private", by: ids["beta-admin"] },
  ];
  const posIds = {};
  for (const s of posSpecs) {
    const now = new Date().toISOString();
    const isLive = ["active","paused","closed"].includes(s.status);
    const { data, error } = await sb.from("positions").insert({
      organization_id: s.org,
      title: `${s.title} ${TAG}`,
      department: "QA",
      location: "Remote",
      work_model: "remote",
      employment_type: "full_time",
      seniority: "mid",
      description: `QA fixture position for ${s.title}. Auto-seeded by ${RUN_ID}. Do not edit manually.`,
      requirements: ["3+ years relevant experience", "Strong written communication"],
      preferred_requirements: ["Startup experience"],
      dealbreakers: [],
      compensation: { currency: "USD", min: 80000, max: 140000 },
      work_authorization: { required: false },
      status: s.status,
      visibility: s.visibility,
      submitted_at: isLive ? now : null,
      approved_at:  isLive ? now : null,
      published_at: s.status === "active" ? now : null,
      closed_at:    s.status === "closed" ? now : null,
      created_by: s.by,
    }).select("id").single();
    if (error) throw error;
    posIds[`${s.org === alphaId ? "alpha" : "beta"}:${s.title}`] = data.id;
  }
  log("positions", Object.keys(posIds).length);

  // Pick target active positions per org for candidates
  const alphaPositions = Object.entries(posIds).filter(([k])=>k.startsWith("alpha:")).map(([,v])=>v);
  const betaPositions  = Object.entries(posIds).filter(([k])=>k.startsWith("beta:")).map(([,v])=>v);
  const alphaActive = alphaPositions.slice(0, 2); // first 2 active
  const betaActive  = betaPositions.slice(0, 2);

  // Candidate profiles — many, representing lifecycle states
  const stateSpecs = [
    // [slug, stage, admin_status, client_visibility, processing_state]
    ["newly-applied",         "new",              "pending",  "hidden",   "queued"],
    ["parsing-pending",       "new",              "pending",  "hidden",   "parsing"],
    ["parsing-failed",        "new",              "pending",  "hidden",   "failed"],
    ["ocr-required",          "new",              "pending",  "hidden",   "ocr_required"],
    ["enrichment-pending",    "reviewing",        "pending",  "hidden",   "enriching"],
    ["enrichment-complete",   "reviewing",        "pending",  "hidden",   "ready_to_score"],
    ["scoring-pending",       "reviewing",        "pending",  "hidden",   "scoring"],
    ["scoring-failed",        "reviewing",        "pending",  "hidden",   "failed"],
    ["scored-evidence",       "reviewing",        "approved", "visible",  "scored"],
    ["scored-missing",        "reviewing",        "on_hold",  "hidden",   "manual_review_required"],
    ["admin-review",          "reviewing",        "pending",  "hidden",   "manual_review_required"],
    ["client-visible",        "delivered",        "approved", "visible",  "scored"],
    ["shortlisted",           "shortlisted",     "approved", "visible",  "scored"],
    ["interview",             "interview_process","approved","visible",  "scored"],
    ["hired",                 "hired",            "approved", "visible",  "scored"],
    ["not-moving",            "not_moving_forward","approved","visible", "scored"],
    ["archived",              "archived",         "approved", "archived", "scored"],
  ];

  const candidateIds = [];
  let stateIx = 0;
  const orgSets = [
    { org: alphaId, positions: alphaActive, tag: "alpha" },
    { org: betaId,  positions: betaActive,  tag: "beta" },
  ];

  for (const set of orgSets) {
    for (const [slug, stage, admin_status, client_visibility, processing_state] of stateSpecs) {
      const email = `qa+cand.${set.tag}.${slug}.${RUN_ID}@qa.taasflow.test`;
      const fullName = `QA Cand ${set.tag} ${slug} ${TAG}`;
      // candidate_profile (no auth user needed for these)
      const { data: cp, error: cpErr } = await sb.from("candidate_profiles").insert({
        full_name: fullName, email, phone: "+15555550000",
        location: "Remote",
        headline: `QA fixture — ${slug}`,
        skills: ["Python","SQL","Communication"],
        experience: [{ company: "QA Corp", role: "Engineer", years: 3 }],
        consent: { terms: true, privacy: true, marketing: false, ts: new Date().toISOString() },
      }).select("id").single();
      if (cpErr) throw cpErr;

      const positionId = set.positions[stateIx % set.positions.length];
      const { data: appRow, error: appErr } = await sb.from("applications").insert({
        candidate_profile_id: cp.id, position_id: positionId,
        source: "web", status: stage === "archived" ? "archived" : "processing",
      }).select("id").single();
      if (appErr) throw appErr;

      const { data: match, error: mErr } = await sb.from("candidate_matches").insert({
        application_id: appRow.id,
        candidate_profile_id: cp.id,
        position_id: positionId,
        organization_id: set.org,
        stage, admin_status, client_visibility, processing_state,
        processing_error_message: processing_state === "failed" ? "QA fixture: simulated failure" : null,
        processing_error_code: processing_state === "failed" ? "QA_SIM_FAIL" : null,
        delivered_at: ["delivered","shortlisted","interview_process","hired","not_moving_forward","archived"].includes(stage) ? new Date().toISOString() : null,
      }).select("id").single();
      if (mErr) throw mErr;

      // Evidence for scored candidates
      if (processing_state === "scored") {
        await sb.from("candidate_evidence").insert({
          candidate_match_id: match.id,
          candidate_profile_id: cp.id,
          engine_version: "qa-1.0.0",
          extracted: { summary: "QA extracted", skills: ["python","sql"], years: 4 },
          screening_normalized: { authorized_to_work: true },
          raw_text_sample: "QA CV sample text",
        });
      }

      // Client decision for hired / not-moving
      if (stage === "hired" || stage === "not_moving_forward" || stage === "shortlisted") {
        await sb.from("client_decisions").insert({
          candidate_match_id: match.id,
          organization_id: set.org,
          decision: stage === "hired" ? "hire" : stage === "not_moving_forward" ? "not_moving_forward" : "shortlist",
          feedback: "QA seeded decision",
          actor_user_id: set.tag === "alpha" ? ids["alpha-admin"] : ids["beta-admin"],
        });
      }

      candidateIds.push({ tag: set.tag, slug, candidate_profile_id: cp.id, application_id: appRow.id, match_id: match.id, position_id: positionId });
      stateIx++;
    }
  }
  log("matches created", candidateIds.length);

  // -------- Persona-owned candidates (auth-linked) --------
  // cand-single: 1 application to Alpha active
  // cand-multi:  3 applications across both orgs
  // cand-none:   profile exists, no applications
  const linkCandidate = async (userId, email, fullName, positions) => {
    const { data: cp, error } = await sb.from("candidate_profiles").upsert(
      {
        user_id: userId, full_name: fullName, email,
        consent: { terms: true, privacy: true, ts: new Date().toISOString() },
      },
      { onConflict: "user_id" }
    ).select("id").single();
    if (error) throw error;
    const created = [];
    for (const pid of positions) {
      const { data: posMeta } = await sb.from("positions").select("organization_id").eq("id", pid).single();
      const { data: app, error: appErr } = await sb.from("applications").insert({
        candidate_profile_id: cp.id, position_id: pid, source: "web", status: "processing",
      }).select("id").single();
      if (appErr) throw appErr;
      const { data: m, error: mErr } = await sb.from("candidate_matches").insert({
        application_id: app.id, candidate_profile_id: cp.id, position_id: pid,
        organization_id: posMeta.organization_id, stage: "delivered",
        admin_status: "approved", client_visibility: "visible", processing_state: "scored",
        delivered_at: new Date().toISOString(),
      }).select("id").single();
      if (mErr) throw mErr;
      created.push({ position_id: pid, application_id: app.id, match_id: m.id });
    }
    return { candidate_profile_id: cp.id, applications: created };
  };

  const persCand = {};
  persCand.single = await linkCandidate(ids["cand-single"], `qa+cand.single.${RUN_ID}@qa.taasflow.test`, `QA Candidate Single ${TAG}`, [alphaActive[0]]);
  persCand.multi  = await linkCandidate(ids["cand-multi"],  `qa+cand.multi.${RUN_ID}@qa.taasflow.test`,  `QA Candidate Multi ${TAG}`,  [alphaActive[0], alphaActive[1], betaActive[0]]);
  persCand.none   = await linkCandidate(ids["cand-none"],   `qa+cand.none.${RUN_ID}@qa.taasflow.test`,   `QA Candidate None ${TAG}`,   []);

  // Manifest
  const manifest = {
    run_id: RUN_ID,
    tag: TAG,
    generated_at: new Date().toISOString(),
    password_secret: "QA_PERSONA_PASSWORD",
    orgs: { alpha: alphaId, beta: betaId },
    personas: Object.fromEntries(personas.map((p) => [p.slug, { user_id: ids[p.slug], email: p.email, name: p.name }])),
    positions: posIds,
    seeded_candidates: candidateIds,
    persona_candidates: persCand,
    urls: {
      preview: "https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app",
      published: "https://clear-path-hubs.lovable.app",
    },
  };
  fs.mkdirSync("/dev-server/reports/dashboard-recovery", { recursive: true });
  fs.writeFileSync(
    "/dev-server/reports/dashboard-recovery/phase-02-qa-manifest.json",
    JSON.stringify(manifest, null, 2),
  );
  log("manifest written");
  return manifest;
}

const action = process.argv[2] || "seed";
try {
  if (action === "cleanup") {
    await cleanupPriorRun();
    console.log("CLEANUP OK");
  } else {
    const m = await seed();
    console.log("SEED OK: orgs", m.orgs, "matches", m.seeded_candidates.length);
  }
  process.exit(0);
} catch (e) {
  console.error("FAIL", e?.message || e, e?.stack);
  process.exit(1);
}
