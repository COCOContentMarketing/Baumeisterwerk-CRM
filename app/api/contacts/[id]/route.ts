import { NextRequest, NextResponse } from "next/server";
import { getContact, listInteractionsForContact } from "@/lib/db/queries";
import { deriveSalutationDefault } from "@/lib/db/salutation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const interactions = await listInteractionsForContact(id);
  return NextResponse.json({
    id: contact.id,
    email: contact.email,
    full_name: contact.full_name,
    company_id: contact.company_id,
    salutation_default: deriveSalutationDefault(interactions),
  });
}
