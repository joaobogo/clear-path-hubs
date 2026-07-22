
-- Owner uploads to own prefix
CREATE POLICY cvs_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY cvs_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY cvs_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner reads own files
CREATE POLICY cvs_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Platform staff reads all CVs
CREATE POLICY cvs_staff_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_platform_staff(auth.uid())
  );

-- Org viewers read CVs of candidates delivered/visible to their org
CREATE POLICY cvs_org_visible_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.candidate_matches m
      JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
      WHERE cp.user_id::text = (storage.foldername(objects.name))[1]
        AND m.client_visibility = 'visible'
        AND public.is_org_viewer(auth.uid(), m.organization_id)
    )
  );
