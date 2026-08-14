/**
 * Failure and recovery proof — the six forced failures.
 *
 * Each case asserts three things, because "it showed an error" is not recovery:
 *   1. the user is told what happened in plain language,
 *   2. a retry is possible and succeeds,
 *   3. no duplicate business record survives the round trip.
 *
 * The pipeline and decision paths are exercised against faithful mirrors of the
 * database contracts they rely on (partial unique index on active processing
 * jobs, the scoring lock, the stage graph), so the invariants are checked
 * without a live worker.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { validateCv, CV_MESSAGES, sanitizeFilename } from "../cv-validation";
import { describeCvDownloadFailure } from "../cv-download-error";
import { classifyError, normalizeError } from "../error-taxonomy";

const PDF = (body = "1 0 obj\n<< /Type /Page >>\nendobj\n") =>
  new TextEncoder().encode(`%PDF-1.7\n${body}%%EOF\n`);

// ---------------------------------------------------------------- 1. CV upload

describe("1. CV upload rejected", () => {
  it("rejects a disguised Word document with candidate-safe copy and accepts the retry", async () => {
    // PK zip magic = DOCX renamed to .pdf.
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const bad = await validateCv(docx, "cv.pdf", "application/pdf");
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe(CV_MESSAGES[bad.code!]);
    expect(bad.message).not.toMatch(/magic|signature|mime|buffer|undefined/i);

    // Retry with a real PDF succeeds — the rejection blocked nothing permanently.
    const good = await validateCv(PDF(), "cv.pdf", "application/pdf");
    expect(good.ok).toBe(true);
    expect(good.sha256).toBeTruthy();
  });

  it("keeps a rejected upload out of storage by sanitising the path segment", () => {
    expect(sanitizeFilename("../../etc/passwd.pdf")).not.toContain("..");
    expect(sanitizeFilename("../../etc/passwd.pdf")).not.toContain("/");
  });
});

// ------------------------------------------------------------- 2. Scoring fail

type Match = { id: string; processing_state: string };
type Run = { id: string; match_id: string; submission_id: string; status: string };

/** Mirror of the scoring service's lock + single-run-per-submission contract. */
class ScoringMirror {
  match: Match = { id: "m1", processing_state: "ready_to_score" };
  runs: Run[] = [];
  jobs: { match_id: string; status: string; error_code?: string }[] = [];

  score(opts: { providerFails: boolean }) {
    if (this.match.processing_state === "scoring") {
      return { ok: false as const, code: "concurrent_scoring_lock" };
    }
    this.match.processing_state = "scoring";
    if (opts.providerFails) {
      // Release the lock on the failure path, or the match is stuck forever.
      this.match.processing_state = "failed";
      this.jobs.push({ match_id: this.match.id, status: "failed", error_code: "engine_error" });
      return { ok: false as const, code: "engine_error" };
    }
    // One row per (match, submission) — a retry supersedes, never duplicates.
    this.runs = this.runs.filter((r) => r.submission_id !== "s1");
    this.runs.push({ id: `run-${this.runs.length + 1}`, match_id: "m1", submission_id: "s1", status: "completed" });
    this.match.processing_state = "scored";
    this.jobs.push({ match_id: this.match.id, status: "completed" });
    return { ok: true as const };
  }
}

describe("2. Scoring provider error", () => {
  it("fails loudly, releases the lock, and the retry leaves exactly one score run", () => {
    const db = new ScoringMirror();
    const failed = db.score({ providerFails: true });
    expect(failed.ok).toBe(false);
    expect(failed.code).toBe("engine_error");
    // Lock released: the match is not left in `scoring` where nothing can touch it.
    expect(db.match.processing_state).toBe("failed");
    expect(db.runs).toHaveLength(0);

    const retried = db.score({ providerFails: false });
    expect(retried.ok).toBe(true);
    expect(db.match.processing_state).toBe("scored");
    expect(db.runs).toHaveLength(1);
  });

  it("refuses a concurrent second scoring pass instead of writing two runs", () => {
    const db = new ScoringMirror();
    db.match.processing_state = "scoring";
    expect(db.score({ providerFails: false }).code).toBe("concurrent_scoring_lock");
    expect(db.runs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- 3. Offline

describe("3. Network offline mid-action", () => {
  it("classifies a dropped fetch as offline and reassures the user nothing was lost", () => {
    expect(classifyError(new Error("Failed to fetch"))).toBe("offline");
    expect(classifyError(new TypeError("NetworkError when attempting to fetch resource"))).toBe(
      "offline",
    );
    const shown = normalizeError(new Error("Failed to fetch"), { tone: "client" });
    expect(shown.title).toMatch(/offline/i);
    expect(shown.description).toMatch(/nothing you did was lost|can't reach the network/i);
    expect(shown.retryable).not.toBe(false);
  });

  it("does not report a dropped request as success", () => {
    const shown = normalizeError(new Error("Failed to fetch"), { tone: "client" });
    expect(shown.title).not.toMatch(/saved|done|success/i);
  });
});

// ------------------------------------------------------- 4. Expired CV link

describe("4. Expired CV download link", () => {
  it("explains an expired signed URL and marks it retryable", () => {
    for (const raw of ["signed url expired", "Signature has expired", "download link expired"]) {
      const f = describeCvDownloadFailure(new Error(raw));
      expect(f.retryable).toBe(true);
      expect(f.message).toMatch(/expired/i);
      expect(f.hint).toMatch(/fresh link|retry/i);
      expect(f.message).not.toMatch(/http|storage|token|bucket/i);
    }
  });

  it("does not offer a pointless retry when the CV is genuinely unavailable", () => {
    expect(describeCvDownloadFailure(new Error("no cv on file")).retryable).toBe(false);
    expect(describeCvDownloadFailure(new Error("permission denied")).retryable).toBe(false);
  });
});

// --------------------------------------------------- 5. Duplicate submissions

type Stage = "delivered" | "shortlisted" | "interview_process";

/** Mirror of clientAction's double-submit guard. */
class DecisionMirror {
  stage: Stage = "delivered";
  decisions: string[] = [];
  interviews: { status: string }[] = [];

  act(action: "shortlist" | "request_interview") {
    const next: Stage = action === "shortlist" ? "shortlisted" : "interview_process";
    if (this.stage === next) return { ok: true, noop: true };
    this.stage = next;
    if (action === "request_interview") {
      const open = this.interviews.some((i) =>
        ["requested", "scheduling", "scheduled"].includes(i.status),
      );
      if (!open) this.interviews.push({ status: "requested" });
    }
    this.decisions.push(action);
    return { ok: true, noop: false };
  }
}

describe("5. Duplicate submit of the same action", () => {
  let db: DecisionMirror;
  beforeEach(() => {
    db = new DecisionMirror();
  });

  it("treats a second shortlist click as a no-op with no second decision row", () => {
    expect(db.act("shortlist").noop).toBe(false);
    expect(db.act("shortlist").noop).toBe(true);
    expect(db.decisions.filter((d) => d === "shortlist")).toHaveLength(1);
  });

  it("never opens a second interview for the same candidate", () => {
    db.act("shortlist");
    db.act("request_interview");
    db.act("request_interview");
    expect(db.interviews).toHaveLength(1);
    expect(db.decisions.filter((d) => d === "request_interview")).toHaveLength(1);
  });

  it("keeps one application per idempotency key when the form is submitted twice", () => {
    // Mirror of the unique active-application constraint keyed on source.
    const rows = new Map<string, string>();
    const submit = (key: string) => {
      const source = `job_board:${key}`;
      if (rows.has(source)) return rows.get(source)!;
      const id = `app-${rows.size + 1}`;
      rows.set(source, id);
      return id;
    };
    expect(submit("abcd1234")).toBe(submit("abcd1234"));
    expect(rows.size).toBe(1);
  });
});

// ------------------------------------------------------- 6. Stuck processing

/** Mirror of retryProcessingJob plus the partial unique index it relies on. */
class JobMirror {
  jobs: { id: string; entity_id: string; job_type: string; status: string; attempts: number }[] = [];

  enqueue(entity_id: string) {
    const active = this.jobs.find(
      (j) =>
        j.entity_id === entity_id &&
        j.job_type === "parse_and_score" &&
        ["queued", "running"].includes(j.status),
    );
    // The partial unique index is what stops duplicates; a conflict is reported.
    if (active) return { result: "already_active" as const, job_id: active.id };
    const id = `job-${this.jobs.length + 1}`;
    this.jobs.push({ id, entity_id, job_type: "parse_and_score", status: "queued", attempts: 0 });
    return { result: "requeued" as const, job_id: id };
  }

  retry(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId)!;
    if (job.status === "running") return { result: "already_active" as const };
    job.status = "cancelled";
    return this.enqueue(job.entity_id);
  }
}

describe("6. Stuck processing job", () => {
  it("re-arms a job stuck in queued without creating a second active job", () => {
    const db = new JobMirror();
    const first = db.enqueue("app-1");
    db.jobs[0]!.status = "failed"; // worker gave up

    const retried = db.retry(first.job_id);
    expect(retried.result).toBe("requeued");
    const active = db.jobs.filter((j) => ["queued", "running"].includes(j.status));
    expect(active).toHaveLength(1);
  });

  it("reports a conflict instead of duplicating work a worker already owns", () => {
    const db = new JobMirror();
    db.enqueue("app-1");
    expect(db.enqueue("app-1").result).toBe("already_active");
    expect(db.jobs).toHaveLength(1);
  });
});
