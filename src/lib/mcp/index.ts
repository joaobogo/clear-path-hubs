import { defineMcp, auth } from "@lovable.dev/mcp-js";
import listPositions from "./tools/list-positions";
import getPosition from "./tools/get-position";
import listShortlist from "./tools/list-shortlist";
import getCandidate from "./tools/get-candidate";

// The OAuth issuer must be the direct Supabase host: SUPABASE_URL is rewritten
// to a proxy on publish, and the project ref is the only value that survives.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "taasflow",
  title: "TaaSFlow",
  version: "0.1.0",
  instructions:
    "Tools for TaaSFlow, a recruiting platform. Use `list_positions` to find the signed-in user's hiring roles, `get_position` for one role's requirements, `list_shortlist` for the candidates released for a role, and `get_candidate` for one candidate's screening summary and evidence. Only data the signed-in user is allowed to see is returned; candidates not yet shared with the client are never visible.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPositions, getPosition, listShortlist, getCandidate],
});
