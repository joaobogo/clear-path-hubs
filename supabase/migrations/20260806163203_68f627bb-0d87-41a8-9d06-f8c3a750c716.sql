ALTER TABLE public.saved_views DROP CONSTRAINT IF EXISTS saved_views_surface_check;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_surface_check CHECK (surface IN (
  'admin_candidates','admin_positions','admin_intakes','admin_processing',
  'admin_matches','admin_activity','admin_privacy','admin_clients',
  'client_positions','client_candidates','client_messages'
));