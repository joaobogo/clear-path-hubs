/**
 * The context a staff server function's handler reads: the caller's database
 * client and their auth user id. requireSupabaseAuth builds it for a signed-in
 * request; the internal staff-action route builds the same shape for a named
 * staff actor, so both run one handler.
 */
export type StaffActionContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  claims?: Record<string, unknown>;
};
