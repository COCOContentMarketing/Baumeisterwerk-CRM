import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContact, getCurrentUser, listInteractionsForContact } from "@/lib/db/queries";
import { draftEmail } from "@/lib/claude/email";

const Body = z.object({
  contact_id: z.string().uuid(),
  hint: z.string().max(2000).optional(),
  use_case: z.string().optional(),
  template_name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = Body.parse(json);
    const contact = await getContact(parsed.contact_id);
    if (!contact) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
    if (!contact.email)
      return NextResponse.json({ error: "Kontakt hat keine Email-Adresse" }, { status: 400 });
    const [interactions, user] = await Promise.all([
      listInteractionsForContact(parsed.contact_id),
      getCurrentUser(),
    ]);

    // Use-Case automatisch aus Verlauf inferieren, falls nicht uebergeben.
    const useCase = parsed.use_case ?? inferUseCase(interactions);

    const draft = await draftEmail({
      company: contact.company,
      contact,
      interactions,
      hint: parsed.hint,
      signature: user?.signature ?? null,
      useCase,
      templateName: parsed.template_name,
    });
    return NextResponse.json(draft);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function inferUseCase(interactions: { type: string; direction: string; occurred_at: string }[]): string {
  if (interactions.length === 0) return "erstkontakt";
  const sorted = [...interactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const lastInbound = sorted.find((i) => i.direction === "inbound");
  const lastOutbound = sorted.find((i) => i.direction === "outbound");
  if (lastInbound && (!lastOutbound || lastInbound.occurred_at > lastOutbound.occurred_at)) {
    return "inbound_reply";
  }
  const outboundCount = sorted.filter((i) => i.direction === "outbound").length;
  if (outboundCount === 0) return "erstkontakt";
  if (outboundCount === 1) return "follow_up_1";
  if (outboundCount === 2) return "follow_up_2";
  return "re_engagement";
}
