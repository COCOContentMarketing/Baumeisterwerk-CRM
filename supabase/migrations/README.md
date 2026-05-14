# Migrationen

Schema- und Daten-Änderungen an der Supabase-Datenbank. Die Dateien hier
sind die Quelle der Wahrheit für das DB-Schema.

## 1. Wann eine Migration?

Eine neue Migration anlegen für:

- neue Tabelle, Spalte, Index, View, Constraint, Trigger, Function
- Änderung an bestehendem Schema (Spalte umbenennen, Typ ändern, …)
- Daten-Backfill (z.B. Bestandsdaten korrigieren)

**Keine** Migration für: rein lesende Diagnose-Abfragen → die gehören nach
`supabase/scripts/` (werden nicht automatisch ausgeführt).

## 2. Dateiname-Konvention

```
NNNN_kurzbeschreibung.sql
```

- `NNNN` = 4-stellig, fortlaufend (`0012`, `0013`, …) — höchste vorhandene
  Nummer + 1.
- `kurzbeschreibung` = snake_case, knapp (`add_company_tags`,
  `backfill_reco_umlauts`).
- Dateien mit `_`-Präfix (z.B. `_TEMPLATE.sql`) werden von Supabase **nicht**
  ausgeführt — reserviert für Vorlagen.

## 3. Idempotenz-Regel

Jede Migration muss gefahrlos mehrfach laufen können:

- Tabellen/Spalten/Indizes: `create … if not exists`,
  `add column if not exists`
- Views/Functions: `create or replace`
- Constraints/Trigger: `drop … if exists` + danach neu anlegen
- Backfill-`UPDATE`s: so formulieren, dass ein zweiter Lauf ein No-Op ist
  (z.B. `replace()`-Ketten, `where`-Guard auf noch-nicht-migrierte Zeilen)

## 4. GRANT + RLS-Pflicht für neue public-Tabellen

**Jede `CREATE TABLE` im `public`-Schema braucht einen GRANT- und
RLS-Block.** Hintergrund: Supabase ändert die Data-API-Defaults
(neue Projekte ab 30.05.2026, bestehende ab 30.10.2026) — neu angelegte
public-Tabellen sind dann nicht mehr automatisch über supabase-js / REST /
GraphQL erreichbar.

➡️ **Vorlage kopieren aus [`_TEMPLATE.sql`](./_TEMPLATE.sql).**

Minimal pro neuer Tabelle:

```sql
grant all on public.<name> to service_role;
alter table public.<name> enable row level security;
```

`anon`/`authenticated`-GRANTs + Policies nur ergänzen, wenn die Tabelle
bewusst über die Data API exponiert werden soll. Aktuell laufen alle
Business-Daten ausschließlich über den `service_role`-Client
(`lib/supabase/admin.ts`), der RLS umgeht.

Prüfen lässt sich der Ist-Zustand mit
[`../scripts/audit_grants.sql`](../scripts/audit_grants.sql).

Lokaler Check vor dem Commit:

```sh
npm run check:migrations
```

warnt, wenn eine Migration `create table public.…` ohne GRANT-/RLS-Block
enthält. Die Migrationen `0001`, `0002` und `0008` stammen aus der Zeit vor
dieser Convention, sind bereits angewandt und dürfen nicht nachträglich
editiert werden — sie sind im Check explizit *grandfathered*. Ihre
fehlenden GRANTs/RLS macht `audit_grants.sql` sichtbar; ob sie per neuer
Migration nachgezogen werden, ist eine separate Entscheidung. Die
Convention gilt ab der nächsten neuen Migration (`0012+`).

## 5. Migration anwenden

**Variante A — Supabase SQL-Editor (Production):**

1. Supabase-Dashboard → SQL Editor → New query
2. Inhalt der `NNNN_*.sql` einfügen
3. *Run* — bei Erfolg ist die Migration angewandt
4. Verifizieren (z.B. `audit_grants.sql` oder ein gezieltes `select`)

**Variante B — Supabase CLI (lokal/CI):**

```sh
supabase db push
```

wendet alle noch nicht angewandten Migrationen in `NNNN`-Reihenfolge an.

> Reihenfolge zählt: Migrationen werden strikt nach Dateiname sortiert
> ausgeführt. Niemals eine bereits angewandte Migration nachträglich
> editieren — stattdessen eine neue Migration mit der Korrektur anlegen.
