#!/usr/bin/env node
// Pruefskript fuer die GRANT/RLS-Convention bei Migrationen.
//
// Scannt supabase/migrations/*.sql und warnt, wenn eine Migration eine
// public-Tabelle anlegt (CREATE TABLE), aber keinen GRANT-an-service_role-
// und/oder keinen "enable row level security"-Block in derselben Datei hat.
//
// Aufruf:  npm run check:migrations
// Exit-Code 1 bei Verstoessen, sonst 0 - damit auch in CI nutzbar.
//
// Hintergrund: Supabase aendert die Data-API-Defaults (neue Projekte ab
// 30.05.2026, bestehende ab 30.10.2026). Siehe supabase/migrations/_TEMPLATE.sql.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMigration } from "../lib/migrations/grantConvention.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const violations = [];
let checked = 0;
let templates = 0;
let grandfathered = 0;

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const result = checkMigration(file, sql);
  if (result.skipped) {
    if (result.reason === "grandfathered") grandfathered += 1;
    else templates += 1;
    continue;
  }
  checked += 1;
  if (!result.ok) {
    violations.push(result);
  }
}

if (violations.length > 0) {
  console.error("\n  GRANT/RLS-Convention verletzt:\n");
  for (const v of violations) {
    const probleme = [];
    if (v.missingGrant) probleme.push("kein 'grant ... to service_role'");
    if (v.missingRls) probleme.push("kein 'enable row level security'");
    console.error(`  ✗ ${v.file}`);
    console.error(`    legt Tabelle(n) an: ${v.createdTables.join(", ")}`);
    console.error(`    fehlt: ${probleme.join(" + ")}`);
  }
  console.error(
    "\n  Block aus supabase/migrations/_TEMPLATE.sql kopieren und anpassen.\n",
  );
  process.exit(1);
}

console.log(
  `check:migrations ok - ${checked} Migration(en) geprueft, ` +
    `${grandfathered} pre-Convention grandfathered, ${templates} Vorlage(n) uebersprungen.`,
);
