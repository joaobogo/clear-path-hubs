ALTER TYPE public.client_decision_type ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE public.client_decision_type ADD VALUE IF NOT EXISTS 'feedback';
ALTER TYPE public.client_decision_type ADD VALUE IF NOT EXISTS 'request_contact_release';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'client_hold';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'client_declined';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'client_information_requested';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'contact_release_requested';
ALTER TABLE public.client_decisions ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE public.client_decisions ADD COLUMN IF NOT EXISTS details jsonb;