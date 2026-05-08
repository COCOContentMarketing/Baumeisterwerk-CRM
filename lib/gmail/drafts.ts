import { google } from "googleapis";
import { getOAuthClient } from "./oauth";
import { getCurrentUser } from "@/lib/db/queries";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface DraftInput {
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc2822({
  to,
  toName,
  subject,
  body,
  fromName,
  fromEmail,
}: DraftInput): string {
  const fromHeader = fromEmail ? `${fromName ? `"${fromName}" ` : ""}<${fromEmail}>` : "";
  const toHeader = toName ? `"${toName}" <${to}>` : to;
  const lines = [
    `To: ${toHeader}`,
    fromHeader ? `From: ${fromHeader}` : "",
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    "",
    body,
  ].filter(Boolean);
  return lines.join("\r\n");
}

export async function createGmailDraft(input: DraftInput): Promise<{
  draftId: string;
  messageId: string | null;
  threadId: string | null;
}> {
  const user = await getCurrentUser();
  if (!user?.gmail_refresh_token) {
    throw new Error("Gmail ist noch nicht verbunden. Bitte zuerst unter Einstellungen verbinden.");
  }
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: user.gmail_refresh_token });

  const gmail = google.gmail({ version: "v1", auth });
  const raw = encodeBase64Url(
    buildRfc2822({
      ...input,
      fromName: input.fromName ?? process.env.USER_FROM_NAME,
      fromEmail: input.fromEmail ?? user.gmail_account_email ?? process.env.USER_FROM_EMAIL,
    }),
  );

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  return {
    draftId: res.data.id ?? "",
    messageId: res.data.message?.id ?? null,
    threadId: res.data.message?.threadId ?? null,
  };
}

export async function disconnectGmail() {
  const user = await getCurrentUser();
  if (!user) return;
  const sb = getSupabaseAdmin();
  await sb
    .from("app_user")
    .update({ gmail_refresh_token: null, gmail_account_email: null })
    .eq("id", user.id);
}
