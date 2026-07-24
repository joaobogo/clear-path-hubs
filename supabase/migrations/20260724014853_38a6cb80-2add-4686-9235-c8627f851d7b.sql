
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organizations_parent_organization_id_idx
  ON public.organizations(parent_organization_id);

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS business_unit text,
  ADD COLUMN IF NOT EXISTS region text;

CREATE INDEX IF NOT EXISTS positions_business_unit_idx ON public.positions(business_unit);
CREATE INDEX IF NOT EXISTS positions_region_idx ON public.positions(region);

-- Rollup view. SECURITY INVOKER so caller's RLS on positions/matches applies.
CREATE OR REPLACE VIEW public.v_portfolio_rollup
WITH (security_invoker = true) AS
SELECT
  COALESCE(o.parent_organization_id, o.id) AS portfolio_org_id,
  o.id                                     AS organization_id,
  o.name                                   AS organization_name,
  COALESCE(p.business_unit, 'Unassigned')  AS business_unit,
  COALESCE(p.region, 'Unassigned')         AS region,
  COUNT(DISTINCT p.id) FILTER (
    WHERE p.status IN ('active','approved','paused')
  )                                        AS open_positions,
  COUNT(DISTINCT p.id) FILTER (
    WHERE p.status = 'filled'
  )                                        AS filled_positions,
  COUNT(DISTINCT cm.id)                    AS candidates_in_flight,
  COUNT(DISTINCT cm.id) FILTER (
    WHERE cm.stage = 'hired'
  )                                        AS hires
FROM public.organizations o
LEFT JOIN public.positions p        ON p.organization_id = o.id
LEFT JOIN public.candidate_matches cm ON cm.position_id = p.id
GROUP BY o.id, o.parent_organization_id, o.name, p.business_unit, p.region;

GRANT SELECT ON public.v_portfolio_rollup TO authenticated;
GRANT ALL    ON public.v_portfolio_rollup TO service_role;
