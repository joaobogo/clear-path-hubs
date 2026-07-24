
CREATE TYPE public.shortlist_share_mode AS ENUM ('review', 'presentation', 'compare');

CREATE TABLE public.shortlist_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  match_ids uuid[] NOT NULL,
  token text NOT NULL UNIQUE,
  title text,
  message text,
  default_mode public.shortlist_share_mode NOT NULL DEFAULT 'review',
  allow_comments boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shortlist_shares_org_idx ON public.shortlist_shares (organization_id, created_at DESC);
CREATE INDEX shortlist_shares_token_idx ON public.shortlist_shares (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlist_shares TO authenticated;
GRANT ALL ON public.shortlist_shares TO service_role;

ALTER TABLE public.shortlist_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_shares" ON public.shortlist_shares
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "org_editors_write_shares" ON public.shortlist_shares
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id));

CREATE POLICY "org_editors_update_shares" ON public.shortlist_shares
  FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id));

CREATE POLICY "org_editors_delete_shares" ON public.shortlist_shares
  FOR DELETE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id));

CREATE TRIGGER trg_shortlist_shares_updated_at
  BEFORE UPDATE ON public.shortlist_shares
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.shortlist_share_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.shortlist_shares(id) ON DELETE CASCADE,
  match_id uuid,
  author_name text NOT NULL,
  author_email text,
  body text NOT NULL,
  sentiment text CHECK (sentiment IN ('positive','neutral','concern','request')) DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shortlist_share_comments_share_idx ON public.shortlist_share_comments (share_id, created_at DESC);

GRANT SELECT ON public.shortlist_share_comments TO authenticated;
GRANT ALL ON public.shortlist_share_comments TO service_role;

ALTER TABLE public.shortlist_share_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_share_comments" ON public.shortlist_share_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shortlist_shares s
    WHERE s.id = share_id
      AND (public.is_org_member(auth.uid(), s.organization_id) OR public.is_platform_staff(auth.uid()))
  ));
