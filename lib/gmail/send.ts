import { google } from "googleapis";
import { getOAuthClient } from "./oauth";
import { getCurrentUser } from "@/lib/db/queries";
import { buildMimeMessage, toBase64Url } from "./mime";

export interface SendInput {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  fromName?: string;
}

export async function sendGmail(input: SendInput): Promise<{ messageId: string }> {
  const user = await getCurrentUser();
  if (!user?.gmail_refresh_token) {
    throw new Error("Gmail ist nicht verbunden. Bitte unter /settings verbinden.");
  }
  const fromEmail =
    user.gmail_account_email ?? process.env.USER_FROM_EMAIL ?? user.email;
  const fromName = input.fromName ?? process.env.USER_FROM_NAME ?? "Baumeisterwerk";

  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: user.gmail_refresh_token });
  const gmail = google.gmail({ version: "v1", auth });

  const rfc822 = buildMimeMessage({
    from: { email: fromEmail, name: fromName },
    to: { email: input.to },
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
  });
  const raw = toBase64Url(rfc822);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { messageId: res.data.id ?? "" };
}
