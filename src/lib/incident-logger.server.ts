import { SupabaseClient } from "@supabase/supabase-js";

export async function logApplicationIncident(
  supabase: SupabaseClient,
  incident: {
    email: string;
    role_id: string;
    trace: string;
    context: any;
  }
) {
  const { error } = await supabase
    .from("incidents")
    .insert({
      type: "application_failure",
      severity: "high",
      subject: `Application Failure: ${incident.email}`,
      description: incident.trace,
      metadata: {
        email: incident.email,
        role_id: incident.role_id,
        ...incident.context,
      },
    });

  if (error) {
    console.error("[logApplicationIncident] Failed to log incident", error);
  }
}
