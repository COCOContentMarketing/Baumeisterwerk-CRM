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
  // Wenn gesetzt, wird der Entwurf als Antwort in den bestehenden Gmail-
  // Thread eingehaengt (Gmail-UI zeigt ihn dann als Reply im Thread).
  replyTo?: {
    threadId: string;
    // RFC822 Message-Id der Ursprungsmail. Fuer korrekte Header-Threading
    // bei Non-Gmail-Empfaengern. Falls null, faellt der Draft auf Thread-ID-
    // basierte Gruppierung zurueck (Gmail-only).
    messageIdHeader?: string | null;
    references?: string[];
  };
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

  const extraHeaders: Record<string, string> = {};
  if (input.replyTo?.messageIdHeader) {
    extraHeaders["In-Reply-To"] = input.replyTo.messageIdHeader;
    const refs = [...(input.replyTo.references ?? []), input.replyTo.messageIdHeader];
    extraHeaders["References"] = refs.join(" ");
  }

  const rfc822 = buildMimeMessage({
    from: { email: fromEmail, name: fromName },
    to: { email: input.to, name: input.toName },
    subject: input.subject,
    bodyText: input.body,
    extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
  });
  const raw = toBase64Url(rfc822);

  const message: { raw: string; threadId?: string } = { raw };
  if (input.replyTo?.threadId) message.threadId = input.replyTo.threadId;

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message },
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
