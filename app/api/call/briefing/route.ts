import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContact, listInteractionsForContact } from "@/lib/db/queries";
import { callBriefing } from "@/lib/claude/email";

const Body = z.object({
  contact_id: z.string().uuid(),
  hint: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.parse(await req.json());
    const contact = await getContact(parsed.contact_id);
    if (!contact) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
    const interactions = await listInteractionsForContact(parsed.contact_id);
    const briefing = await callBriefing({
      company: contact.company,
      contact,
      interactions,
      hint: parsed.hint,
    });
    return NextResponse.json(briefing);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
