// Pure-TS-Spiegelung der DB-Logik aus Migration 0008:
//   1) Trigger set_single_primary_per_company demoted andere Primaries.
//   2) Datenmigration aus 0008: aeltester contacts.is_primary=true wird
//      pro Company zum Link-Primary; weitere bleiben false.
//
// Die Funktionen werden aktuell nur fuer Unit-Tests verwendet; sie
// koennen zukuenftig auch fuer optimistische UI-Updates dienen, ohne
// einen Roundtrip zur DB warten zu muessen.

export interface PrimaryAssignmentLink {
  id: string;
  contact_id: string;
  company_id: string;
  is_primary: boolean;
}

/**
 * Was passiert, wenn eine UPSERT/UPDATE-Operation den `target`-Link auf
 * is_primary=true setzt? Trigger-Semantik: alle ANDEREN Primaries derselben
 * Company werden auf false demoted.
 */
export function pickPrimaryAfterUpdate(
  links: PrimaryAssignmentLink[],
  target: PrimaryAssignmentLink,
): PrimaryAssignmentLink[] {
  const present = links.some((l) => l.id === target.id);
  const after = present
    ? links.map((l) => (l.id === target.id ? target : l))
    : [...links, target];
  if (!target.is_primary) return after;
  return after.map((l) =>
    l.id !== target.id && l.company_id === target.company_id && l.is_primary
      ? { ...l, is_primary: false }
      : l,
  );
}

/**
 * Spiegel der Datenmigration aus 0008:
 * - Pro (contact.id, contact.company_id) ein Link, is_primary=false.
 * - Pro Company genau ein Link wird auf is_primary=true gesetzt: der
 *   Eintrag, dessen Quell-Contact als aeltester die alte Flag
 *   contacts.is_primary=true trug.
 */
export interface MigrationInputContact {
  id: string;
  company_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface MigratedLink {
  contact_id: string;
  company_id: string;
  is_primary: boolean;
}

export function migrateExistingPrimaries(contacts: MigrationInputContact[]): MigratedLink[] {
  const links: MigratedLink[] = contacts.map((c) => ({
    contact_id: c.id,
    company_id: c.company_id,
    is_primary: false,
  }));
  const oldestPrimaryByCompany = new Map<string, { contact_id: string; created_at: string }>();
  for (const c of contacts) {
    if (!c.is_primary) continue;
    const prev = oldestPrimaryByCompany.get(c.company_id);
    if (!prev || c.created_at < prev.created_at) {
      oldestPrimaryByCompany.set(c.company_id, { contact_id: c.id, created_at: c.created_at });
    }
  }
  return links.map((l) => {
    const pick = oldestPrimaryByCompany.get(l.company_id);
    return pick && pick.contact_id === l.contact_id ? { ...l, is_primary: true } : l;
  });
}
