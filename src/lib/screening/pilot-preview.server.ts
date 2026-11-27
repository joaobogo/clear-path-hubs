/**
 * Structured screening pilot testing: a hidden test copy of a job (a test
 * record, never on the board) can be opened and applied to with a one-off
 * secret token held in this cookie and stored on that copy only
 * (positions.structured_screening_preview_token). Real jobs are never opened
 * this way: the token is only honoured on a test record.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export const PILOT_PREVIEW_COOKIE = "taasflow_pilot_preview";

function pilotPreviewToken(): string | null {
  let cookie = "";
  try {
    cookie = getRequestHeader("cookie") ?? "";
  } catch {
    return null;
  }
  const match = new RegExp(`(?:^|;\\s*)${PILOT_PREVIEW_COOKIE}=([^;]+)`).exec(cookie);
  const value = match ? decodeURIComponent(match[1]).trim() : "";
  return value.length >= 32 ? value : null;
}

export async function pilotPreviewAllowed(positionId: string): Promise<boolean> {
  const token = pilotPreviewToken();
  if (!token) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("positions")
    .select("id")
    .eq("id", positionId)
    .eq("is_test_record", true)
    .eq("structured_screening_preview_token", token)
    .maybeSingle();
  return Boolean(data);
}
