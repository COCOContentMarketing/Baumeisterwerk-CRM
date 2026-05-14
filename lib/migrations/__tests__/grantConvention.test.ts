import { describe, it, expect } from "vitest";
import {
  stripSqlComments,
  findCreatedTables,
  hasServiceRoleGrant,
  hasRlsEnabled,
  checkMigration,
  GRANDFATHERED,
} from "../grantConvention.mjs";

describe("stripSqlComments", () => {
  it("entfernt Zeilenkommentare", () => {
    expect(stripSqlComments("select 1; -- ein Kommentar\nselect 2;")).toBe(
      "select 1; \nselect 2;",
    );
  });

  it("entfernt Blockkommentare", () => {
    expect(stripSqlComments("a /* block\nkommentar */ b")).toBe("a  b");
  });
});

describe("findCreatedTables", () => {
  it("findet einfache CREATE TABLE", () => {
    expect(findCreatedTables("create table foo (id uuid);")).toEqual(["foo"]);
  });

  it("toleriert 'if not exists' und public-Praefix", () => {
    expect(
      findCreatedTables('create table if not exists public."bar" (id uuid);'),
    ).toEqual(["bar"]);
  });

  it("findet mehrere Tabellen", () => {
    const sql = "create table a (id uuid);\ncreate table public.b (id uuid);";
    expect(findCreatedTables(sql)).toEqual(["a", "b"]);
  });

  it("ignoriert auskommentierte CREATE TABLE", () => {
    expect(findCreatedTables("-- create table ghost (id uuid);")).toEqual([]);
    expect(findCreatedTables("/* create table ghost (id uuid); */")).toEqual([]);
  });

  it("liefert leere Liste, wenn keine Tabelle angelegt wird", () => {
    expect(findCreatedTables("alter table foo add column x int;")).toEqual([]);
  });
});

describe("hasServiceRoleGrant / hasRlsEnabled", () => {
  it("erkennt service_role-GRANT", () => {
    expect(hasServiceRoleGrant("grant all on public.foo to service_role;")).toBe(true);
  });

  it("ignoriert auskommentierten GRANT", () => {
    expect(hasServiceRoleGrant("-- grant all on public.foo to service_role;")).toBe(false);
  });

  it("erkennt RLS-Aktivierung", () => {
    expect(hasRlsEnabled("alter table foo enable row level security;")).toBe(true);
  });

  it("ignoriert auskommentierte RLS-Zeile", () => {
    expect(hasRlsEnabled("-- alter table foo enable row level security;")).toBe(false);
  });
});

describe("checkMigration", () => {
  const goodSql = `
    create table if not exists public.widgets (id uuid primary key);
    grant all on public.widgets to service_role;
    alter table public.widgets enable row level security;
  `;

  it("akzeptiert eine vollstaendige Migration", () => {
    const r = checkMigration("0012_add_widgets.sql", goodSql);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(false);
    expect(r.createdTables).toEqual(["widgets"]);
  });

  it("meldet fehlenden GRANT", () => {
    const sql = `
      create table public.widgets (id uuid primary key);
      alter table public.widgets enable row level security;
    `;
    const r = checkMigration("0012_add_widgets.sql", sql);
    expect(r.ok).toBe(false);
    expect(r.missingGrant).toBe(true);
    expect(r.missingRls).toBe(false);
  });

  it("meldet fehlende RLS-Aktivierung", () => {
    const sql = `
      create table public.widgets (id uuid primary key);
      grant all on public.widgets to service_role;
    `;
    const r = checkMigration("0012_add_widgets.sql", sql);
    expect(r.ok).toBe(false);
    expect(r.missingGrant).toBe(false);
    expect(r.missingRls).toBe(true);
  });

  it("meldet beide Verstoesse", () => {
    const r = checkMigration("0012_add_widgets.sql", "create table public.widgets (id uuid);");
    expect(r.ok).toBe(false);
    expect(r.missingGrant).toBe(true);
    expect(r.missingRls).toBe(true);
  });

  it("ist ok fuer Migrationen ohne CREATE TABLE (z.B. nur ALTER/Backfill)", () => {
    const r = checkMigration("0013_backfill.sql", "update foo set x = 1 where x is null;");
    expect(r.ok).toBe(true);
    expect(r.createdTables).toEqual([]);
  });

  it("ueberspringt Vorlagen mit Underscore-Praefix", () => {
    const r = checkMigration("_TEMPLATE.sql", "create table public.<name> (id uuid);");
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("ueberspringt Vorlagen auch bei vollem Pfad", () => {
    const r = checkMigration("supabase/migrations/_TEMPLATE.sql", "create table x (id uuid);");
    expect(r.skipped).toBe(true);
  });

  it("auskommentierter GRANT erfuellt die Convention NICHT", () => {
    const sql = `
      create table public.widgets (id uuid primary key);
      -- grant all on public.widgets to service_role;
      alter table public.widgets enable row level security;
    `;
    const r = checkMigration("0012_add_widgets.sql", sql);
    expect(r.ok).toBe(false);
    expect(r.missingGrant).toBe(true);
  });

  it("grandfathered pre-Convention-Migrationen werden uebersprungen", () => {
    // 0001 legt Tabellen ohne GRANT/RLS an - darf den Check nicht roten.
    const r = checkMigration("0001_init.sql", "create table public.app_user (id uuid);");
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe("grandfathered");
    expect(r.ok).toBe(true);
  });

  it("grandfathered greift auch bei vollem Pfad", () => {
    const r = checkMigration(
      "supabase/migrations/0008_multi_location_and_primary_contact.sql",
      "create table public.contact_company_links (id uuid);",
    );
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe("grandfathered");
  });

  it("eine NEUE Migration mit hoher Nummer wird NICHT grandfathered", () => {
    const r = checkMigration("0012_add_widgets.sql", "create table public.widgets (id uuid);");
    expect(r.skipped).toBe(false);
    expect(r.ok).toBe(false);
  });
});

describe("GRANDFATHERED", () => {
  it("enthaelt genau die drei bekannten pre-Convention-Migrationen mit CREATE TABLE", () => {
    expect(GRANDFATHERED).toEqual(
      new Set([
        "0001_init.sql",
        "0002_templates_and_digest.sql",
        "0008_multi_location_and_primary_contact.sql",
      ]),
    );
  });
});
