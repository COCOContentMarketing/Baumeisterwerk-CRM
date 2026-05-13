import { google, type gmail_v1 } from "googleapis";
import { getOAuthClient } from "./oauth";
import type { AppUser } from "@/types/db";

// Kappt Worst-Case-Belastung pro Sync-Run (z.B. nach langer Pause).
const SYNC_MESSAGE_LIMIT = 100;

/** Eine parsierte Inbound-Mail; alle Felder von der App weiterverwendbar. */
export interface ParsedInboundMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  occurredAtIso: string;
  fromName: string | null;
  fromEmail: string;
  toEmails: string[];
  subject: string;
  snippet: string;
  bodyText: string;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  references: string[];
  /** True wenn Headern/Subject/Content-Type nach klar ein Delivery-Status. */
  isBounce: boolean;
  bounceReason: string | null;
  /** Aus Bounce-Body extrahierte ungueltige Empfaenger-Adresse (falls erkennbar). */
  bounceFailedRecipient: string | null;
}

export interface FetchResult {
  messages: ParsedInboundMessage[];
  newHistoryId: string | null;
  usedFallback: boolean;
}

/**
 * Holt neue Inbound-Mails fuer den App-User.
 *
 * Strategie:
 *   1. Wenn gmail_last_history_id gesetzt: history.list ab diesem Cursor.
 *   2. Sonst (oder bei 404 zu altem Cursor): messages.list mit newer_than:7d.
 *
 * Liefert die geparsten Mails + den neuen History-Cursor zurueck. Der Caller
 * (lib/inbox/process.ts) entscheidet, was er damit macht (Insert, Klassifizieren,
 * Recommendation-Refresh) und updated app_user.gmail_last_history_id.
 */
export async function fetchNewMessages(user: AppUser): Promise<FetchResult> {
  if (!user.gmail_refresh_token) {
    throw new Error("Gmail ist noch nicht verbunden.");
  }
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: user.gmail_refresh_token });
  const gmail = google.gmail({ version: "v1", auth });

  const { messageIds, newHistoryId, usedFallback } = await collectMessageIds(
    gmail,
    user.gmail_last_history_id,
  );

  const limited = messageIds.slice(0, SYNC_MESSAGE_LIMIT);
  const messages: ParsedInboundMessage[] = [];
  for (const id of limited) {
    try {
      const res = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      const parsed = parseGmailMessage(res.data);
      if (parsed) messages.push(parsed);
    } catch {
      // Einzelne Mail-Fehler ueberspringen; Sync nicht abbrechen.
    }
  }
  return { messages, newHistoryId, usedFallback };
}

async function collectMessageIds(
  gmail: gmail_v1.Gmail,
  startHistoryId: string | null,
): Promise<{ messageIds: string[]; newHistoryId: string | null; usedFallback: boolean }> {
  if (startHistoryId) {
    try {
      const ids = new Set<string>();
      let pageToken: string | undefined;
      let latest: string = startHistoryId;
      do {
        const res = await gmail.users.history.list({
          userId: "me",
          startHistoryId,
          historyTypes: ["messageAdded"],
          labelId: "INBOX",
          pageToken,
        });
        for (const h of res.data.history ?? []) {
          for (const m of h.messagesAdded ?? []) {
            if (m.message?.id) ids.add(m.message.id);
          }
        }
        if (res.data.historyId) latest = res.data.historyId;
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return { messageIds: [...ids], newHistoryId: latest, usedFallback: false };
    } catch {
      // History-Cursor zu alt -> Fallback.
    }
  }
  const ids = await listRecentInboxMessageIds(gmail);
  const profile = await gmail.users.getProfile({ userId: "me" });
  return {
    messageIds: ids,
    newHistoryId: profile.data.historyId ?? null,
    usedFallback: true,
  };
}

async function listRecentInboxMessageIds(gmail: gmail_v1.Gmail): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox newer_than:7d -from:me",
    maxResults: 50,
  });
  return (res.data.messages ?? [])
    .map((m) => m.id ?? null)
    .filter((id): id is string => !!id);
}

/**
 * Wandelt Gmails Message-JSON in unsere ParsedInboundMessage.
 * Exportiert fuer Tests.
 */
export function parseGmailMessage(
  msg: gmail_v1.Schema$Message,
): ParsedInboundMessage | null {
  if (!msg.id || !msg.threadId) return null;
  const headers = msg.payload?.headers ?? [];
  const getH = (name: string): string | null => {
    const h = headers.find(
      (h) => (h.name ?? "").toLowerCase() === name.toLowerCase(),
    );
    return h?.value ?? null;
  };

  const fromRaw = getH("From");
  if (!fromRaw) return null;
  const fromAddr = parseEmailAddress(fromRaw);
  if (!fromAddr.email) return null;

  const subject = (getH("Subject") ?? "(ohne Betreff)").trim();
  const messageIdHeader = getH("Message-Id") ?? getH("Message-ID");
  const inReplyTo = getH("In-Reply-To");
  const referencesRaw = getH("References") ?? "";
  const references = referencesRaw.split(/\s+/).filter(Boolean);

  const toRaw = getH("To") ?? "";
  const toEmails = toRaw
    .split(",")
    .map((s) => parseEmailAddress(s).email)
    .filter((e): e is string => !!e);

  const internalDateMs = Number(msg.internalDate ?? Date.now());
  const occurredAtIso = new Date(internalDateMs).toISOString();
  const bodyText = (extractPlainTextBody(msg.payload) || msg.snippet || "").trim();
  const snippet = (msg.snippet ?? "").trim();

  const bounce = detectBounce({
    fromEmail: fromAddr.email,
    subject,
    payload: msg.payload,
    bodyText,
  });

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    occurredAtIso,
    fromName: fromAddr.name,
    fromEmail: fromAddr.email,
    toEmails,
    subject,
    snippet,
    bodyText,
    messageIdHeader,
    inReplyTo,
    references,
    isBounce: bounce.isBounce,
    bounceReason: bounce.reason,
    bounceFailedRecipient: bounce.failedRecipient,
  };
}

interface ParsedAddress {
  name: string | null;
  email: string | null;
}

function parseEmailAddress(raw: string): ParsedAddress {
  const m = raw.match(/^\s*(?:"([^"]*)"|([^<]+?))?\s*<([^>]+)>\s*$/);
  if (m) {
    const nameQuoted = m[1] ?? null;
    const nameUnquoted = m[2] ?? null;
    const name = (nameQuoted ?? nameUnquoted)?.trim() || null;
    return { name, email: m[3].trim().toLowerCase() };
  }
  const trimmed = raw.trim();
  if (trimmed.includes("@")) return { name: null, email: trimmed.toLowerCase() };
  return { name: null, email: null };
}

function extractPlainTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const flat: gmail_v1.Schema$MessagePart[] = [];
  const walk = (p: gmail_v1.Schema$MessagePart): void => {
    if (p.parts && p.parts.length > 0) p.parts.forEach(walk);
    else flat.push(p);
  };
  walk(payload);

  const plain = flat.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = flat.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data));

  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function decodeBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ============================================================
// Bounce-Detection
// ============================================================

const BOUNCE_SUBJECT_RE = /^(Undelivered|Mail Delivery|Delivery Status Notification|Delivery has failed|Returned mail|Mail delivery failed)/i;
const BOUNCE_FROM_RE = /^(mailer-daemon|postmaster)@/i;

interface BounceVerdict {
  isBounce: boolean;
  reason: string | null;
  failedRecipient: string | null;
}

function detectBounce(args: {
  fromEmail: string;
  subject: string;
  payload: gmail_v1.Schema$MessagePart | undefined;
  bodyText: string;
}): BounceVerdict {
  const reasons: string[] = [];

  if (BOUNCE_FROM_RE.test(args.fromEmail)) reasons.push(`From: ${args.fromEmail}`);
  if (BOUNCE_SUBJECT_RE.test(args.subject)) reasons.push("Bounce-Subject erkannt");
  if (hasDeliveryStatusPart(args.payload)) reasons.push("Delivery-Status-Part vorhanden");

  if (reasons.length === 0) {
    return { isBounce: false, reason: null, failedRecipient: null };
  }

  const failedRecipient = extractFailedRecipient(args.bodyText);
  // Standardisierter, knapper Grund - kein freier Mail-Body-Auszug, der
  // sensitive Daten enthalten koennte.
  const reason = reasons.join(" · ");
  return { isBounce: true, reason, failedRecipient };
}

function hasDeliveryStatusPart(
  payload: gmail_v1.Schema$MessagePart | undefined,
): boolean {
  if (!payload) return false;
  const stack: gmail_v1.Schema$MessagePart[] = [payload];
  while (stack.length > 0) {
    const p = stack.pop();
    if (!p) continue;
    if ((p.mimeType ?? "").toLowerCase().startsWith("message/delivery-status")) return true;
    if (p.parts) stack.push(...p.parts);
  }
  return false;
}

function extractFailedRecipient(bodyText: string): string | null {
  const patterns = [
    /Final-Recipient:\s*[a-z]+;\s*([^\s<>]+@[^\s<>]+)/i,
    /failed recipient[^\n]*?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    /<([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>:\s*(?:Recipient|address rejected|not found)/i,
  ];
  for (const re of patterns) {
    const m = bodyText.match(re);
    if (m) return m[1].toLowerCase();
  }
  return null;
}
