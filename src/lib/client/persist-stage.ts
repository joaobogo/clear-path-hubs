/**
 * Move a candidate to a stage, and refuse to call it done unless it happened.
 *
 * `update().eq().eq()` reports `error: null` when it matches ZERO rows. That is
 * not an error condition in PostgREST — it is a successful statement that
 * updated nothing, which is exactly what row-level security produces when a
 * policy filters the target row out. Every stage writer checked only `error`,
 * so a write RLS had discarded returned `{ ok: true, trace_id }` to the client,
 * the toast said "Added to your shortlist", and the stage was unchanged on
 * reload (launch pass round 7 — confirmed on three candidates across two
 * different transitions, each returning HTTP 200 with ok:true).
 *
 * The tell was in the response shape. The company-profile save, which works,
 * echoes the persisted entity back; the stage endpoint returned a trace id and
 * nothing else, so there was never anything to compare against what was asked
 * for. This asks for the row back and checks it.
 *
 * Why a zero-row update is possible at all: `cm_client_editor_update` requires
 * the row to be `client_visibility = 'visible'` AND
 * `canonical_state = 'published_to_client'`. A match that is visible but whose
 * canonical_state is anything else satisfies the client's read policy and not
 * its write policy, so the row is readable, the button renders, and the UPDATE
 * silently matches nothing.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Raised when the update matched no row. Distinct from a database error. */
export class StageNotPersistedError extends Error {
  constructor(
    readonly matchId: string,
    readonly toStage: string,
  ) {
    super(
      "That candidate could not be moved. Refresh and try again — if it keeps happening, " +
        "your workspace may not have permission to change this candidate's stage.",
    );
    this.name = "StageNotPersistedError";
  }
}

/**
 * Writes `stage` and returns the row as persisted.
 *
 * `.select()` is what turns a silent no-op into a detectable one: with RLS
 * filtering the row out, the update matches nothing, the select returns
 * nothing, and this throws instead of reporting success.
 */
export async function persistStage(
  db: Db,
  args: { matchId: string; orgId: string; toStage: string },
): Promise<{ id: string; stage: string }> {
  const { data, error } = await db
    .from("candidate_matches")
    .update({ stage: args.toStage })
    .eq("id", args.matchId)
    .eq("organization_id", args.orgId)
    .select("id, stage")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new StageNotPersistedError(args.matchId, args.toStage);

  // A row came back but not in the stage we asked for: a trigger rewrote it, or
  // the transition was rejected. Either way the caller must not claim the move.
  if (String(data.stage) !== args.toStage) {
    throw new StageNotPersistedError(args.matchId, args.toStage);
  }

  return { id: String(data.id), stage: String(data.stage) };
}
