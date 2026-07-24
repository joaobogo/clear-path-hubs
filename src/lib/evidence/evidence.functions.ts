import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Public: list approved, integrity-ok evidence for a match (client-safe view). */
export const listClientEvidence = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('candidate_evidence_client')
      .select('*')
      .eq('candidate_match_id', data.matchId)
      .order('rubric_dimension_key');
    if (error) throw error;
    return rows ?? [];
  });

/** Admin: full evidence (all statuses, including debug fields). */
export const listAdminEvidence = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('candidate_evidence_items')
      .select('*')
      .eq('candidate_match_id', data.matchId)
      .order('rubric_dimension_key');
    if (error) throw error;
    return rows ?? [];
  });

const OverrideInput = z.object({
  evidenceItemId: z.string().uuid(),
  reason: z.string().min(4).max(2000),
  patch: z.object({
    result: z.enum(['strong','partial','weak','missing','contradictory','not_applicable','needs_validation']).optional(),
    source_passage: z.string().optional(),
    normalized_meaning: z.string().optional(),
    validation_need: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    integrity_ok: z.boolean().optional(),
    reviewer_status: z.enum(['accepted','edited','rejected']).optional(),
  }),
});

/** Admin edits an evidence item; before/after snapshot appended to evidence_overrides. */
export const overrideEvidence = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => OverrideInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: before, error: beErr } = await context.supabase
      .from('candidate_evidence_items')
      .select('*')
      .eq('id', data.evidenceItemId)
      .single();
    if (beErr || !before) throw beErr ?? new Error('evidence_not_found');

    const nextPatch = {
      ...data.patch,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
    };

    const { data: after, error: upErr } = await context.supabase
      .from('candidate_evidence_items')
      .update(nextPatch)
      .eq('id', data.evidenceItemId)
      .select('*')
      .single();
    if (upErr || !after) throw upErr ?? new Error('override_failed');

    const { error: ovErr } = await context.supabase.from('evidence_overrides').insert({
      evidence_item_id: after.id,
      candidate_match_id: after.candidate_match_id,
      organization_id: after.organization_id,
      actor_user_id: context.userId,
      reason: data.reason,
      before_state: before,
      after_state: after,
    });
    if (ovErr) throw ovErr;
    return after;
  });

/** Admin flags evidence for correction (integrity_ok=false + status=pending). */
export const flagEvidenceForCorrection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ evidenceItemId: z.string().uuid(), note: z.string().min(3).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('candidate_evidence_items')
      .update({
        integrity_ok: false,
        reviewer_status: 'pending',
        reviewer_note: data.note,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', data.evidenceItemId)
      .select('candidate_match_id, organization_id')
      .single();
    if (error || !row) throw error ?? new Error('flag_failed');

    await context.supabase
      .from('candidate_matches')
      .update({ integrity_status: 'manual_review' })
      .eq('id', row.candidate_match_id);
    return row;
  });

/** List override history for a match (admin/staff only, RLS enforced). */
export const listEvidenceOverrides = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('evidence_overrides')
      .select('id, evidence_item_id, actor_user_id, reason, before_state, after_state, created_at')
      .eq('candidate_match_id', data.matchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });
