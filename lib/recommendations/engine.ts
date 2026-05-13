import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { evaluateContact, type PendingAction } from "./cadence";
import type {
  Company,
  Contact,
  ContactCompanyLink,
  Interaction,
} from "@/types/db";

// Wertet alle aktiven Unternehmen + Kontakte gegen die B2B-Kontaktzyklen aus
// und liefert die Liste der heute faelligen Aktionen. Schreibt sie nicht
// automatisch - das macht persistRecommendations() separat, damit der
// Daily-Digest auch ohne DB-Insert lesen kann.
//
// Multi-Location: Wir iterieren ueber contact_company_links statt ueber
// contacts. Damit wird jedes (Kontakt, Standort)-Paar separat bewertet;
// "primaerer Kontakt" wird aus dem Link bestimmt, nicht aus contacts.is_primary.
export interface ComputeInput {
  companies: Company[];
  contacts: Contact[];
  interactions: Interaction[];
  links: ContactCompanyLink[];
  now: Date;
}

export function computePendingActionsFrom(input: ComputeInput): PendingAction[] {
  const cMap = new Map(input.companies.map((c) => [c.id, c]));
  const pMap = new Map(input.contacts.map((c) => [c.id, c]));

  // Outbound-Marker pro Company: "Standort wurde schon angeschrieben" - egal
  // ueber welchen Kontakt. Verhindert dass wir bei mehreren primaeren Kontakten
  // an unterschiedlichen Standorten den gleichen Erstkontakt mehrfach
  // vorschlagen.
  const companyHasOutbound = new Set<string>();
  for (const i of input.interactions) {
    if (i.direction === "outbound") companyHasOutbound.add(i.company_id);
  }

  const out: PendingAction[] = [];

  for (const link of input.links) {
    const company = cMap.get(link.company_id);
    const contact = pMap.get(link.contact_id);
    if (!company || !contact) continue;

    // Interaktionen ausschliesslich des (contact, company)-Paares - eine
    // Touch an Standort A zaehlt nicht als Touch an Standort B.
    const pairInteractions = input.interactions.filter(
      (i) => i.contact_id === link.contact_id && i.company_id === link.company_id,
    );

    if (
      pairInteractions.length === 0 &&
      !link.is_primary &&
      !companyHasOutbound.has(company.id)
    ) {
      // Kein eigener Verlauf, nicht primaer am Standort, Standort noch nicht
      // angeschrieben: ueberspringen, um pro Standort nicht mehrere
      // Erstkontakt-Empfehlungen zu erzeugen.
      continue;
    }

    const action = evaluateContact({
      company,
      contact,
      interactions: pairInteractions,
      now: input.now,
    });
    if (action) out.push(action);
  }

  // Sortierung: hoch -> mittel -> niedrig, dann Firma alphabetisch.
  const rank = { hoch: 3, mittel: 2, niedrig: 1 } as const;
  out.sort(
    (a, b) =>
      rank[b.priority] - rank[a.priority] ||
      a.company.name.localeCompare(b.company.name, "de"),
  );
  return out;
}

export async function computePendingActions(now: Date = new Date()): Promise<PendingAction[]> {
  const sb = getSupabaseAdmin();
  const [{ data: companies }, { data: contacts }, { data: interactions }, { data: links }] =
    await Promise.all([
      sb.from("companies").select("*"),
      sb.from("contacts").select("*"),
      sb.from("interactions").select("*"),
      sb.from("contact_company_links").select("*"),
    ]);

  return computePendingActionsFrom({
    companies: (companies ?? []) as Company[],
    contacts: (contacts ?? []) as Contact[],
    interactions: (interactions ?? []) as Interaction[],
    links: (links ?? []) as ContactCompanyLink[],
    now,
  });
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
          source_interaction_id: a.inbound_reply_context?.interaction_id ?? null,
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
        source_interaction_id: a.inbound_reply_context?.interaction_id ?? null,
      });
      created++;
    }
  }
  return { created, updated };
}
