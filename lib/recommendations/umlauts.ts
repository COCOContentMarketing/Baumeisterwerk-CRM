// Reparatur von ASCII-Ersatzformen (ae/oe/ue/ss) in bereits gespeicherten
// Reco-Titeln und -Reasons. Diese Funktion ist der TypeScript-Twin der
// SQL-Replacements aus supabase/migrations/0010_backfill_reco_umlauts.sql -
// beide MUESSEN dieselbe REPLACEMENTS-Liste verwenden.
//
// Bewusst KEINE pauschale ae->ae-Ersetzung: das wuerde englische Woerter
// wie "Email" zerstoeren. Stattdessen nur klar definierte Wort-Stems, die
// von der Engine bzw. von aelteren AI-Recos nachweislich erzeugt wurden.

// Reihenfolge ist unkritisch: die Stems ueberlappen sich nicht.
// Jede Ersetzung ist idempotent - die Zielform enthaelt den Such-Stem
// nicht mehr, ein zweiter Durchlauf ist also ein No-op.
export const UMLAUT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["persoenlich", "persönlich"],
  ["Persoenlich", "Persönlich"],
  ["Aufhaenger", "Aufhänger"],
  ["aufhaenger", "aufhänger"],
  ["fuer", "für"],
  ["Fuer", "Für"],
  ["ueber", "über"],
  ["Ueber", "Über"],
  ["Rueck", "Rück"],
  ["rueck", "rück"],
  ["Naechst", "Nächst"],
  ["naechst", "nächst"],
  ["Bestaetigung", "Bestätigung"],
  ["bestaetigung", "bestätigung"],
  ["Prioritaet", "Priorität"],
  ["prioritaet", "priorität"],
  ["Anstossen", "Anstoßen"],
  ["anstossen", "anstoßen"],
  ["Gespraech", "Gespräch"],
  ["gespraech", "gespräch"],
  ["Tonalitaet", "Tonalität"],
  ["tonalitaet", "tonalität"],
  ["Loesung", "Lösung"],
  ["loesung", "lösung"],
];

/**
 * Ersetzt bekannte ASCII-Workaround-Stems durch echte Umlaute.
 * Idempotent: fixUmlautWorkarounds(fixUmlautWorkarounds(x)) === fixUmlautWorkarounds(x).
 */
export function fixUmlautWorkarounds(input: string): string {
  let out = input;
  for (const [from, to] of UMLAUT_REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

/** True, wenn der String mindestens einen bekannten Workaround-Stem enthaelt. */
export function hasUmlautWorkaround(input: string): boolean {
  return UMLAUT_REPLACEMENTS.some(([from]) => input.includes(from));
}
