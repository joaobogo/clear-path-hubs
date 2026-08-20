/**
 * Canonical loading and processing vocabulary.
 *
 * Every long-running surface in the product describes itself from this file so
 * users always get the same four answers: what is running, which supported
 * stage it is on, whether they can leave, and what happens if it fails.
 *
 * Rules encoded here:
 *  - No fabricated percentages. Progress is either a known stage index out of a
 *    known stage list, or explicitly indeterminate.
 *  - Agent stages are described in product terms only. No prompts, no model
 *    reasoning, no internal implementation detail.
 *  - Anything that keeps running server-side is marked background-safe so the
 *    UI can tell people it is safe to navigate away.
 */

export type ProcessKey =
  | "page"
  | "table"
  | "agent_run"
  | "blueprint"
  | "evidence"
  | "scoring"
  | "sync"
  | "file"
  | "analytics"
  | "integration";

export interface ProcessStage {
  /** Stable key, safe to persist and compare. */
  key: string;
  /** Product-language label for the stage. */
  label: string;
  /** One line explaining what the platform does in this stage. */
  detail: string;
}

export interface ProcessDefinition {
  key: ProcessKey;
  /** Verb phrase used while running, e.g. "Compiling the blueprint". */
  running: string;
  /** Shown when the work finished successfully. */
  done: string;
  /** Shown when the work failed. */
  failed: string;
  /** Copy for the retry control. */
  retryLabel: string;
  /** Known stages, in order. Empty means duration and stages are unknown. */
  stages: ProcessStage[];
  /** True when the work continues server-side if the user navigates away. */
  backgroundSafe: boolean;
  /** Explicit navigation-away guidance. */
  navigationNote: string;
  /** Honest timing statement, or null when we genuinely cannot say. */
  typicalTiming: string | null;
}

const DEF = <T extends Record<ProcessKey, ProcessDefinition>>(d: T) => d;

export const PROCESS_CATALOGUE = DEF({
  page: {
    key: "page",
    running: "Loading this screen",
    done: "Screen ready",
    failed: "This screen could not load",
    retryLabel: "Reload screen",
    stages: [],
    backgroundSafe: false,
    navigationNote: "Nothing is being changed — you can navigate away at any time.",
    typicalTiming: null,
  },
  table: {
    running: "Loading records",
    key: "table",
    done: "Records loaded",
    failed: "These records could not load",
    retryLabel: "Try again",
    stages: [],
    backgroundSafe: false,
    navigationNote: "Nothing is being changed — you can navigate away at any time.",
    typicalTiming: null,
  },
  agent_run: {
    key: "agent_run",
    running: "Agent run in progress",
    done: "Agent run complete",
    failed: "The processing step stopped before it finished",
    retryLabel: "Start the run again",
    stages: [
      {
        key: "accepted",
        label: "Run accepted",
        detail: "The run is queued against this role and recorded in activity.",
      },
      {
        key: "reading_role",
        label: "Reading the role",
        detail: "Requirements, must-haves and screening rules are loaded.",
      },
      {
        key: "working",
        label: "Working through candidates",
        detail: "Candidates are identified and prepared for evidence extraction.",
      },
      {
        key: "recording",
        label: "Recording results",
        detail: "Findings and any decisions needed from you are written to the role.",
      },
    ],
    backgroundSafe: true,
    navigationNote:
      "This run continues on our side. You can leave this screen — activity and notifications will show the result.",
    typicalTiming: "Usually minutes, longer for large candidate sets.",
  },
  blueprint: {
    key: "blueprint",
    running: "Compiling the blueprint",
    done: "Blueprint compiled",
    failed: "The blueprint could not be compiled",
    retryLabel: "Compile again",
    stages: [
      {
        key: "reading_intake",
        label: "Reading your intake",
        detail: "Role, seniority, location and commercial context are read.",
      },
      {
        key: "structuring",
        label: "Structuring requirements",
        detail: "Must-haves, nice-to-haves and screening questions are drafted.",
      },
      {
        key: "weights",
        label: "Setting assessment weights",
        detail: "Each requirement gets a weight so assessments stay comparable.",
      },
      {
        key: "review",
        label: "Ready for your review",
        detail: "Nothing is applied to the role until you approve it.",
      },
    ],
    backgroundSafe: false,
    navigationNote: "Stay on this screen — the draft is discarded if you leave before saving.",
    typicalTiming: "Usually under a minute.",
  },
  evidence: {
    key: "evidence",
    running: "Extracting evidence",
    done: "Evidence extracted",
    failed: "Evidence extraction did not complete",
    retryLabel: "Extract again",
    stages: [
      { key: "reading_cv", label: "Reading the CV", detail: "The document text is prepared." },
      {
        key: "locating",
        label: "Locating supporting passages",
        detail: "Each requirement is matched to specific passages in the document.",
      },
      {
        key: "linking",
        label: "Linking findings to requirements",
        detail: "Findings are attached to the requirement they support.",
      },
      {
        key: "verification",
        label: "Ready for verification",
        detail: "Findings are held for human verification before they count.",
      },
    ],
    backgroundSafe: true,
    navigationNote:
      "Extraction continues on our side. You can leave — the candidate updates when it finishes.",
    typicalTiming: "Usually a minute or two per candidate.",
  },
  scoring: {
    key: "scoring",
    running: "Assessing against the role",
    done: "Assessment complete",
    failed: "This assessment did not complete",
    retryLabel: "Assess again",
    stages: [
      {
        key: "eligibility",
        label: "Checking eligibility",
        detail: "Hard requirements are checked before anything else runs.",
      },
      {
        key: "coverage",
        label: "Measuring requirement coverage",
        detail: "Verified evidence is compared to each requirement.",
      },
      {
        key: "assembling",
        label: "Assembling the assessment",
        detail: "Coverage and weights produce a result you can inspect line by line.",
      },
      {
        key: "recorded",
        label: "Recorded",
        detail: "The assessment is stored immutably with the evidence behind it.",
      },
    ],
    backgroundSafe: true,
    navigationNote:
      "Assessment continues on our side. You can leave — the candidate updates when it finishes.",
    typicalTiming: "Usually under a minute per candidate.",
  },
  sync: {
    key: "sync",
    running: "Synchronising data",
    done: "Everything is up to date",
    failed: "Synchronisation did not finish",
    retryLabel: "Sync again",
    stages: [],
    backgroundSafe: true,
    navigationNote: "Syncing continues in the background — it is safe to keep working.",
    typicalTiming: null,
  },
  file: {
    key: "file",
    running: "Processing the file",
    done: "File processed",
    failed: "This file could not be processed",
    retryLabel: "Upload again",
    stages: [
      { key: "uploading", label: "Uploading", detail: "The file is transferred securely." },
      { key: "checking", label: "Checking the file", detail: "Type and size are validated." },
      { key: "reading", label: "Reading the contents", detail: "The document text is prepared." },
      { key: "stored", label: "Stored", detail: "The file is attached and privately stored." },
    ],
    backgroundSafe: false,
    navigationNote: "Stay on this screen until the upload finishes, or it will need to start over.",
    typicalTiming: "Usually a few seconds.",
  },
  analytics: {
    key: "analytics",
    running: "Calculating",
    done: "Figures updated",
    failed: "These figures could not be calculated",
    retryLabel: "Recalculate",
    stages: [],
    backgroundSafe: false,
    navigationNote: "Nothing is being changed — you can navigate away at any time.",
    typicalTiming: null,
  },
  integration: {
    key: "integration",
    running: "Connecting",
    done: "Connection confirmed",
    failed: "The connection could not be established",
    retryLabel: "Test the connection again",
    stages: [
      { key: "reaching", label: "Reaching the provider", detail: "We open a test request." },
      {
        key: "credentials",
        label: "Checking credentials",
        detail: "The stored credentials are verified against the provider.",
      },
      {
        key: "recording",
        label: "Recording the result",
        detail: "The outcome is written to integration health so it can be audited.",
      },
    ],
    backgroundSafe: false,
    navigationNote: "This finishes in a few seconds — stay on this screen for the result.",
    typicalTiming: "Usually a few seconds.",
  },
});

export type ProcessPhase = "idle" | "running" | "background" | "done" | "failed";

export interface ProcessStatus {
  process: ProcessKey;
  phase: ProcessPhase;
  /** Index into the definition's stages. Omit when the stage is unknown. */
  stageIndex?: number;
  /** Extra plain-language line, e.g. "3 of 8 candidates recorded". */
  note?: string;
  /** User-safe failure explanation. Never a raw provider error. */
  errorMessage?: string;
}

export function processDefinition(key: ProcessKey): ProcessDefinition {
  return PROCESS_CATALOGUE[key];
}

/**
 * Stage progress is only reported when we genuinely know the stage. Callers
 * that do not know it get an indeterminate presentation instead of a guess.
 */
export function stageProgress(
  status: ProcessStatus,
): { current: ProcessStage; index: number; total: number } | null {
  const def = processDefinition(status.process);
  if (def.stages.length === 0) return null;
  if (status.stageIndex == null) return null;
  const index = Math.max(0, Math.min(status.stageIndex, def.stages.length - 1));
  return { current: def.stages[index]!, index, total: def.stages.length };
}

/** Single sentence a screen reader can announce for any process state. */
export function announcement(status: ProcessStatus): string {
  const def = processDefinition(status.process);
  switch (status.phase) {
    case "running": {
      const stage = stageProgress(status);
      return stage
        ? `${def.running}. Stage ${stage.index + 1} of ${stage.total}: ${stage.current.label}.`
        : `${def.running}. Still working.`;
    }
    case "background":
      return `${def.running}. Running in the background — safe to leave this screen.`;
    case "done":
      return def.done;
    case "failed":
      return `${def.failed}. ${status.errorMessage ?? ""}`.trim();
    default:
      return "";
  }
}

/**
 * Maps a candidate's stored processing state onto the shared process
 * vocabulary. Everything here is derived from the record — no timers, no
 * guessed stages — and describes only supported stages in product language.
 */
export function candidateProcessStatus(state: string): ProcessStatus | null {
  switch (state) {
    case "queued":
      return { process: "evidence", phase: "background", stageIndex: 0 };
    case "parsing":
      return { process: "evidence", phase: "background", stageIndex: 0 };
    case "parsed":
      return { process: "evidence", phase: "background", stageIndex: 1 };
    case "enriching":
      return { process: "evidence", phase: "background", stageIndex: 2 };
    case "ready_to_score":
      return { process: "scoring", phase: "background", stageIndex: 0 };
    case "scoring":
      return { process: "scoring", phase: "background", stageIndex: 1 };
    case "scored":
      return { process: "scoring", phase: "done" };
    case "failed":
      return {
        process: "evidence",
        phase: "failed",
        errorMessage: "Processing stopped before evidence was recorded.",
      };
    case "provider_blocked":
      return {
        process: "evidence",
        phase: "failed",
        errorMessage: "An upstream service refused the request, so nothing was recorded.",
      };
    case "ocr_required":
      return {
        process: "file",
        phase: "failed",
        errorMessage: "The document could not be read as text and needs OCR before evidence work.",
      };
    case "manual_review_required":
      return {
        process: "evidence",
        phase: "failed",
        errorMessage: "This candidate needs a human check before processing continues.",
      };
    default:
      return null;
  }
}
