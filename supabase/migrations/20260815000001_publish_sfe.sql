-- Temporarily publish the SFE role for verification
UPDATE public.positions
SET visibility = 'public', published_at = NOW()
WHERE id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
