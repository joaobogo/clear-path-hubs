import { createServerFn } from "@tanstack/react-start";

// Phase 4 intake pipeline is being rewired against the canonical Phase 2 schema.
// Placeholder stub keeps the build green until the new implementation lands.
export const submitIntake = createServerFn({ method: "POST" }).handler(async () => {
  return {
    ok: false as const,
    trace_id: crypto.randomUUID(),
    error: "intake_pipeline_rewiring",
    message: "The intake pipeline is being rebuilt against the new canonical schema.",
  };
});
