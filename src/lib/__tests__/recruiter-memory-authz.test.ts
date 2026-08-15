import { describe, expect, it, vi } from "vitest";
import { listRoleMemory, createRoleMemory, updateRoleMemory, deleteRoleMemory } from "../role-memory.functions";

// Mock the middleware and server client
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {
    addMiddleware: vi.fn().mockImplementation((fn) => fn),
    _types: {}
  }
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
}));

// Mock the @tanstack/react-start createServerFn
vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((h) => {
      const fn = async (args: any) => h(args);
      (fn as any).handler = h;
      return fn;
    }),
  }),
}));

import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Recruiter Memory Authorization", () => {
  const mockContext = {
    userId: "user-123",
    supabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    } as any,
  };

  it("listRoleMemory returns empty array for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    // @ts-ignore
    const result = await (listRoleMemory as any).handler({ 
      data: { position_id: "00000000-0000-0000-0000-000000000000" }, 
      context: mockContext 
    });
    
    expect(result).toEqual([]);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("is_platform_staff", { _user: "user-123" });
  });

  it("createRoleMemory throws for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    await expect(
      // @ts-ignore
      (createRoleMemory as any).handler({ 
        data: { position_id: "00000000-0000-0000-0000-000000000000", kind: "handoff", title: "Test", body: "Test" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });

  it("updateRoleMemory throws for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    await expect(
      // @ts-ignore
      (updateRoleMemory as any).handler({ 
        data: { id: "00000000-0000-0000-0000-000000000000", title: "Updated" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });

  it("deleteRoleMemory throws for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    await expect(
      // @ts-ignore
      (deleteRoleMemory as any).handler({ 
        data: { id: "00000000-0000-0000-0000-000000000000" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });
});
