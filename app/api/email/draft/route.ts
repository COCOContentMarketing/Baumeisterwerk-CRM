import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContact, getCurrentUser, listInteractionsForContact } from "@/lib/db/queries";
import { draftEmail } from "@/lib/claude/email";

const Body = z.object({
  contact_id: z.string().uuid(),
  hint: z.string().max(2000).optional(),
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
    const draft = await draftEmail({
      company: contact.company,
      contact,
      interactions,
      hint: parsed.hint,
      signature: user?.signature ?? null,
    });
    return NextResponse.json(draft);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
