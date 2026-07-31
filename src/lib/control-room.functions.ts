import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSystemStatus, type SystemStatus } from "@/lib/control-room.server";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { describeEvent, isTickerEvent } from "@/lib/control-room-shared";
import { INTENSITIES } from "@/lib/role-intensity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type { SystemStatus };

export type LiveEvent = {
  id: string;
  kind: string;
  sentence: string;
  role_title: string | null;
  position_id: string | null;
  occurred_at: string;
};

export type RoleControl = {
  position_id: string;
  title: string;
  status: string;
  intensity: string;
};

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SystemStatus> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: member } = await supabase.rpc("is_org_member", {
      _user: userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("You do not have access to this workspace.");
    return buildSystemStatus(
      supabase,
      data.organization_id,
      AGENT_REGISTRY.length,
    );
  });

export const getLiveFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        limit: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<LiveEvent[]> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: member } = await supabase.rpc("is_org_member", {
      _user: userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("You do not have access to this workspace.");

    const { data: rows, error } = await supabase
      .from("notification_events")
      .select("id, event_type, position_id, created_at, positions:position_id(title)")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 40);
    if (error) throw error;

    return (rows ?? [])
      .filter((r: Db) => isTickerEvent(r.event_type))
      .map((r: Db) => {
        const d = describeEvent(r.event_type);
        return {
          id: r.id,
          kind: d.kind,
          sentence: d.sentence,
          role_title: r.positions?.title ?? null,
          position_id: r.position_id,
          occurred_at: r.created_at,
        };
      })
      .slice(0, 12);
  });

export const getRoleControls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RoleControl[]> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: member } = await supabase.rpc("is_org_member", {
      _user: userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("You do not have access to this workspace.");

    const { data: rows, error } = await supabase
      .from("positions")
      .select("id, title, status, intensity")
      .eq("organization_id", data.organization_id)
      .in("status", ["active", "approved", "under_review", "submitted"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return (rows ?? []).map((r: Db) => ({
      position_id: r.id,
      title: r.title,
      status: r.status,
      intensity: r.intensity ?? "standard",
    }));
  });

export const setRoleIntensity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        position_id: z.string().uuid(),
        intensity: z.enum(INTENSITIES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RoleControl> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: admin } = await supabase.rpc("is_org_admin", {
      _user: userId,
      _org: data.organization_id,
    });
    if (!admin) {
      const { data: staff } = await supabase.rpc("is_platform_staff", {
        _user: userId,
      });
      if (!staff) {
        throw new Error(
          "Only a workspace admin can change how hard we work a role.",
        );
      }
    }

    const { data: row, error } = await supabase
      .from("positions")
      .update({ intensity: data.intensity })
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id)
      .select("id, title, status, intensity")
      .maybeSingle();

    if (error) throw error;
    if (!row) throw new Error("We could not find that role in this workspace.");

    return {
      position_id: row.id,
      title: row.title,
      status: row.status,
      intensity: row.intensity ?? "standard",
    };
  });
