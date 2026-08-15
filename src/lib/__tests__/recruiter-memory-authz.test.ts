import { describe, expect, it, vi } from "vitest";
import { listRoleMemory, createRoleMemory, updateRoleMemory, deleteRoleMemory } from "../role-memory.functions";

// Mock the attacher and other potentially problematic imports
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: (fn: any) => fn,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
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
    const result = await listRoleMemory.handler({ 
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
      createRoleMemory.handler({ 
        data: { position_id: "00000000-0000-0000-0000-000000000000", kind: "handoff", title: "Test", body: "Test" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });

  it("updateRoleMemory throws for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    await expect(
      // @ts-ignore
      updateRoleMemory.handler({ 
        data: { id: "00000000-0000-0000-0000-000000000000", title: "Updated" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });

  it("deleteRoleMemory throws for non-staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as any);
    
    await expect(
      // @ts-ignore
      deleteRoleMemory.handler({ 
        data: { id: "00000000-0000-0000-0000-000000000000" }, 
        context: mockContext 
      })
    ).rejects.toThrow("Forbidden: Recruiter memory is staff-only.");
  });

  it("listRoleMemory calls DB for staff", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: true, error: null } as any);
    const mockRows = [{ id: '1', title: 'Test Memory' }];
    
    const mockSelect = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ order: mockSelect }) });
    
    const staffContext = {
      userId: "staff-123",
      supabase: {
        from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }),
      } as any,
    };
    
    // @ts-ignore
    const result = await listRoleMemory.handler({ 
      data: { position_id: "00000000-0000-0000-0000-000000000000" }, 
      context: staffContext 
    });
    
    expect(result).toEqual(mockRows);
  });
});
