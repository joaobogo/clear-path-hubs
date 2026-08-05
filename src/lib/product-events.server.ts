// Single product-event emitter. Server-only.
// Every product event is written to public.audit_events with a canonical action
// name from the catalogue in product-events.ts.

import {
  PRODUCT_EVENT_ENTITY,
  type ProductEvent,
} from "./product-events";

type AdminClient = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

export type ProductEventInput = {
  event: ProductEvent;
  entityId?: string | null;
  entityType?: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  traceId?: string | null;
  /** Prior state, for transitions (e.g. { stage: "screening" }). */
  before?: Record<string, unknown> | null;
  /** Event payload: reason codes, actors, counts, failure reasons. */
  after?: Record<string, unknown> | null;
  /** Support session id stamped on every write made during a session. */
  supportSessionId?: string | null;
};

function toRow(input: ProductEventInput) {
  const after = {
    ...(input.after ?? {}),
    event: input.event,
    ...(input.supportSessionId ? { support_session_id: input.supportSessionId } : {}),
  };
  return {
    action: input.event,
    entity_type: input.entityType ?? PRODUCT_EVENT_ENTITY[input.event],
    entity_id: input.entityId ?? null,
    organization_id: input.organizationId ?? null,
    actor_user_id: input.actorUserId ?? null,
    trace_id: input.traceId ?? null,
    before_state: input.before ?? null,
    after_state: after,
  };
}

/**
 * Emits one product event. Never throws: instrumentation must not break the
 * business action it observes. Failures are logged server-side.
 */
export async function emitProductEvent(
  admin: AdminClient,
  input: ProductEventInput,
): Promise<void> {
  await emitProductEvents(admin, [input]);
}

/** Emits many product events in one insert. Never throws. */
export async function emitProductEvents(
  admin: AdminClient,
  inputs: ProductEventInput[],
): Promise<void> {
  if (!inputs.length) return;
  try {
    const res = await admin.from("audit_events").insert(inputs.map(toRow));
    if (res.error) {
      console.error("[product-events] insert failed", res.error.message);
    }
  } catch (err) {
    console.error("[product-events] emit threw", err);
  }
}
