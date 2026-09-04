import * as React from "react";

import { Button, Text } from "@react-email/components";
import { Shell, button, footer, text } from "./brand";
import type { TemplateEntry } from "./registry";

/**
 * Someone has been invited into a client workspace.
 *
 * The invitation used to go out on Supabase's own auth email: correctly
 * branded, and otherwise anonymous — "You've been invited to join TaaSFlow",
 * with no mention of who invited them or which company's workspace they were
 * being asked into. An invitation that cannot say who it is from reads like
 * something to ignore, and the people receiving these have usually been told to
 * expect it by a colleague, by name.
 *
 * Supabase auth templates cannot carry custom variables, so the invitation is
 * sent from here instead, with the action link generated separately. Everything
 * personal is optional: an invitation with no inviter recorded still sends, it
 * simply says less.
 */
interface TeamInviteEmailProps {
  /** The person who sent the invitation, when we know them. */
  inviterName?: string | null;
  /** The client workspace they are being invited into. */
  workspaceName?: string | null;
  /** Plain-English seat description, e.g. "an admin". */
  roleLabel?: string | null;
  /** Supabase action link — accepting it is where they set a password. */
  actionUrl: string;
}

export const TeamInviteEmail = ({
  inviterName,
  workspaceName,
  roleLabel,
  actionUrl,
}: TeamInviteEmailProps) => {
  const inviter = inviterName?.trim();
  const workspace = workspaceName?.trim();

  return (
    <Shell
      preview={
        inviter && workspace
          ? `${inviter} invited you to ${workspace} on TaaSFlow`
          : "You've been invited to TaaSFlow"
      }
      heading={workspace ? `Join ${workspace} on TaaSFlow` : "You've been invited"}
    >
      <Text style={text}>
        {inviter ? <strong>{inviter}</strong> : "Someone on your team"} has invited you
        {workspace ? (
          <>
            {" "}
            to the <strong>{workspace}</strong> hiring workspace
          </>
        ) : null}{" "}
        on TaaSFlow{roleLabel ? ` as ${roleLabel}` : ""}.
      </Text>
      <Text style={text}>
        Accepting the invitation is where you choose a password. After that you can review
        candidates, follow roles and message the recruiting team.
      </Text>
      <Button style={button} href={actionUrl}>
        Accept invitation and set a password
      </Button>
      <Text style={footer}>
        This invitation was sent to you directly. If you were not expecting it, you can ignore
        this email and nothing will happen.
      </Text>
    </Shell>
  );
};

export default TeamInviteEmail;

export const template = {
  component: TeamInviteEmail,
  subject: (d: Record<string, any>) =>
    d?.inviterName && d?.workspaceName
      ? `${d.inviterName} invited you to ${d.workspaceName} on TaaSFlow`
      : d?.workspaceName
        ? `You've been invited to ${d.workspaceName} on TaaSFlow`
        : "You've been invited to TaaSFlow",
  displayName: "Client — team invitation",
  previewData: {
    inviterName: "Rita Sequeira",
    workspaceName: "Northwind Talent",
    roleLabel: "an admin",
    actionUrl: "https://taasflow.com/auth/accept-invite?token=preview",
  },
} satisfies TemplateEntry;
