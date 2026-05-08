import { NextResponse } from "next/server";
import { listAllContacts, listCompanies } from "@/lib/db/queries";
import { generateRecommendations } from "@/lib/claude/recommendations";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CLAUDE_MODEL } from "@/lib/claude/client";

export async function POST() {
  try {
    const [companies, contacts] = await Promise.all([listCompanies(), listAllContacts()]);
    if (companies.length === 0) {
      return NextResponse.json({ error: "Noch keine Unternehmen angelegt." }, { status: 400 });
    }
    const recs = await generateRecommendations({ companies, contacts });

    const sb = getSupabaseAdmin();
    // Vorhandene offene Recs stehen lassen, aber neue Empfehlungen erstmal als zusaetzliche Eintraege.
    const now = new Date();
    const rows = recs.map((r) => {
      const due = new Date(now.getTime() + r.suggested_due_in_days * 24 * 60 * 60 * 1000);
      return {
        company_id: r.company_id,
        contact_id: r.contact_id,
        kind: r.kind,
        priority: r.priority,
        title: r.title,
        reason: r.reason,
        due_at: due.toISOString(),
        ai_model: CLAUDE_MODEL,
        ai_generated_at: now.toISOString(),
        status: "offen" as const,
      };
    });

    if (rows.length > 0) {
      const { error } = await sb.from("recommendations").insert(rows);
      if (error) throw error;
    }
    return NextResponse.json({ created: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
