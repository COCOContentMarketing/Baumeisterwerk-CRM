-- ============================================================
-- DIAGNOSE-SKRIPT: GRANT- und RLS-Status aller public-Relationen
-- ============================================================
--
-- ZWECK
-- Zeigt fuer jede Tabelle/View im public-Schema, ob Row Level Security
-- aktiviert ist, wie viele Policies existieren und welche Data-API-Rollen
-- (anon / authenticated / service_role) welche Rechte haben.
--
-- WICHTIG
-- Dieses Skript fuehrt KEINE Aenderungen aus - ausschliesslich SELECTs.
-- Es wird NICHT von `supabase db push` ausgefuehrt (liegt bewusst in
-- supabase/scripts/, nicht in supabase/migrations/).
--
-- VERWENDUNG
-- Im Supabase SQL-Editor ausfuehren. Die Spalte "status" markiert
-- Relationen, die nach der GRANT/RLS-Convention Aufmerksamkeit brauchen.
--
-- HINTERGRUND
-- Supabase aendert die Data-API-Defaults (neue Projekte ab 30.05.2026,
-- bestehende ab 30.10.2026). Siehe supabase/migrations/_TEMPLATE.sql.
--
-- ============================================================
-- ABSCHNITT 1: Uebersicht RLS + Policy-Anzahl + Grants je Relation
-- ============================================================
-- Dynamisch ueber pg_catalog - listet automatisch ALLE aktuellen
-- public-Relationen, kein Hardcoding einer Tabellenliste.

with relations as (
  select
    c.oid,
    c.relname                              as relation,
    case c.relkind when 'r' then 'table'
                   when 'v' then 'view'
                   when 'm' then 'matview'
                   else c.relkind::text end as kind,
    c.relrowsecurity                       as rls_enabled,
    c.relforcerowsecurity                  as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'v', 'm')
),
policy_counts as (
  select schemaname, tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
),
grants as (
  select
    table_name,
    string_agg(distinct grantee || ':' || privilege_type, ', ' order by grantee || ':' || privilege_type)
      filter (where grantee in ('anon', 'authenticated', 'service_role')) as api_grants,
    bool_or(grantee = 'service_role')   as has_service_role,
    bool_or(grantee = 'anon')           as has_anon,
    bool_or(grantee = 'authenticated')  as has_authenticated
  from information_schema.role_table_grants
  where table_schema = 'public'
  group by table_name
)
select
  r.relation,
  r.kind,
  r.rls_enabled,
  coalesce(p.policy_count, 0)                       as policies,
  coalesce(g.api_grants, '(keine)')                 as api_grants,
  case
    when r.kind = 'table' and not r.rls_enabled
      then 'WARN: RLS aus'
    when r.kind = 'table' and not coalesce(g.has_service_role, false)
      then 'WARN: kein service_role-GRANT'
    when r.kind = 'table'
         and (coalesce(g.has_anon, false) or coalesce(g.has_authenticated, false))
         and coalesce(p.policy_count, 0) = 0
      then 'WARN: anon/authenticated-GRANT ohne Policy'
    else 'ok'
  end                                               as status
from relations r
left join policy_counts p
  on p.tablename = r.relation
left join grants g
  on g.table_name = r.relation
order by
  (case when r.kind = 'table' then 0 else 1 end),
  r.relation;

-- ============================================================
-- ABSCHNITT 2: Detail-Grants (eine Zeile pro Rolle/Privileg)
-- ============================================================
-- Fuer die genaue Analyse einzelner Relationen.

-- select table_name, grantee, privilege_type, is_grantable
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and grantee in ('anon', 'authenticated', 'service_role')
--  order by table_name, grantee, privilege_type;

-- ============================================================
-- ABSCHNITT 3: Policy-Details
-- ============================================================

-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   from pg_policies
--  where schemaname = 'public'
--  order by tablename, policyname;
