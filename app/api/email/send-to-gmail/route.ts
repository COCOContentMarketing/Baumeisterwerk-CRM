import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { getContact, getInteraction } from "@/lib/db/queries";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  contact_id: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  recommendation_id: z.string().uuid().optional(),
  // Wenn gesetzt: wird der Entwurf in den Thread der angegebenen Inbound-
  // Mail eingehaengt und die Inbound wird als bearbeitet markiert.
  reply_to_interaction_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.parse(await req.json());
    const contact = await getContact(parsed.contact_id);
    if (!contact?.email)
      return NextResponse.json({ error: "Kontakt hat keine Email-Adresse" }, { status: 400 });

    const replyTo = await resolveReplyTo(parsed.reply_to_interaction_id);

    const draft = await createGmailDraft({
      to: contact.email,
      toName: contact.full_name,
      subject: parsed.subject,
      body: parsed.body,
      replyTo: replyTo ?? undefined,
    });

    const sb = getSupabaseAdmin();
    const { data: interaction, error } = await sb
      .from("interactions")
      .insert({
        company_id: contact.company_id,
        contact_id: contact.id,
        type: "email_draft",
        direction: "outbound",
        subject: parsed.subject,
        body: parsed.body,
        gmail_draft_id: draft.draftId,
        gmail_message_id: draft.messageId,
        gmail_thread_id: draft.threadId,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (parsed.recommendation_id) {
      await sb
        .from("recommendations")
        .update({
          status: "erledigt",
          gmail_draft_id: draft.draftId,
          resulting_interaction_id: interaction.id,
        })
        .eq("id", parsed.recommendation_id);
    }
    if (parsed.reply_to_interaction_id) {
      await sb
        .from("interactions")
        .update({ inbox_handled_at: new Date().toISOString() })
        .eq("id", parsed.reply_to_interaction_id)
        .eq("type", "email_received");
    }

    return NextResponse.json({
      draftId: draft.draftId,
      gmailUrl: `https://mail.google.com/mail/u/0/#drafts/${draft.draftId}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function resolveReplyTo(
  interactionId: string | undefined,
): Promise<{ threadId: string; messageIdHeader: string | null; references: string[] } | null> {
  if (!interactionId) return null;
  const inbound = await getInteraction(interactionId);
  if (!inbound || inbound.type !== "email_received" || !inbound.gmail_thread_id) return null;
  const meta = (inbound.metadata ?? {}) as {
    message_id_header?: string | null;
    references?: string[];
  };
  return {
    threadId: inbound.gmail_thread_id,
    messageIdHeader: meta.message_id_header ?? null,
    references: meta.references ?? [],
  };
}
