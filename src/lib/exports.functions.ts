// Thin server-function wrappers for audited admin exports.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ExportJobRow } from "./exports.server";

const filtersInput = z
  .object({
    organization_id: z.string().uuid().optional(),
    position_id: z.string().uuid().optional(),
    stage: z.string().max(50).optional(),
    client_visibility: z.string().max(50).optional(),
    recommendation: z.string().max(50).optional(),
    score_band: z.string().max(50).optional(),
    date_from: z.string().max(40).optional(),
    date_to: z.string().max(40).optional(),
    include_contact: z.boolean().optional(),
  })
  // No unlimited-scope exports: a position or a client must be named.
  .refine((f) => Boolean(f.position_id || f.organization_id), {
    message: "Choose a position or a client to export.",
  });

export const requestCandidateExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filtersInput.parse(i))
  .handler(async ({ data, context }): Promise<{ job_id: string }> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createExportJob, describeScope, runExportJob } = await import("./exports.server");
    const s = supabaseAdmin as never;
    const scopeLabel = await describeScope(s, data);
    const jobId = await createExportJob(s, {
      userId: context.userId,
      filters: data,
      scopeLabel,
    });
    // Generated inline so the job id is real and the file exists on completion;
    // failures are recorded on the job row rather than thrown away.
    await runExportJob(s, jobId, context.userId);
    return { job_id: jobId };
  });

export const listMyExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExportJobRow[]> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listExportJobs } = await import("./exports.server");
    return listExportJobs(supabaseAdmin as never, context.userId);
  });

export const retryExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runExportJob } = await import("./exports.server");
    return runExportJob(supabaseAdmin as never, data.job_id, context.userId);
  });

export const getExportDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signExportDownload } = await import("./exports.server");
    return signExportDownload(supabaseAdmin as never, data.job_id, context.userId);
  });
