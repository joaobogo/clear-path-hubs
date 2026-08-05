import { supabase } from "@/integrations/supabase/client";

/**
 * Thin accessor for the Supabase OAuth-consent API.
 *
 * This lives outside the route file on purpose: TanStack's route splitter moves
 * `loader`/`beforeLoad` into their own chunk and imports any module-scope
 * helpers they reference from the shared chunk. A plain `const` is not exported
 * from that shared chunk, so keeping this helper inside the route file broke the
 * client bundle with "does not provide an export named 'oauth'" — which stopped
 * hydration on every page.
 */
export type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

export const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
