// Client-safe alias for the canonical match stage union. The definition lives in
// client-kpi.server.ts; this re-export is type-only, so nothing server-side is
// pulled into a browser bundle.
export type { MatchStage } from "@/lib/client-kpi.server";
