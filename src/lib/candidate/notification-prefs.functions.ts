/**
 * Server functions for per-event candidate notification preferences.
 *
 * Saves are one row at a time so the UI can confirm — or visibly revert — each
 * row on its own. The handler re-validates every write:
 *   * a deadline-bearing notice can never be switched off through the API;
 *   * SMS can never be enabled without a verified mobile number, or for an
 *     event that has no SMS channel.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CANDIDATE_PREF_KEYS,
  hasVerifiedPhone,
  isModeAllowed,
  normalizeCandidatePrefs,
  specFor,
  supportsSms,
  type CandidateDeliveryMode,
  type CandidatePrefKey,
  type CandidatePrefRow,
  type CandidateSmsRow,
} from "./notification-prefs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const keyZ = z.enum(CANDIDATE_PREF_KEYS as unknown as [CandidatePrefKey, ...CandidatePrefKey[]]);
const modeZ = z.enum(["immediate", "digest", "off"]);

async function loadProfile(supabase: AnyRow, userId: string) {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("id, phone, consent")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No candidate profile");
  return data as { id: string; phone: string | null; consent: Record<string, unknown> | null };
}

export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      prefs: CandidatePrefRow;
      sms: CandidateSmsRow;
      smsAvailable: boolean;
    }> => {
      const profile = await loadProfile(context.supabase as AnyRow, context.userId);
      const { prefs, sms } = normalizeCandidatePrefs(profile.consent);
      return { prefs, sms, smsAvailable: hasVerifiedPhone(profile) };
    },
  );

export const updateMyNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { key: CandidatePrefKey; mode?: CandidateDeliveryMode; sms?: boolean }) =>
      z
        .object({ key: keyZ, mode: modeZ.optional(), sms: z.boolean().optional() })
        .refine((v) => v.mode !== undefined || v.sms !== undefined, {
          message: "Nothing to change",
        })
        .parse(input),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: true; key: CandidatePrefKey; mode: CandidateDeliveryMode; sms: boolean }> => {
      const supabase = context.supabase as AnyRow;
      const profile = await loadProfile(supabase, context.userId);
      const spec = specFor(data.key);
      const { prefs, sms } = normalizeCandidatePrefs(profile.consent);

      if (data.mode !== undefined && !isModeAllowed(data.key, data.mode)) {
        throw new Error(
          spec.lockedReason
            ? `${spec.label} can be moved to the daily digest but not switched off.`
            : `${spec.label} does not support that delivery option.`,
        );
      }
      if (data.sms === true) {
        if (!supportsSms(data.key)) throw new Error(`${spec.label} is not sent by SMS.`);
        if (!hasVerifiedPhone(profile)) {
          throw new Error("Add and verify a mobile number before turning on SMS.");
        }
      }

      const nextMode = data.mode ?? prefs[data.key];
      const nextSms = data.sms ?? sms[data.key];
      const consent = { ...(profile.consent ?? {}) } as Record<string, unknown>;
      const notifyStored = consent["notify"];
      const notify = {
        ...((notifyStored && typeof notifyStored === "object" ? notifyStored : {}) as Record<
          string,
          unknown
        >),
      };
      const smsStored = notify["sms"];
      notify["sms"] = {
        ...((smsStored && typeof smsStored === "object" ? smsStored : {}) as Record<
          string,
          unknown
        >),
        [data.key]: nextSms,
      };
      notify[data.key] = nextMode;
      consent["notify"] = notify;
      // The legacy single email switch is retired the moment per-event choices
      // are saved, so it can never silence a deadline-bearing notice later.
      delete consent["notifications_email"];

      const { error } = await supabase
        .from("candidate_profiles")
        .update({ consent })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      return { ok: true, key: data.key, mode: nextMode, sms: nextSms };
    },
  );
