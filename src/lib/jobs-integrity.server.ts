import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PublicPositionSummary } from "./jobs.functions";

/**
 * Validates that a position's description does not contain references to organizations
 * other than its owner or "TaaSFlow". This is a data-integrity check to prevent
 * copy-paste errors in job descriptions from leaking to the public board.
 */
export async function verifyPositionDescriptionIntegrity(positionId: string): Promise<{
  valid: boolean;
  mismatch?: { found: string; expected: string };
}> {
  const admin = await supabaseAdmin();

  const { data: pos, error: posError } = await admin
    .from("positions")
    .select("description, organization_id")
    .eq("id", positionId)
    .single();

  if (posError || !pos) return { valid: true }; // Can't verify, assume OK or handled by caller

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", pos.organization_id)
    .single();

  if (orgError || !org) return { valid: true };

  const { data: otherOrgs, error: otherOrgsError } = await admin
    .from("organizations")
    .select("name")
    .neq("id", pos.organization_id)
    .limit(100);

  if (otherOrgsError || !otherOrgs) return { valid: true };

  const desc = pos.description.toLowerCase();
  const expectedName = org.name.toLowerCase();

  for (const other of otherOrgs) {
    const otherName = other.name.toLowerCase();
    // Ignore short names or common words to avoid false positives
    if (otherName.length < 4 || otherName === "taasflow" || otherName === "taasflow platform") continue;
    
    // Check if the other org's name appears in a way that suggests it's the hirer
    // e.g., "OtherOrg is hiring", "At OtherOrg, we", "Welcome to OtherOrg"
    const triggers = [
      `${otherName} is hiring`,
      `at ${otherName}`,
      `welcome to ${otherName}`,
      `join ${otherName}`
    ];

    for (const trigger of triggers) {
      if (desc.includes(trigger.toLowerCase())) {
        return {
          valid: false,
          mismatch: { found: other.name, expected: org.name }
        };
      }
    }
  }

  return { valid: true };
}
