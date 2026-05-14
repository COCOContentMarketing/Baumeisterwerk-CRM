// Erkennungslogik fuer die GRANT/RLS-Convention bei Migrationen.
//
// Wird von zwei Stellen genutzt:
//   - scripts/check-migration-grants.mjs  (CLI / npm run check:migrations)
//   - lib/migrations/__tests__/grantConvention.test.ts  (vitest)
//
// Bewusst plain JS (.mjs): so kann das CLI-Skript es ohne Build-Schritt
// direkt importieren, und der vitest-Test importiert es ebenfalls.
//
// Hintergrund der Convention: Supabase aendert die Data-API-Defaults
// (neue Projekte ab 30.05.2026, bestehende ab 30.10.2026). Neue
// public-Tabellen brauchen dann explizite GRANTs. Siehe
// supabase/migrations/_TEMPLATE.sql.

// Pre-Convention-Migrationen: vor PR #8 angelegt, bereits auf der Live-DB
// angewandt. Bereits angewandte Migrationen werden NICHT nachtraeglich
// editiert (siehe supabase/migrations/README.md §5) - sie sind daher
// explizit grandfathered. Ihre fehlenden GRANTs/RLS macht
// supabase/scripts/audit_grants.sql sichtbar; ob/wie nachgezogen wird,
// ist eine separate Entscheidung. Die Convention gilt ab der naechsten
// neuen Migration.
export const GRANDFATHERED = new Set([
  "0001_init.sql",
  "0002_templates_and_digest.sql",
  "0008_multi_location_and_primary_contact.sql",
]);

/** Entfernt SQL-Kommentare (-- Zeile und /* Block *​/), damit auskommentierter
 *  Code die Erkennung weder ausloest noch faelschlich erfuellt. */
export function stripSqlComments(sql) {
  // Blockkommentare zuerst, dann Zeilenkommentare.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

/** Namen aller per CREATE TABLE angelegten Relationen (Schema-Praefix und
 *  "if not exists" werden toleriert). Gibt sie kleingeschrieben zurueck. */
export function findCreatedTables(sql) {
  const clean = stripSqlComments(sql);
  const re =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) {
    out.push(m[1].toLowerCase());
  }
  return out;
}

/** True, wenn die Datei mindestens einen GRANT an service_role enthaelt. */
export function hasServiceRoleGrant(sql) {
  const clean = stripSqlComments(sql);
  return /grant\s+[\s\S]*?\bto\s+service_role\b/i.test(clean);
}

/** True, wenn die Datei RLS auf mindestens einer Tabelle aktiviert. */
export function hasRlsEnabled(sql) {
  const clean = stripSqlComments(sql);
  return /enable\s+row\s+level\s+security/i.test(clean);
}

/**
 * Prueft eine einzelne Migrationsdatei.
 * Dateien mit Underscore-Praefix (z.B. _TEMPLATE.sql) gelten als Vorlagen
 * und werden uebersprungen (skipped=true).
 */
export function checkMigration(filename, sql) {
  const base = filename.split("/").pop() ?? filename;
  if (base.startsWith("_")) {
    return { file: base, skipped: true, reason: "template", createdTables: [], missingGrant: false, missingRls: false, ok: true };
  }
  if (GRANDFATHERED.has(base)) {
    return { file: base, skipped: true, reason: "grandfathered", createdTables: [], missingGrant: false, missingRls: false, ok: true };
  }
  const createdTables = findCreatedTables(sql);
  if (createdTables.length === 0) {
    return { file: base, skipped: false, createdTables: [], missingGrant: false, missingRls: false, ok: true };
  }
  const missingGrant = !hasServiceRoleGrant(sql);
  const missingRls = !hasRlsEnabled(sql);
  return {
    file: base,
    skipped: false,
    createdTables,
    missingGrant,
    missingRls,
    ok: !missingGrant && !missingRls,
  };
}
