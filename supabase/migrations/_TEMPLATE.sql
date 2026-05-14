-- ============================================================
-- MIGRATION-TEMPLATE fuer neue public-Tabellen
-- ============================================================
-- Diese Datei ist KEINE Migration: das Underscore-Praefix sorgt dafuer,
-- dass Supabase sie nicht ausfuehrt. Sie ist eine Kopiervorlage.
--
-- KOPIERE DEN BLOCK UNTEN, wenn du eine neue Tabelle im public-Schema
-- anlegst, und passe <name> sowie die Spalten an.
--
-- HINTERGRUND - warum der GRANT-Block Pflicht ist:
-- Supabase aendert die Default-Berechtigungen der Data API:
--   - neue Projekte:      ab 30.05.2026
--   - bestehende Projekte: ab 30.10.2026
-- Ab dann sind neu angelegte public-Tabellen NICHT mehr automatisch
-- ueber die Data API (supabase-js / REST / GraphQL) erreichbar - es
-- braucht explizite GRANTs. Damit das nicht spaeter ueberraschend auf
-- der Live-DB auftritt, bekommt ab sofort JEDE CREATE-TABLE-Migration
-- einen GRANT- + RLS-Block.
--
-- SICHERHEITS-MODELL DIESES PROJEKTS:
-- Alle Business-Daten laufen serverseitig ueber den service_role-Client
-- (lib/supabase/admin.ts). service_role umgeht RLS vollstaendig. Die
-- anon/authenticated-Rollen werden hier nur fuer Auth verwendet, nicht
-- fuer Data-API-Queries auf Business-Tabellen. Deshalb ist der
-- Default-Block unten "service-role-only": RLS an, kein Zugriff fuer
-- anon/authenticated. Wenn eine Tabelle bewusst ueber die Data API
-- exponiert werden soll, kommentiere die entsprechenden Zeilen ein UND
-- ergaenze passende Policies.
-- ============================================================

-- ----- BLOCK START: kopieren ab hier -----------------------------------

create table if not exists public.<name> (
  id uuid primary key default gen_random_uuid(),
  -- ... fachliche Spalten ...
  owner_id uuid references app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indizes: haeufige Filter-/Join-Spalten indizieren.
create index if not exists <name>_owner_id_idx on public.<name>(owner_id);

-- updated_at-Trigger (set_updated_at() wird in 0001_init.sql definiert).
drop trigger if exists trg_<name>_updated on public.<name>;
create trigger trg_<name>_updated
  before update on public.<name>
  for each row execute function set_updated_at();

-- ----- GRANTS -----------------------------------------------------------
-- Pflicht: service_role muss explizit Zugriff bekommen (der App-Client).
grant all on public.<name> to service_role;

-- Optional: nur einkommentieren, wenn die Tabelle bewusst ueber die
-- Data API mit Anon-/User-Keys erreichbar sein soll. Dann unten auch
-- passende Policies ergaenzen, sonst ist die Tabelle trotz GRANT durch
-- RLS gesperrt.
-- grant select on public.<name> to anon;
-- grant select, insert, update, delete on public.<name> to authenticated;

-- ----- ROW LEVEL SECURITY ----------------------------------------------
-- RLS immer aktivieren: damit ist die Tabelle auch dann nicht offen,
-- wenn sie versehentlich ueber einen Anon-/User-Key erreicht wird.
-- service_role umgeht RLS ohnehin - die App funktioniert also weiter.
alter table public.<name> enable row level security;

-- Default: KEINE Policy fuer anon/authenticated => nur service_role
-- kommt durch. Das deckt den aktuellen Stand dieses Projekts ab.
--
-- Wenn die Tabelle ueber die Data API exponiert wird, hier passende
-- Policies ergaenzen, z.B. eine owner-basierte Policy:
--
-- create policy "<name>_owner_select" on public.<name>
--   for select to authenticated
--   using (owner_id = (select id from app_user where auth_user_id = auth.uid()));
--
-- create policy "<name>_owner_modify" on public.<name>
--   for all to authenticated
--   using (owner_id = (select id from app_user where auth_user_id = auth.uid()))
--   with check (owner_id = (select id from app_user where auth_user_id = auth.uid()));

-- ----- SEQUENZEN (nur falls serial/bigserial statt uuid genutzt wird) ---
-- Bei identity/serial-Spalten braucht authenticated zusaetzlich USAGE auf
-- die Sequenz, sonst schlagen Inserts fehl:
-- grant usage, select on sequence public.<name>_id_seq to authenticated;

-- ----- BLOCK ENDE: kopieren bis hier -----------------------------------
