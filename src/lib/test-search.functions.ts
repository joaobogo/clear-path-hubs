import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isCandidateHeadline, cleanQuote, isTemplatedEvidence } from "./evidence/quote-hygiene";

export const testSearch = createServerFn({ method: "GET" })
  .handler(async () => {
    const term = "Northwind";
    const ilikeValue = (t: string) => `%${t}%`;
    
    // Testing Candidate Search logic
    const { data, error } = await supabase
      .from("candidate_matches")
      .select("id, organizations!inner(name)")
      .or(`organizations.name.ilike.${ilikeValue(term)}`)
      .limit(5);
      
    return { data, error };
  });
