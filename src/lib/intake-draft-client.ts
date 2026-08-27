import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadIntakeDraft,
  markIntakeDraftSubmitted,
  saveIntakeDraft,
  type IntakeDraftStatus,
} from "@/lib/intake-draft.functions";
import { stripNeverPersisted } from "@/lib/intake-draft-shared";

/**
 * Draft persistence for the intake form.
 *
 * Every save is a server write. The "Saved" marker only moves once that write
 * returns, so it can never promise something the database has not accepted. A
 * failed save leaves the answers on screen and retries quietly in the
 * background; the client can also force a save by hand.
 */

type Loaded = {
  status: IntakeDraftStatus;
  payload: Record<string, unknown> | null;
  lastStep: number;
  savedAt: string | null;
};

/**
 * Local mirror of the saved draft.
 *
 * The server keeps the authoritative draft, keyed to a private httpOnly token
 * cookie. Some browsing contexts drop that cookie (embedded frames, blocked
 * third-party cookies, a cleared jar), and without a second copy the client
 * comes back to an empty form after ten minutes of typing. So every accepted
 * save is also mirrored in this browser, and a visit that finds no server draft
 * falls back to it. Passwords and consent ticks are stripped first, exactly as
 * they are server-side.
 */
const MIRROR_KEY = "tf_intake_draft_mirror";

type Mirror = { payload: Record<string, unknown>; lastStep: number; savedAt: string | null };

export function writeDraftMirror(payload: Record<string, unknown>, lastStep: number, savedAt: string | null) {
  try {
    const body: Mirror = { payload: stripNeverPersisted(payload), lastStep, savedAt };
    localStorage.setItem(MIRROR_KEY, JSON.stringify(body));
  } catch {
    /* storage unavailable — the server copy still stands */
  }
}

export function readDraftMirror(): Mirror | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Mirror;
    if (!parsed || typeof parsed !== "object" || !parsed.payload) return null;
    if (Object.keys(parsed.payload).length === 0) return null;
    return {
      payload: stripNeverPersisted(parsed.payload),
      lastStep: Number(parsed.lastStep ?? 0) || 0,
      savedAt: parsed.savedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function clearDraftMirror() {
  try {
    localStorage.removeItem(MIRROR_KEY);
  } catch {
    /* nothing to clear */
  }
}

async function postDraft(body: Record<string, unknown>) {
  const res = await fetch("/api/public/intake-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`draft_${res.status}`);
  return (await res.json()) as Record<string, any>;
}

/** Loads the draft that belongs to this visitor — account first, token otherwise. */
export async function fetchIntakeDraft(
  authed: boolean,
  accountEmail?: string | null,
): Promise<Loaded> {
  if (authed) {
    const r = await loadIntakeDraft();
    const loaded: Loaded = {
      status: r.status,
      payload: r.payload as Record<string, unknown> | null,
      lastStep: r.lastStep ?? 0,
      savedAt: r.updatedAt ?? null,
    };
    if (loaded.status === "restored" && loaded.payload) return withMirrorFallback(loaded);
    // The account has no draft yet, which is exactly what happens after a
    // full-page Google return: adopt whatever was typed anonymously and write
    // it onto the account so nothing is lost.
    try {
      const anon = await postDraft({ action: "load" });
      if (anon["status"] === "restored" && anon["payload"]) {
        const payload = anon["payload"] as Record<string, unknown>;
        // A browser can be shared. Only adopt anonymous typing when it clearly
        // belongs to this account, so one person's brief can never surface
        // pre-filled inside somebody else's wizard.
        const typedEmail = String(payload["workEmail"] ?? "").trim().toLowerCase();
        const mine = (accountEmail ?? "").trim().toLowerCase();
        if (typedEmail && (!mine || typedEmail !== mine)) return loaded;
        const lastStep = Number(anon["lastStep"] ?? 0);
        const saved = await persistIntakeDraft(true, payload, lastStep);
        return { status: "restored", payload, lastStep, savedAt: saved.savedAt };
      }
    } catch {
      /* no anonymous draft to adopt — the account draft stands */
    }
    return withMirrorFallback(loaded);
  }

  const r = await postDraft({ action: "load" });
  const loaded: Loaded = {
    status: (r["status"] ?? "empty") as IntakeDraftStatus,
    payload: (r["payload"] ?? null) as Record<string, unknown> | null,
    lastStep: Number(r["lastStep"] ?? 0),
    savedAt: (r["savedAt"] ?? null) as string | null,
  };
  return withMirrorFallback(loaded);
}

/**
 * A draft the server cannot see — because the token cookie was dropped — is
 * still the client's work. Restore it from this browser rather than showing an
 * empty form we promised would remember them.
 */
function withMirrorFallback(loaded: Loaded): Loaded {
  if (loaded.status === "submitted" || loaded.status === "expired") return loaded;
  const mirror = readDraftMirror();
  if (!mirror) return loaded;
  if (loaded.status === "restored" && loaded.payload) {
    const serverAt = loaded.savedAt ? new Date(loaded.savedAt).getTime() : 0;
    const localAt = mirror.savedAt ? new Date(mirror.savedAt).getTime() : 0;
    if (localAt <= serverAt) return loaded;
    return {
      status: "restored",
      payload: { ...loaded.payload, ...mirror.payload },
      lastStep: Math.max(loaded.lastStep, mirror.lastStep),
      savedAt: mirror.savedAt,
    };
  }
  return { status: "restored", payload: mirror.payload, lastStep: mirror.lastStep, savedAt: mirror.savedAt };
}

export async function persistIntakeDraft(
  authed: boolean,
  payload: Record<string, unknown>,
  lastStep: number,
): Promise<{ savedAt: string | null; status: IntakeDraftStatus }> {
  const safe = stripNeverPersisted(payload);
  // Mirror first: even a failed server write must not lose the typing.
  writeDraftMirror(safe, lastStep, new Date().toISOString());
  if (authed) {
    const r = await saveIntakeDraft({ data: { payload: safe as any, lastStep } });
    if (r.savedAt) writeDraftMirror(safe, lastStep, r.savedAt);
    return { savedAt: r.savedAt, status: r.status };
  }
  const r = await postDraft({ action: "save", payload: safe, lastStep });
  if (r["ok"] === false) throw new Error(String(r["error"] ?? "save_failed"));
  if (r["savedAt"]) writeDraftMirror(safe, lastStep, String(r["savedAt"]));
  return {
    savedAt: (r["savedAt"] ?? null) as string | null,
    status: r["status"] === "submitted" ? "submitted" : "restored",
  };
}

export async function markIntakeSubmitted(authed: boolean) {
  clearDraftMirror();
  if (authed) {
    await markIntakeDraftSubmitted().catch(() => undefined);
    return;
  }
  await postDraft({ action: "submitted" }).catch(() => undefined);
}

export async function emailIntakeResumeLink(input: {
  email: string;
  roleTitle?: string;
  stepLabel?: string;
}) {
  const r = await postDraft({ action: "email_resume", ...input });
  if (r["ok"] === false) throw new Error(String(r["error"] ?? "email_failed"));
  return true;
}

export function useIntakeDraftSaver(opts: {
  authed: boolean;
  /** Reads the current answers at save time, never at schedule time. */
  getPayload: () => Record<string, unknown>;
  getLastStep: () => number;
}) {
  const { authed, getPayload, getLastStep } = opts;
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [submittedElsewhere, setSubmittedElsewhere] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);

  const latest = useRef({ authed, getPayload, getLastStep });
  latest.current = { authed, getPayload, getLastStep };

  const runSave = useCallback(async () => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const { authed: a, getPayload: gp, getLastStep: gs } = latest.current;
      const result = await persistIntakeDraft(a, gp(), gs());
      if (result.status === "submitted") {
        setSubmittedElsewhere(true);
      } else if (result.savedAt) {
        setSavedAt(result.savedAt);
      }
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
      if (pending.current) {
        pending.current = false;
        void runSave();
      }
    }
  }, []);

  /** One second after the client stops touching a field. */
  const queueSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), 1000);
  }, [runSave]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return runSave();
  }, [runSave]);

  // A failed save is retried in the background until it lands.
  useEffect(() => {
    if (!saveError) {
      if (retry.current) clearInterval(retry.current);
      retry.current = null;
      return;
    }
    retry.current = setInterval(() => void runSave(), 15000);
    return () => {
      if (retry.current) clearInterval(retry.current);
      retry.current = null;
    };
  }, [saveError, runSave]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    savedAt,
    setSavedAt,
    saving,
    saveError,
    submittedElsewhere,
    queueSave,
    saveNow,
  };
}
