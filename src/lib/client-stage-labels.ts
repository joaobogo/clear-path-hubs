import { clientStatusLabel } from "@/lib/vocabulary";

/**
 * Plain-English stage labels for client-facing screens.
 *
 * The labels live in `src/lib/vocabulary.ts` — this is only the client entry
 * point kept for existing callers.
 */
export function clientStageLabel(stage: string | null | undefined): string {
  return clientStatusLabel(stage);
}
