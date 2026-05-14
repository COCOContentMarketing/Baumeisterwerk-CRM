-- ============================================================
-- DIAGNOSE-SKRIPT: Kandidaten fuer Multi-Location-Gruppen finden
-- ============================================================
--
-- ZWECK
-- Findet bestehende companies-Zeilen, die nach Namens-Pattern zu derselben
-- Dach-Marke gehoeren koennten (z.B. mehrere "Engel & Voelkers ..."-Eintraege
-- mit unterschiedlichen Standort-Suffixen) und schlaegt vor, sie ueber
-- parent_company_id zu einer Gruppe zu verbinden.
--
-- WICHTIG
-- Dieses Skript fuehrt KEINE Aenderungen aus. Es enthaelt ausschliesslich
-- SELECT-Abfragen. Es wird NICHT von `supabase db push` ausgefuehrt (liegt
-- bewusst in supabase/scripts/, nicht in supabase/migrations/).
--
-- VORGEHEN
--   1. Abschnitt 1 ausfuehren -> Namens-Cluster sichten.
--   2. Pro Cluster manuell entscheiden:
--        a) Welcher Eintrag ist die Dach-Company? Oder muss eine neue
--           Gruppen-Company angelegt werden?
--        b) Welche Eintraege sind Standorte (-> parent_company_id setzen)?
--   3. Abschnitt 2 (auskommentierte UPDATE-Vorlagen) als Blaupause nehmen,
--      mit echten UUIDs fuellen und EINZELN, GEPRUEFT ausfuehren.
--   4. Abschnitt 3 zur Kontrolle nach den Updates laufen lassen.
--
-- ============================================================
-- ABSCHNITT 1: Namens-Cluster (potentielle Gruppen)
-- ============================================================
-- Stamm-Extraktion: alles ab dem ersten Komma / Gedankenstrich / Bindestrich
-- sowie typische Rechtsform-Suffixe werden abgeschnitten. Das ist eine grobe
-- Heuristik - die Ergebnisse MUESSEN manuell geprueft werden.

with normalized as (
  select
    id,
    name,
    city,
    parent_company_id,
    is_group,
    trim(
      regexp_replace(
        name,
        '\s*([,–—-].*$)|(\s+(GmbH|AG|KG|UG|mbH|e\.K\.|OHG|GbR|& Co\.? ?KG?).*$)',
        '',
        'i'
      )
    ) as stem
  from companies
)
select
  stem,
  count(*)                              as anzahl,
  bool_or(is_group)                     as hat_schon_gruppe,
  count(*) filter (where parent_company_id is not null) as schon_zugeordnet,
  array_agg(name order by name)         as companies,
  array_agg(id   order by name)         as ids,
  array_agg(coalesce(city, '?') order by name) as staedte
from normalized
where length(stem) >= 3            -- zu kurze Stems (Rauschen) ausblenden
group by stem
having count(*) > 1                -- nur echte Cluster
order by count(*) desc, stem;

-- ============================================================
-- ABSCHNITT 2: UPDATE-VORLAGEN (auskommentiert - NICHT automatisch!)
-- ============================================================
-- Variante A: ein bestehender Eintrag wird zur Dach-Company.
--   Schritt 1 - Dach-Company markieren:
-- update companies
--    set is_group = true
--  where id = '<DACH_COMPANY_UUID>';
--
--   Schritt 2 - Standorte unterordnen + optional Standort-Label setzen:
-- update companies
--    set parent_company_id = '<DACH_COMPANY_UUID>',
--        location_label     = '<z.B. München>'
--  where id = '<STANDORT_UUID>';
--
-- Variante B: es gibt keine sinnvolle Dach-Company -> neue anlegen.
-- insert into companies (name, type, status, priority, is_group)
-- values ('<Markenname>', 'sonstige', 'lead', 'mittel', true)
-- returning id;
--   ... danach die Standorte wie in Variante A, Schritt 2 unterordnen.
--
-- HINWEIS: Der CHECK companies_no_self_parent verhindert parent = id.
-- Der App-Helper createLocation() macht Variante A automatisch - dieses
-- Skript ist fuer den einmaligen Bestands-Backfill gedacht.

-- ============================================================
-- ABSCHNITT 3: KONTROLLE nach den manuellen Updates
-- ============================================================
-- Zeigt alle Gruppen mit ihren Standorten - nach dem Backfill ausfuehren.

-- select
--   g.id            as gruppe_id,
--   g.name          as gruppe,
--   s.id            as standort_id,
--   s.name          as standort,
--   s.location_label,
--   s.city
-- from companies g
-- left join companies s on s.parent_company_id = g.id
-- where g.is_group = true
-- order by g.name, s.name;
