import { createServerFn } from "@tanstack/react-start";

// Phase 4 admin actions are being rewired against the canonical Phase 2 schema.
export const listIntakes = createServerFn({ method: "GET" }).handler(async () => {
  return { items: [] as Array<{ id: string; title: string; status: string }> };
});

export const getIntake = createServerFn({ method: "GET" }).handler(async () => {
  return null;
});

export const setIntakeStatus = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: false as const, error: "admin_pipeline_rewiring" };
});
