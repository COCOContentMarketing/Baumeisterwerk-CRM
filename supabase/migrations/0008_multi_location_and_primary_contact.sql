-- Multi-Location-Unternehmen + Single-Primary-Contact pro Standort
-- ----------------------------------------------------------------
-- A) Standorte sind eigene companies-Zeilen, ueber parent_company_id mit
--    einem Dach-/Gruppen-Eintrag verbunden (is_group=true).
-- B) Kontakte koennen mehreren Standorten zugeordnet werden via neuer
--    Tabelle contact_company_links (n:m).
-- C) Pro Standort darf hoechstens EIN primaerer Kontakt existieren.
--    Durchgesetzt via:
--      1. Partial-Unique-Index  contact_company_links_one_primary_idx
--         on contact_company_links(company_id) where is_primary=true
--      2. BEFORE INSERT/UPDATE Trigger set_single_primary_per_company
--         der bei is_primary=true alle anderen Primaries der Company
--         atomar auf false setzt (Toggle-Verhalten fuer die UI).
--
-- Datenmigration:
-- Jede bestehende (contacts.id, contacts.company_id)-Zeile wird als Link
-- gespiegelt (is_primary=false). Anschliessend wird pro company der
-- aelteste contacts-Eintrag mit is_primary=true zum Link-Primary
-- befoerdert (alle weiteren bleiben false). Die alte Spalte
-- contacts.is_primary wird NICHT gedroppt - sie ist nur noch als
-- deprecated markiert. Die Quelle der Wahrheit fuer "primaerer Kontakt
-- an Standort X" ist ab sofort contact_company_links.is_primary.
--
-- Idempotent: alle Statements mit "if not exists" / "or replace".

-- ============================================================
-- A) Multi-Location: Spalten + Constraint + Index auf companies
-- ============================================================

alter table companies
  add column if not exists parent_company_id uuid references companies(id) on delete set null,
  add column if not exists is_group boolean not null default false,
  add column if not exists location_label text;

-- Kein Self-Parent: idempotent via drop+add.
alter table companies drop constraint if exists companies_no_self_parent;
alter table companies add constraint companies_no_self_parent
  check (parent_company_id is null or parent_company_id <> id);

create index if not exists companies_parent_company_id_idx
  on companies(parent_company_id);

-- ============================================================
-- B) contact_company_links: n:m Kontakt <-> Standort
-- ============================================================

create table if not exists contact_company_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  is_primary boolean not null default false,
  role text,
  owner_id uuid references app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, company_id)
);

-- C) Single-Primary-Constraint per Standort.
create unique index if not exists contact_company_links_one_primary_idx
  on contact_company_links(company_id)
  where is_primary = true;

create index if not exists contact_company_links_contact_idx
  on contact_company_links(contact_id);
create index if not exists contact_company_links_company_idx
  on contact_company_links(company_id);

drop trigger if exists trg_contact_company_links_updated on contact_company_links;
create trigger trg_contact_company_links_updated
  before update on contact_company_links
  for each row execute function set_updated_at();

-- ============================================================
-- C) Trigger: bei is_primary=true alle anderen Primaries derselben
--    Company atomar demoten. Verhindert Race Conditions in der UI
--    und macht den Partial-Unique-Index zum Sicherheitsnetz.
-- ============================================================

create or replace function set_single_primary_per_company()
returns trigger as $$
begin
  if new.is_primary is true then
    update contact_company_links
       set is_primary = false
     where company_id = new.company_id
       and id is distinct from new.id
       and is_primary = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contact_company_links_single_primary on contact_company_links;
create trigger trg_contact_company_links_single_primary
  before insert or update of is_primary on contact_company_links
  for each row execute function set_single_primary_per_company();

-- ============================================================
-- Datenmigration: bestehende contacts -> Links
-- ============================================================
-- Schritt 1: Fuer jeden bestehenden Kontakt einen Link auf seine
-- Anker-Company spiegeln (default is_primary=false). idempotent via
-- ON CONFLICT auf (contact_id, company_id).
insert into contact_company_links (contact_id, company_id, is_primary, role)
select c.id, c.company_id, false, c.role
  from contacts c
on conflict (contact_id, company_id) do nothing;

-- Schritt 2: Pro Company den aeltesten Kontakt mit altem
-- contacts.is_primary=true zum Link-Primary befoerdern. Bei mehreren
-- Primaries pro Company gewinnt der aelteste (created_at ASC). Alle
-- weiteren bleiben is_primary=false. Der Trigger feuert hier zwar,
-- demoted aber nur die jeweils anderen - der "Pick" pro Company ist
-- per DISTINCT ON deterministisch genau einer.
update contact_company_links l
   set is_primary = true
  from (
    select distinct on (c.company_id)
           c.id          as contact_id,
           c.company_id  as company_id
      from contacts c
     where c.is_primary = true
     order by c.company_id, c.created_at asc
  ) pick
 where l.contact_id = pick.contact_id
   and l.company_id = pick.company_id;

-- Schritt 3: contacts.is_primary als deprecated markieren. Werte werden
-- NICHT geloescht; sie sind aber ab dieser Migration nicht mehr Quelle
-- der Wahrheit. UI/Engine lesen ab sofort aus contact_company_links.
comment on column contacts.is_primary is
  'DEPRECATED - Quelle der Wahrheit ist contact_company_links.is_primary. Spalte bleibt vorerst erhalten fuer Backward-Compat; spaeter ggf. Drop in einer eigenen Migration.';
