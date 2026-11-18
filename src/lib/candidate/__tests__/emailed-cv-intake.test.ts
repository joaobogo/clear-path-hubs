/**
 * A CV received by email becomes an application with the same records the
 * apply form writes, from source_channel 'direct_email' so the candidate is
 * sent the role's screening questions once. Nothing is approved, published,
 * answered or scored here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cv-validation", () => ({
  validateCv: async () => ({
    ok: true,
    sha256: "abc123",
    page_count: 2,
    detected_mime: "application/pdf",
  }),
  sanitizeFilename: (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, "_"),
}));
vi.mock("@/lib/cv-extractor.server", () => ({
  extractCvText: async () => ({ needs_ocr: false, text: "CV text", chars: 7 }),
}));
vi.mock("@/lib/qa-guard", () => ({ assertNoQaContamination: async () => ({ ok: true }) }));
const emitted: unknown[] = [];
vi.mock("@/lib/notifications.functions", () => ({
  emitEventFromServer: async (e: unknown) => {
    emitted.push(e);
    return { event_id: "e1", delivered: 1 };
  },
}));

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const uploads: string[] = [];
let staff = true;

class Q {
  private f: Array<(r: Row) => boolean> = [];
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  constructor(private t: string) {}
  select() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.f.push((r) => r[k] === v);
    return this;
  }
  ilike(k: string, v: string) {
    this.f.push((r) => String(r[k] ?? "").toLowerCase() === v.toLowerCase());
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(p: Row) {
    this.op = "update";
    this.payload = p;
    return this;
  }
  private run() {
    const rows = (db[this.t] ??= []);
    if (this.op === "insert") {
      const row = { id: `${this.t}-${rows.length + 1}`, ...this.payload };
      rows.push(row);
      return { data: [row], error: null };
    }
    const hit = rows.filter((r) => this.f.every((f) => f(r)));
    if (this.op === "update") for (const r of hit) Object.assign(r, this.payload);
    return { data: hit, error: null };
  }
  maybeSingle() {
    const r = this.run();
    return Promise.resolve({ data: r.data[0] ?? null, error: null });
  }
  single() {
    return this.maybeSingle();
  }
  then<T>(res: (v: { data: Row[]; error: null }) => T) {
    return Promise.resolve(this.run()).then(res);
  }
}

const admin = {
  from: (t: string) => new Q(t),
  rpc: async () => ({ data: staff, error: null }),
  storage: {
    from: () => ({
      upload: async (path: string) => {
        uploads.push(path);
        return { error: null };
      },
    }),
  },
};

const STAFF = "11111111-1111-4111-8111-111111111111";
const ROLE = "22222222-2222-4222-8222-222222222222";
const input = {
  position_id: ROLE,
  actor_user_id: STAFF,
  full_name: "Sam  Rivera",
  email: "Sam.Rivera@Example.com",
  phone: "555-010-2233",
  city: "New York",
  country: "United States",
  cv: {
    filename: "application resume.pdf",
    mime: "application/pdf",
    base64: btoa("x".repeat(200)),
  },
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  uploads.length = 0;
  emitted.length = 0;
  staff = true;
  db.profiles = [{ id: "p-staff", auth_user_id: STAFF }];
  db.positions = [
    { id: ROLE, organization_id: "org-1", title: "Billing Manager", status: "active" },
  ];
});

describe("enterEmailedCv", () => {
  it("writes the apply form's records, from the direct-email channel", async () => {
    const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
    const out = await enterEmailedCv(admin, input);
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    const profile = db.candidate_profiles![0]!;
    expect(profile).toMatchObject({
      full_name: "Sam Rivera",
      email: "sam.rivera@example.com",
      phone: "555-010-2233",
      location: "New York, United States",
      current_cv_file_id: out.file_id,
    });
    expect(uploads[0]).toMatch(
      new RegExp(`^candidate/${profile.id}/[0-9a-f-]{36}-application_resume\\.pdf$`),
    );
    expect(db.files![0]).toMatchObject({
      storage_bucket: "cvs",
      parse_state: "queued",
      file_status: "ready",
      upload_source: "candidate_application",
      page_count: 2,
    });
    const app = db.applications![0]!;
    expect(app).toMatchObject({
      source: "staff_entry:direct_email",
      source_channel: "direct_email",
      status: "submitted",
      cv_file_id: out.file_id,
    });
    // No question_version: the screening link may ask this person.
    expect((app.consent as Row).question_version).toBeUndefined();
    expect(db.candidate_matches![0]).toMatchObject({
      stage: "new",
      admin_status: "pending",
      client_visibility: "hidden",
      eligibility_status: "eligible",
      processing_state: "queued",
    });
    expect(db.processing_jobs![0]).toMatchObject({ job_type: "parse_and_score", status: "queued" });
    expect(db.audit_events![0]).toMatchObject({
      action: "application_entered_from_email",
      actor_user_id: STAFF,
    });
    expect(emitted).toHaveLength(1);
    // Never a score, an answer or an approval.
    expect(db.score_runs).toBeUndefined();
    expect(db.application_answers).toBeUndefined();
  });

  it("the link check treats it as an application that may be asked the questions", async () => {
    const { screeningLinkSource } = await import("@/lib/candidate/screening-invite");
    const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
    await enterEmailedCv(admin, input);
    expect(screeningLinkSource(db.applications![0] as never)).toEqual({ ok: true });
  });

  it("a held invitation is skipped by the sweep but still sendable by staff", async () => {
    const { decideAutomaticInvite, decideStaffInvite } =
      await import("@/lib/candidate/screening-invite");
    const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
    await enterEmailedCv(admin, { ...input, hold_screening_invite: true });
    const app = db.applications![0]!;
    expect(app).toMatchObject({
      screening_invite_status: "not_needed",
      screening_invite_error_code: "held_by_staff",
    });
    const created_at = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(
      decideAutomaticInvite({
        app: { ...(app as never), created_at, withdrawn_at: null },
        questionCount: 4,
        answerCount: 0,
        hasEmail: true,
      }),
    ).toEqual({ action: "skip", reason: "already_decided" });
    expect(
      decideStaffInvite({
        app: { ...(app as never), withdrawn_at: null },
        positionStatus: "active",
        questions: [{ id: "q1", question: "Q", answer_type: "yes_no", required: true }],
        answeredIds: [],
        hasEmail: true,
      }),
    ).toEqual({ ok: true });

    // Without the hold the marker stays NULL, so the sweep decides as usual.
    await enterEmailedCv(admin, { ...input, email: "other@example.com" });
    expect(db.applications![1]!.screening_invite_status).toBeUndefined();
  });

  it("an existing profile keeps its details; only blanks are filled", async () => {
    db.candidate_profiles = [
      {
        id: "cp-1",
        email: "sam.rivera@example.com",
        full_name: "Samuel Rivera",
        phone: null,
        current_cv_file_id: "f-old",
      },
    ];
    const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
    const out = await enterEmailedCv(admin, input);
    expect(out.ok && out.profile_existed).toBe(true);
    expect(db.candidate_profiles[0]).toMatchObject({
      full_name: "Samuel Rivera",
      phone: "555-010-2233",
      current_cv_file_id: "f-old",
    });
  });

  it("refuses a second open application, a closed role and a non-staff actor", async () => {
    const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
    expect((await enterEmailedCv(admin, input)).ok).toBe(true);
    expect(await enterEmailedCv(admin, input)).toMatchObject({
      ok: false,
      code: "already_applied",
    });

    db.positions![0]!.status = "closed";
    expect(await enterEmailedCv(admin, { ...input, email: "other@example.com" })).toMatchObject({
      ok: false,
      code: "position_unavailable",
    });
    staff = false;
    expect(await enterEmailedCv(admin, { ...input, email: "third@example.com" })).toMatchObject({
      ok: false,
      code: "actor_not_staff",
    });
  });
});
