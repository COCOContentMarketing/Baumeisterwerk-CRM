-- View: companies_with_rollup
-- ----------------------------------------------------------------
-- Liefert alle companies-Spalten plus effective_last_interaction_at.
-- Fuer Dach-/Gruppen-Companies (is_group=true bzw. Eintraege mit
-- Children) rollt der Wert das spaeteste last_interaction_at ueber alle
-- Children-Standorte hoch. So zeigt die Companies-Liste auch dann ein
-- aktuelles Datum auf der Dach-Company, wenn die Interaktion an einem
-- einzelnen Standort stattfand.
--
-- greatest() ignoriert NULL-Argumente: fuer Companies ohne Children
-- liefert die Subquery NULL, und greatest(own, NULL) = own. Die View
-- funktioniert damit uniform fuer Gruppen wie fuer normale Companies.
--
-- Kein redundantes Persistieren: der Rollup wird bei jedem Read frisch
-- berechnet. lib/db/queries.ts:listCompanies() liest aus dieser View.
-- TS-Twin der Logik: lib/db/companyRollup.ts (fuer Unit-Tests).
--
-- Idempotent via CREATE OR REPLACE VIEW.

create or replace view companies_with_rollup as
select
  c.*,
  greatest(
    c.last_interaction_at,
    (
      select max(child.last_interaction_at)
        from companies child
       where child.parent_company_id = c.id
    )
  ) as effective_last_interaction_at
from companies c;
