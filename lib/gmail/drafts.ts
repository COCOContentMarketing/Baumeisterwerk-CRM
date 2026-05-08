import { google } from "googleapis";
import { getOAuthClient } from "./oauth";
import { getCurrentUser } from "@/lib/db/queries";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildMimeMessage, toBase64Url } from "./mime";

export interface DraftInput {
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
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
  const fromName = input.fromName ?? process.env.USER_FROM_NAME ?? "Baumeisterwerk";
  const fromEmail =
    input.fromEmail ?? user.gmail_account_email ?? process.env.USER_FROM_EMAIL ?? user.email;

  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: user.gmail_refresh_token });
  const gmail = google.gmail({ version: "v1", auth });

  const rfc822 = buildMimeMessage({
    from: { email: fromEmail, name: fromName },
    to: { email: input.to, name: input.toName },
    subject: input.subject,
    bodyText: input.body,
  });
  const raw = toBase64Url(rfc822);

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
