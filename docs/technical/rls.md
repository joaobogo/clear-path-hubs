# Row-Level Security

Every table in `public` schema has RLS enabled. GRANT + policy blocks landed alongside `CREATE TABLE`.

## Helper functions (SECURITY DEFINER, `search_path=public`, execute revoked from anon/authenticated)

- `has_role(_user uuid, _role app_role)` — global platform roles.
- `is_org_member(_user, _org)` — active membership check.
- `has_org_role(_user, _org, _roles[])`.
- `is_org_admin`, `is_org_editor`, `is_org_viewer` — thin wrappers.
- `is_platform_staff(_user)` — `platform_admin` OR `operations`.
- `is_owning_candidate(_user, _cp)` — candidate owns profile.
- `is_active_user(_user)` — profile status='active'.

## Policy taxonomy (see `docs/product/contracts.md` for full list)

| Class            | Read policy                                                       | Write policy                                       |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| PUBLIC           | `TO anon USING (true)` on `job_board_positions` view              | none                                               |
| TENANT           | `is_org_viewer(auth.uid(), organization_id)`                      | `is_org_editor(...)` / `is_org_admin(...)`         |
| TENANT_STAFF     | Above OR `is_platform_staff(auth.uid())`                          | Same                                               |
| ADMIN_ONLY       | `is_platform_staff(auth.uid())`                                   | Same                                               |
| CANDIDATE        | `is_owning_candidate(auth.uid(), candidate_profile_id)` OR staff  | Owner writes limited to specific columns          |
| INTERNAL         | Staff only                                                        | Service role only                                  |

## Views for column-level exclusion

- `job_board_positions`: excludes internal fields (min_publish_threshold, requirement weights).
- `candidate_matches_client`: excludes `evidence_hash`, internal notes.
- Views use `WITH (security_invoker=on)` and base tables deny direct SELECT for anon.
