-- Rollback: restore CHECK (kind IN ('call','message')) once no other kinds exist.
ALTER TABLE public.marketing_inquiries DROP CONSTRAINT IF EXISTS marketing_inquiries_kind_check;
ALTER TABLE public.marketing_inquiries ADD CONSTRAINT marketing_inquiries_kind_check
  CHECK (kind = ANY (ARRAY['call','message','enquiry','estimate','briefing','exit']));