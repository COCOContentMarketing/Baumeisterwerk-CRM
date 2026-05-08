import { google } from "googleapis";
import { getOAuthClient } from "./oauth";
import { getCurrentUser } from "@/lib/db/queries";

export interface SendInput {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  fromName?: string;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildMimeMessage(input: SendInput, fromEmail: string): string {
  const boundary = "----=_BMW_" + Math.random().toString(36).slice(2);
  const fromHeader = input.fromName ? `"${input.fromName}" <${fromEmail}>` : fromEmail;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
  ];
  if (input.bodyHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const parts = [
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      input.bodyText,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      input.bodyHtml,
      "",
      `--${boundary}--`,
    ];
    return [...headers, ...parts].join("\r\n");
  }
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: 7bit");
  return [...headers, "", input.bodyText].join("\r\n");
}

export async function sendGmail(input: SendInput): Promise<{ messageId: string }> {
  const user = await getCurrentUser();
  if (!user?.gmail_refresh_token) {
    throw new Error("Gmail ist nicht verbunden. Bitte unter /settings verbinden.");
  }
  const fromEmail =
    user.gmail_account_email ?? process.env.USER_FROM_EMAIL ?? user.email;

  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: user.gmail_refresh_token });
  const gmail = google.gmail({ version: "v1", auth });

  const raw = encodeBase64Url(
    buildMimeMessage(
      { ...input, fromName: input.fromName ?? process.env.USER_FROM_NAME ?? "Baumeisterwerk" },
      fromEmail,
    ),
  );
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { messageId: res.data.id ?? "" };
}
