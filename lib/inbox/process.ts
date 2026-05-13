import { fetchNewMessages, type ParsedInboundMessage } from "@/lib/gmail/inbox";
import { classifyReply } from "@/lib/claude/classifyReply";
import { computePendingActions, persistRecommendations } from "@/lib/recommendations/engine";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db/queries";
import type { AppUser, Contact } from "@/types/db";
import type { ReplyClassification } from "@/types/classification";

export interface InboxSyncSummary {
  fetched: number;
  inserted: number;
  classifiedOk: number;
  classifiedFailed: number;
  bouncesProcessed: number;
  unknownSenders: string[];
  recommendationsCreated: number;
  recommendationsUpdated: number;
  usedFallback: boolean;
}

/**
 * Holt neue Mails ab Gmail, ordnet sie bekannten Kontakten zu, klassifiziert
 * sie via Claude, persistiert Bounce-Markierungen und triggert anschliessend
 * den Cadence-Refresh, damit passende Reply-Empfehlungen entstehen.
 */
export async function runInboxSync(): Promise<InboxSyncSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Kein App-User konfiguriert.");
  if (!user.gmail_refresh_token) {
    throw new Error("Gmail ist noch nicht verbunden.");
  }
  return runInboxSyncForUser(user);
}

export async function runInboxSyncForUser(user: AppUser): Promise<InboxSyncSummary> {
  const sb = getSupabaseAdmin();
  const { messages, newHistoryId, usedFallback } = await fetchNewMessages(user);

  const contactsByEmail = await buildContactMap(messages);
  const existingMessageIds = await fetchExistingMessageIds(messages.map((m) => m.gmailMessageId));

  let inserted = 0;
  let classifiedOk = 0;
  let classifiedFailed = 0;
  let bouncesProcessed = 0;
  const unknownSenders = new Set<string>();

  for (const msg of messages) {
    if (existingMessageIds.has(msg.gmailMessageId)) continue;

    // 1. Bounce-Pfad: kein Kontakt-Match noetig, eigene Verarbeitung.
    if (msg.isBounce) {
      const handled = await processBounce(msg);
      if (handled) bouncesProcessed++;
      continue;
    }

    // 2. Regulaere Inbound-Mail: muss einem bekannten Kontakt zuordenbar sein
    //    (Thread-ID-Match primaer, dann Absender-Email-Match).
    const contact = await resolveContact(msg, contactsByEmail);
    if (!contact) {
      unknownSenders.add(msg.fromEmail);
      console.warn(
        `[inbox-sync] kein Match fuer ${msg.fromEmail} (msg ${msg.gmailMessageId})`,
      );
      continue;
    }

    // 3. Klassifikation - sicher gekapselt in classifyReply.
    let classification: ReplyClassification | null = null;
    try {
      classification = await classifyReply({
        subject: msg.subject,
        body: msg.bodyText,
        contactLanguage: contact.language,
      });
      classifiedOk++;
    } catch (e) {
      classifiedFailed++;
      console.warn(
        `[inbox-sync] classifyReply failed for ${msg.gmailMessageId}:`,
        e instanceof Error ? e.message : e,
      );
    }

    // 4. Interaktion einfuegen. UNIQUE auf gmail_message_id schuetzt vor
    //    Race-Conditions mit parallelem Sync.
    const insertOk = await insertInboundInteraction(contact, msg, classification);
    if (insertOk) inserted++;
  }

  // 5. History-Cursor speichern, damit der naechste Sync nur Neuere zieht.
  await sb
    .from("app_user")
    .update({ gmail_last_history_id: newHistoryId })
    .eq("id", user.id);

  // 6. Cadence komplett neu rechnen - damit Reply-Empfehlungen anhand der
  //    frisch klassifizierten Inbounds entstehen.
  const actions = await computePendingActions(new Date());
  const recoResult = await persistRecommendations(actions);

  return {
    fetched: messages.length,
    inserted,
    classifiedOk,
    classifiedFailed,
    bouncesProcessed,
    unknownSenders: Array.from(unknownSenders),
    recommendationsCreated: recoResult.created,
    recommendationsUpdated: recoResult.updated,
    usedFallback,
  };
}

// ============================================================
// Kontakt-Matching
// ============================================================

async function buildContactMap(messages: ParsedInboundMessage[]): Promise<Map<string, Contact>> {
  const emails = Array.from(new Set(messages.filter((m) => !m.isBounce).map((m) => m.fromEmail)));
  if (emails.length === 0) return new Map();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("contacts").select("*").not("email", "is", null);
  if (error) throw error;
  const map = new Map<string, Contact>();
  for (const c of (data ?? []) as Contact[]) {
    if (!c.email) continue;
    const key = c.email.toLowerCase();
    if (emails.includes(key) && !map.has(key)) map.set(key, c);
  }
  return map;
}

async function resolveContact(
  msg: ParsedInboundMessage,
  byEmail: Map<string, Contact>,
): Promise<Contact | null> {
  // Primaer: Gmail-Thread bereits in unseren Interaktionen vorhanden -> Kontakt
  // uebernehmen, damit auch Mails von alternativen Adressen desselben Kontakts
  // dem richtigen Datensatz zugeordnet werden.
  const sb = getSupabaseAdmin();
  const { data: threadHit } = await sb
    .from("interactions")
    .select("contact_id")
    .eq("gmail_thread_id", msg.gmailThreadId)
    .not("contact_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (threadHit?.contact_id) {
    const { data: c } = await sb
      .from("contacts")
      .select("*")
      .eq("id", threadHit.contact_id)
      .maybeSingle();
    if (c) return c as Contact;
  }

  // Sekundaer: Absender-Email auf contacts.email (case-insensitive).
  return byEmail.get(msg.fromEmail) ?? null;
}

async function fetchExistingMessageIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("interactions")
    .select("gmail_message_id")
    .in("gmail_message_id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { gmail_message_id: string | null }[];
  return new Set(rows.map((r) => r.gmail_message_id).filter((x): x is string => !!x));
}

// ============================================================
// Insert
// ============================================================

async function insertInboundInteraction(
  contact: Contact,
  msg: ParsedInboundMessage,
  classification: ReplyClassification | null,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("interactions").insert({
    company_id: contact.company_id,
    contact_id: contact.id,
    type: "email_received",
    direction: "inbound",
    subject: msg.subject,
    body: msg.bodyText,
    occurred_at: msg.occurredAtIso,
    gmail_message_id: msg.gmailMessageId,
    gmail_thread_id: msg.gmailThreadId,
    ai_classification: classification ?? {},
    metadata: {
      from_email: msg.fromEmail,
      from_name: msg.fromName,
      to_emails: msg.toEmails,
      message_id_header: msg.messageIdHeader,
      in_reply_to: msg.inReplyTo,
      references: msg.references,
      snippet: msg.snippet,
    },
  });
  if (!error) return true;
  if (String(error.code) === "23505") return false; // Race mit Unique-Index.
  throw error;
}

// ============================================================
// Bounce-Handling
// ============================================================

async function processBounce(msg: ParsedInboundMessage): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const failedAddr = msg.bounceFailedRecipient;
  let contactId: string | null = null;
  let companyId: string | null = null;

  if (failedAddr) {
    const { data: c } = await sb
      .from("contacts")
      .select("id, company_id")
      .eq("email", failedAddr)
      .maybeSingle();
    if (c) {
      contactId = c.id as string;
      companyId = c.company_id as string;
      // Datenpunkt: Email als ungueltig markieren.
      await sb
        .from("contacts")
        .update({
          email_invalid: true,
          email_invalid_since: new Date().toISOString(),
          email_invalid_reason: msg.bounceReason ?? "Bounce empfangen",
        })
        .eq("id", contactId);
    }
  }

  if (!companyId) {
    // Kein Kontakt-Treffer, nur als Server-Log dokumentieren.
    console.warn(
      `[inbox-sync] Bounce ohne Kontakt-Treffer (failed=${failedAddr ?? "?"}, msg ${msg.gmailMessageId})`,
    );
    return false;
  }

  // Bounce als Interaktion speichern (ohne Body - der kann sensitive Daten
  // enthalten). Wir speichern nur den standardisierten Grund + Failed-Address.
  const { error } = await sb.from("interactions").insert({
    company_id: companyId,
    contact_id: contactId,
    type: "email_received",
    direction: "inbound",
    subject: "[Bounce] " + msg.subject.slice(0, 200),
    body: null,
    occurred_at: msg.occurredAtIso,
    gmail_message_id: msg.gmailMessageId,
    gmail_thread_id: msg.gmailThreadId,
    is_bounce: true,
    bounce_reason: msg.bounceReason,
    metadata: { failed_recipient: failedAddr },
  });
  if (error && String(error.code) !== "23505") throw error;

  // Data-Health-Recommendation: Kontakt-Email validieren / nachpflegen.
  if (contactId) {
    const { data: existing } = await sb
      .from("recommendations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("kind", "research")
      .eq("status", "offen")
      .limit(1);
    if (!existing || existing.length === 0) {
      await sb.from("recommendations").insert({
        company_id: companyId,
        contact_id: contactId,
        kind: "research",
        priority: "mittel",
        status: "offen",
        title: `Email-Adresse von ${failedAddr ?? "Kontakt"} validieren`,
        reason: `Bounce erhalten: ${msg.bounceReason ?? "Zustellung fehlgeschlagen"}. Adresse pruefen und korrigieren.`,
        due_at: new Date().toISOString(),
        source_interaction_id: null,
      });
    }
  }

  return true;
}
