/**
 * Diagnostics for pipeline stalls (the OCR gate above all).
 *
 * When a journey parks on `ocr_required`, a bare poll timeout tells you nothing:
 * you still have to go dig for the match's state, the file's parse error and the
 * job rows. These helpers dump that truth into the test output *and* attach it to
 * the Playwright report, plus record failing API responses along the way, so a
 * red run explains itself.
 */
import { test, type Page, type Response } from "@playwright/test";
import { pipelineSnapshot, simulateOcrCompletion, type PipelineSnapshot } from "./qa";

const OCR_REMEDY =
  "The CV had no usable text layer, so extraction asked for OCR. Fixtures must upload a " +
  "text-layer PDF (tests/e2e/fixtures/text-layer-cv.ts); a scan-only PDF cannot progress " +
  "without an OCR runner. Call resolveOcrGate(matchId) to simulate the OCR result in " +
  "test mode so review and publication stay reachable.";

/** Compact one-line summary of where a match actually is. */
export function summarizeSnapshot(snap: PipelineSnapshot): string {
  const m = snap.match;
  const f = snap.file;
  return [
    `processing_state=${m.processing_state}`,
    `error=${m.processing_error_code ?? "none"}`,
    `admin_status=${m.admin_status}`,
    `client_visibility=${m.client_visibility}`,
    `score=${snap.score?.total_score ?? "none"}`,
    f
      ? `file=${f.filename} parse_state=${f.parse_state ?? "none"} parse_error=${f.parse_error_code ?? "none"} attempts=${f.extraction_attempts ?? 0} parser=${f.parser ?? "none"}`
      : "file=none",
    `jobs=[${snap.jobs.map((j) => `${j.job_type}:${j.status}${j.error_code ? `(${j.error_code})` : ""}`).join(", ")}]`,
  ].join(" | ");
}

/**
 * Logs and attaches the full pipeline truth for one match. Never throws — it is
 * called from failure paths where the real error must survive.
 */
export async function logPipelineState(
  matchId: string,
  label: string,
): Promise<PipelineSnapshot | null> {
  try {
    const snap = await pipelineSnapshot(matchId);
    console.log(`[pipeline:${label}] ${matchId} → ${summarizeSnapshot(snap)}`);
    await test
      .info()
      .attach(`pipeline-${label}-${matchId}.json`, {
        body: JSON.stringify(snap, null, 2),
        contentType: "application/json",
      })
      .catch(() => undefined);
    return snap;
  } catch (err) {
    console.log(`[pipeline:${label}] ${matchId} → snapshot unavailable: ${String(err)}`);
    return null;
  }
}

/**
 * Polls a match until its processing_state matches, logging every transition.
 * On timeout it dumps the snapshot and throws an error that names the state it
 * is stuck in — and, for `ocr_required`, how to fix the fixture.
 */
export async function waitForProcessingState(
  matchId: string,
  matcher: RegExp,
  opts: { timeout?: number; intervalMs?: number; label?: string } = {},
): Promise<string> {
  const timeout = opts.timeout ?? 180_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const label = opts.label ?? "wait";
  const deadline = Date.now() + timeout;
  const seen: string[] = [];
  let last: PipelineSnapshot | null = null;

  while (Date.now() < deadline) {
    let state = "unknown";
    try {
      last = await pipelineSnapshot(matchId);
      state = last.match.processing_state;
    } catch (err) {
      console.log(`[pipeline:${label}] snapshot read failed: ${String(err)}`);
    }
    if (seen[seen.length - 1] !== state) {
      seen.push(state);
      console.log(`[pipeline:${label}] ${matchId} state → ${state}`);
    }
    if (matcher.test(state)) return state;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const stuck = last?.match.processing_state ?? "unknown";
  if (last) await logPipelineState(matchId, `${label}-timeout`);
  const detail = last ? `\n  ${summarizeSnapshot(last)}` : "";
  const remedy = stuck === "ocr_required" ? `\n  ${OCR_REMEDY}` : "";
  throw new Error(
    `Pipeline never reached ${matcher} for match ${matchId} within ${Math.round(timeout / 1000)}s.\n` +
      `  states seen: ${seen.join(" → ") || "none"}${detail}${remedy}`,
  );
}

export type ApiFailureLog = { failures: string[] };

/**
 * Records non-OK app API / server-function responses (status + trimmed body) so a
 * stalled journey shows which backend call refused, not just a UI timeout.
 */
export function captureApiFailures(page: Page): ApiFailureLog {
  const failures: string[] = [];
  const relevant = (url: string) =>
    url.includes("/api/") || url.includes("_serverFn") || url.includes("/rest/v1/");

  const onResponse = async (res: Response) => {
    const url = res.url();
    if (res.status() < 400 || !relevant(url)) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 600);
    } catch {
      body = "<body unavailable>";
    }
    const line = `${res.status()} ${res.request().method()} ${url} :: ${body}`;
    failures.push(line);
    console.log(`[api:failure] ${line}`);
  };

  page.on("response", (res) => void onResponse(res));
  return { failures };
}

/** Attaches captured API failures to the report; safe to call unconditionally. */
export async function attachApiFailures(log: ApiFailureLog, label: string): Promise<void> {
  if (!log.failures.length) return;
  await test
    .info()
    .attach(`api-failures-${label}.txt`, {
      body: log.failures.join("\n"),
      contentType: "text/plain",
    })
    .catch(() => undefined);
}

/**
 * Clears the OCR gate in test mode.
 *
 * With no OCR runner in the suite, a match parked on `ocr_required` blocks admin
 * review and client publication for the rest of the journey. When (and only
 * when) the match is actually stuck there, this asks the QA endpoint to write an
 * OCR result onto the canonical file and re-run the real enrich + score steps.
 * A match that is already progressing is left untouched.
 *
 * Returns the state the match is in afterwards.
 */
export async function resolveOcrGate(matchId: string, label = "ocr-gate"): Promise<string> {
  let snap: PipelineSnapshot | null = null;
  try {
    snap = await pipelineSnapshot(matchId);
  } catch (err) {
    console.log(`[pipeline:${label}] snapshot read failed: ${String(err)}`);
    return "unknown";
  }
  const state = snap.match.processing_state;
  if (state !== "ocr_required") return state;

  console.log(`[pipeline:${label}] ${matchId} parked on ocr_required — simulating OCR completion`);
  const res = await simulateOcrCompletion(matchId);
  console.log(
    `[pipeline:${label}] ${matchId} simulated OCR (${res.simulated_ocr_chars} chars) → ${res.final_state}`,
  );
  await test
    .info()
    .attach(`simulated-ocr-${matchId}.json`, {
      body: JSON.stringify(res, null, 2),
      contentType: "application/json",
    })
    .catch(() => undefined);
  return res.final_state;
}
