
DO $$ BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'position_paused' AFTER 'position_activated';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'position_filled' AFTER 'candidate_hired';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
