import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { evaluateContact, type PendingAction } from "./cadence";
import type { Company, Contact, Interaction } from "@/types/db";

// Wertet alle aktiven Unternehmen + Kontakte gegen die B2B-Kontaktzyklen aus
// und liefert die Liste der heute faelligen Aktionen. Schreibt sie nicht
// automatisch - das macht persistRecommendations() separat, damit der
// Daily-Digest auch ohne DB-Insert lesen kann.
export async function computePendingActions(now: Date = new Date()): Promise<PendingAction[]> {
  const sb = getSupabaseAdmin();
  const [{ data: companies }, { data: contacts }, { data: interactions }] = await Promise.all([
    sb.from("companies").select("*"),
    sb.from("contacts").select("*"),
    sb.from("interactions").select("*"),
  ]);

  const cs = (companies ?? []) as Company[];
  const ps = (contacts ?? []) as Contact[];
  const ins = (interactions ?? []) as Interaction[];

  const cMap = new Map(cs.map((c) => [c.id, c]));
  const interactionsByContact = new Map<string, Interaction[]>();
  const interactionsByCompany = new Map<string, Interaction[]>();
  for (const i of ins) {
    if (i.contact_id) {
      const arr = interactionsByContact.get(i.contact_id) ?? [];
      arr.push(i);
      interactionsByContact.set(i.contact_id, arr);
    }
    const carr = interactionsByCompany.get(i.company_id) ?? [];
    carr.push(i);
    interactionsByCompany.set(i.company_id, carr);
  }

  const out: PendingAction[] = [];
  for (const contact of ps) {
    const company = cMap.get(contact.company_id);
    if (!company) continue;
    // Nur primaere Kontakte werden automatisch fuer Erstkontakt vorgeschlagen,
    // damit wir nicht mehrfach an dasselbe Unternehmen anschreiben.
    // Folge-Actions (Antwort, Termin-Followup) werden aber fuer alle
    // Kontakte mit Verlauf evaluiert.
    const ownInteractions = interactionsByContact.get(contact.id) ?? [];
    const companyHasOutbound = (interactionsByCompany.get(company.id) ?? []).some(
      (i) => i.direction === "outbound",
    );
    if (ownInteractions.length === 0 && !contact.is_primary && !companyHasOutbound) {
      // Kein eigener Verlauf, nicht primary, Firma noch nicht angeschrieben:
      // ueberspringen - sonst entstehen pro Firma mehrere Erstkontakt-Recs.
      continue;
    }
    const action = evaluateContact({ company, contact, interactions: ownInteractions, now });
    if (action) out.push(action);
  }

  // Sortierung: hoch -> mittel -> niedrig, dann alphabetisch
  const rank = { hoch: 3, mittel: 2, niedrig: 1 } as const;
  out.sort(
    (a, b) =>
      rank[b.priority] - rank[a.priority] ||
      a.company.name.localeCompare(b.company.name, "de"),
  );
  return out;
}

// Persistiert Pending Actions als Recommendations. Bestehende offene
// Empfehlungen mit gleichem (contact_id, kind) werden nicht doppelt
// erzeugt, sondern aktualisiert.
export async function persistRecommendations(actions: PendingAction[]): Promise<{
  created: number;
  updated: number;
}> {
  if (actions.length === 0) return { created: 0, updated: 0 };
  const sb = getSupabaseAdmin();

  const contactIds = Array.from(new Set(actions.map((a) => a.contact.id)));
  const { data: existing } = await sb
    .from("recommendations")
    .select("id, contact_id, kind, status")
    .in("contact_id", contactIds)
    .eq("status", "offen");

  const existingMap = new Map<string, string>();
  for (const r of existing ?? []) {
    existingMap.set(`${r.contact_id}:${r.kind}`, r.id as string);
  }

  let created = 0;
  let updated = 0;
  for (const a of actions) {
    const key = `${a.contact.id}:${a.kind}`;
    const existingId = existingMap.get(key);
    if (existingId) {
      await sb
        .from("recommendations")
        .update({
          priority: a.priority,
          title: a.title,
          reason: a.reason,
          due_at: a.due_at,
        })
        .eq("id", existingId);
      updated++;
    } else {
      await sb.from("recommendations").insert({
        company_id: a.company.id,
        contact_id: a.contact.id,
        kind: a.kind,
        priority: a.priority,
        status: "offen",
        title: a.title,
        reason: a.reason,
        due_at: a.due_at,
      });
      created++;
    }
  }
  return { created, updated };
}
