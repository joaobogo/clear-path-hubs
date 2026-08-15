import { describe, it, expect, vi } from "vitest";

// Mock the server environment
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: (fn: any) => fn,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    storage: {
      from: vi.fn().mockReturnThis(),
      createSignedUrl: vi.fn(),
      download: vi.fn(),
    },
    insert: vi.fn().mockReturnThis(),
  },
}));

describe("CV Redaction Enforcement", () => {
  it("serves redacted text for pre-interview client access", async () => {
    // Import after mocks
    const { getCandidateCvDownload } = await import("../cv-download.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Mock the match: published but NOT released (pre-interview)
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === "candidate_matches") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  organization_id: "org-123",
                  client_visibility: "visible",
                  canonical_state: "published_to_client",
                  contact_released_at: null, // Gate is active
                  candidate_profile_id: "prof-123"
                }
              })
            })
          })
        };
      }
      if (table === "memberships") {
        return { select: () => ({ eq: () => ({ eq: () => ({ in: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }) };
      }
      if (table === "candidate_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { current_cv_file_id: "file-123", full_name: "Miguel Torres" }
              })
            })
          })
        };
      }
      if (table === "files") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { storage_bucket: "cvs", storage_path: "path/to/cv.pdf", filename: "cv.pdf", mime_type: "application/pdf" }
              })
            })
          })
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    // Mock storage download and permission RPC
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: true })
    };

    (supabaseAdmin.storage.from as any).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: new Blob(["Miguel Torres miguel.torres@demo.com +351912000102"]) })
    });

    // Access the implementation directly
    const handler = (getCandidateCvDownload as any)._handler;
    if (!handler) {
       console.log("Keys available on getCandidateCvDownload:", Object.keys(getCandidateCvDownload));
    }
    
    // TanStack server functions store the handler differently or we might need to invoke it through the instance
    const result = await (getCandidateCvDownload as any)({
      data: { matchId: "match-123", disposition: "inline" },
      context: { supabase: mockSupabase, userId: "user-456" }
    });

    expect(result.isRedacted).toBe(true);
    expect(result.mime).toBe("text/plain");
    expect(result.url).toContain("data:text/plain");
    // Ensure the data URL doesn't contain the raw email/phone
    const decodedText = decodeURIComponent(result.url.split(",")[1]);
    expect(decodedText).not.toContain("miguel.torres@demo.com");
    expect(decodedText).not.toContain("+351912000102");
  });
});
