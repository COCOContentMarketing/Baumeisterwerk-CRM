import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { draftEmail } from "@/lib/claude/email";
import { deriveSalutationDefault } from "@/lib/db/salutation";
import { isReplyClassification } from "@/types/classification";
import {
  getContact,
  getCurrentUser,
  getInteraction,
  listInteractionsForContact,
} from "@/lib/db/queries";

const Body = z.object({
  interaction_id: z.string().uuid(),
  hint: z.string().max(2000).optional(),
  salutation_form: z.enum(["du", "sie"]).optional(),
});

// Komfort-Route: bekommt eine Inbound-Interaktion und liefert einen
// Claude-Entwurf inkl. Threading-Metadaten zurueck. Der Versand bleibt
// IMMER manuell (Composer -> Gmail-Draft).
export async function POST(req: NextRequest) {
  try {
    const parsed = Body.parse(await req.json());
    const inbound = await getInteraction(parsed.interaction_id);
    if (!inbound || inbound.type !== "email_received") {
      return NextResponse.json(
        { error: "Inbound-Mail nicht gefunden." },
        { status: 404 },
      );
    }
    if (!inbound.contact_id) {
      return NextResponse.json(
        { error: "Mail ist keinem Kontakt zugeordnet." },
        { status: 400 },
      );
    }

    const contact = await getContact(inbound.contact_id);
    if (!contact) {
      return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
    }

    const [history, user] = await Promise.all([
      listInteractionsForContact(contact.id),
      getCurrentUser(),
    ]);

    const classification = isReplyClassification(inbound.ai_classification)
      ? inbound.ai_classification
      : null;

    const useCase = classification ? intentToUseCase(classification.intent) : "inbound_reply";
    // Anrede: explizite Wahl, sonst aus dem Verlauf ableiten.
    const salutationForm = parsed.salutation_form ?? deriveSalutationDefault(history);

    const draft = await draftEmail({
      company: contact.company,
      contact,
      interactions: history,
      hint: parsed.hint,
      signature: user?.signature ?? null,
      useCase,
      salutationForm,
      replyContext: classification
        ? {
            inbound_subject: inbound.subject ?? "",
            inbound_excerpt: inbound.body ?? "",
            inbound_date: inbound.occurred_at,
            classification: {
              intent: classification.intent,
              suggested_next_step: classification.suggested_next_step,
              key_quotes: classification.key_quotes,
            },
          }
        : undefined,
    });

    const meta = (inbound.metadata ?? {}) as {
      message_id_header?: string | null;
      references?: string[];
    };

    return NextResponse.json({
      subject: draft.subject,
      body: draft.body,
      contact_id: contact.id,
      contact_email: contact.email,
      contact_name: contact.full_name,
      gmail_thread_id: inbound.gmail_thread_id,
      message_id_header: meta.message_id_header ?? null,
      references: meta.references ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}

function intentToUseCase(intent: string): string {
  switch (intent) {
    case "interesse":
      return "inbound_reply_interest";
    case "rueckfrage":
      return "inbound_reply_rueckfrage";
    case "absage":
      return "inbound_reply_absage_reaktivierung";
    case "ooo":
      return "inbound_reply_ooo";
    case "unklar":
      return "inbound_reply_unklar";
    default:
      return "inbound_reply";
  }
}
