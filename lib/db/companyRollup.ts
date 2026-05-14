// TypeScript-Twin der SQL-VIEW companies_with_rollup aus
// supabase/migrations/0011_company_last_interaction_view.sql.
//
// Die View berechnet pro Company effective_last_interaction_at als
// GREATEST(eigenes last_interaction_at, MAX(last_interaction_at aller
// Children-Standorte)). Diese Funktion bildet exakt dieselbe Logik fuer
// Unit-Tests ab; die App liest den Wert im Normalbetrieb aus der View.

/**
 * Liefert das effektive last_interaction_at: das spaeteste Datum aus dem
 * eigenen Wert und allen Children-Werten. NULL-Werte werden ignoriert.
 * Sind alle Werte NULL, ist das Ergebnis NULL.
 *
 * ISO-8601-Strings (timestamptz) sind lexikografisch sortierbar, daher
 * reicht ein String-Vergleich.
 */
export function rollupLastInteraction(
  ownLastInteractionAt: string | null,
  childLastInteractionAts: ReadonlyArray<string | null>,
): string | null {
  let max: string | null = ownLastInteractionAt;
  for (const child of childLastInteractionAts) {
    if (child === null) continue;
    if (max === null || child > max) max = child;
  }
  return max;
}
