ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'standard';
ALTER TABLE public.positions ADD CONSTRAINT positions_scoring_mode_check CHECK (scoring_mode IN ('standard','relocation_volume'));
ALTER TABLE public.screening_questions ADD COLUMN IF NOT EXISTS scoring_dimension text;
ALTER TABLE public.screening_questions ADD CONSTRAINT screening_questions_scoring_dimension_check CHECK (scoring_dimension IS NULL OR scoring_dimension IN ('commitment','start','flexibility','experience'));
COMMENT ON COLUMN public.positions.scoring_mode IS 'standard = default engine; relocation_volume = per-role relocation-first scoring (rollback: drop column)';
COMMENT ON COLUMN public.screening_questions.scoring_dimension IS 'Dimension tag read only by relocation_volume scoring (rollback: drop column)';