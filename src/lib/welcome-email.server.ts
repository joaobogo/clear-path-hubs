/**
 * Welcome email — sent once per organisation, the moment a client commits
 * (payment confirmed, or a call booked). Server-only.
 *
 * Deduped on the organisation id, so paying after booking (or a webhook
 * retry) never produces a second welcome.
 */
export async function sendWelcomeEmail(args: {
  email: string | null | undefined;
  organizationId: string;
  contactName?: string | null;
  companyName?: string | null;
  roleTitle?: string | null;
  positionId?: string | null;
}): Promise<void> {
  const { email, organizationId } = args;
  if (!email || !organizationId) return;

  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { absoluteUrl } = await import("./blueprint-pipeline.server");

    await sendTemplateEmail("express-welcome", email, {
      idempotencyKey: `welcome-${organizationId}`,
      templateData: {
        contactName: args.contactName ?? undefined,
        companyName: args.companyName ?? undefined,
        roleTitle: args.roleTitle ?? undefined,
        workspaceUrl: args.positionId
          ? absoluteUrl(`/client/positions/${args.positionId}`)
          : absoluteUrl("/client"),
      },
    });
  } catch (err) {
    console.error("[welcome-email] send failed (non-critical)", err);
  }
}
