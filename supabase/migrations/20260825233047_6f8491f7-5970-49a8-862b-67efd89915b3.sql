-- A candidate-facing status must be derived once, in the application layer,
-- from applications + candidate_matches. This view carried a second (and by now
-- divergent) SQL derivation of the same figure and is read by nothing.
DROP VIEW IF EXISTS public.candidate_my_applications;