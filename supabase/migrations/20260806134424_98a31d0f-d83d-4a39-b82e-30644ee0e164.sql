-- Least privilege on public.organizations.
-- RLS already blocks anon (there is no anon policy), but the anon role still
-- held every table privilege. Removing the grant means a future permissive
-- policy cannot silently open workspaces to unauthenticated callers.
REVOKE ALL ON TABLE public.organizations FROM anon;

-- Signed-in clients never create or delete workspaces directly: intake and
-- admin flows do that through the service role. No INSERT/DELETE policy exists
-- for authenticated, so revoking the grant only removes dead surface.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.organizations FROM authenticated;

-- Reads and updates stay, still gated by the existing policies:
--   organizations_read          -> active profile + active client_* membership
--   organizations_admin_update  -> active profile + active client_admin membership
GRANT SELECT, UPDATE ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;