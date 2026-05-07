-- Baumeisterwerk CRM: Initial schema
-- Single-user setup; we keep an owner_id column ready for later multi-user.

create extension if not exists "pgcrypto";

-- Owner / user (one row in single-user mode)
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  signature text,
  gmail_refresh_token text,
  gmail_account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Companies (Zielunternehmen)
create type company_type as enum (
  'interior_designer',
  'handwerker',
  'hotel',
  'makler',
  'relocation',
  'architekt',
  'sonstige'
);

create type company_status as enum (
  'lead',
  'kontaktiert',
  'in_gespraech',
  'kunde',
  'pausiert',
  'verloren'
);

create type priority_level as enum ('niedrig', 'mittel', 'hoch');

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references app_user(id) on delete cascade,
  name text not null,
  type company_type not null default 'sonstige',
  status company_status not null default 'lead',
  priority priority_level not null default 'mittel',
  website text,
  address text,
  city text,
  country text default 'DE',
  notes text,
  tags text[] default '{}',
  last_interaction_at timestamptz,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_status_idx on companies(status);
create index if not exists companies_type_idx on companies(type);
create index if not exists companies_next_action_idx on companies(next_action_at);

-- Contacts (Personen pro Unternehmen)
create type contact_language as enum ('de', 'en');

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  owner_id uuid references app_user(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text generated always as (
    trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) stored,
  role text,
  email text,
  phone text,
  language contact_language not null default 'de',
  linkedin_url text,
  notes text,
  is_primary boolean not null default false,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_company_idx on contacts(company_id);
create index if not exists contacts_email_idx on contacts(email);

-- Interactions: Timeline-Eintraege (Email, Anruf, Termin, Notiz)
create type interaction_type as enum (
  'email_sent',
  'email_received',
  'email_draft',
  'call',
  'meeting',
  'note',
  'task_done'
);

create type interaction_direction as enum ('outbound', 'inbound', 'internal');

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references app_user(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  type interaction_type not null,
  direction interaction_direction not null default 'outbound',
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  -- Gmail-Verknuepfung
  gmail_message_id text,
  gmail_thread_id text,
  gmail_draft_id text,
  -- Free-form metadata (e.g. Anruf-Dauer, Teilnehmer)
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists interactions_company_idx on interactions(company_id, occurred_at desc);
create index if not exists interactions_contact_idx on interactions(contact_id, occurred_at desc);
create index if not exists interactions_gmail_msg_idx on interactions(gmail_message_id);

-- Recommendations: Proaktive Vorschlaege vom Tool
create type recommendation_kind as enum ('email', 'call', 'meeting', 'follow_up', 'research');
create type recommendation_status as enum ('offen', 'erledigt', 'verworfen', 'aufgeschoben');

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references app_user(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  kind recommendation_kind not null,
  status recommendation_status not null default 'offen',
  priority priority_level not null default 'mittel',
  title text not null,
  reason text,
  due_at timestamptz,
  -- KI-Output
  draft_subject text,
  draft_body text,
  call_briefing text,
  ai_model text,
  ai_generated_at timestamptz,
  -- Verknuepfungen nach Ausfuehrung
  resulting_interaction_id uuid references interactions(id) on delete set null,
  gmail_draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recommendations_status_idx on recommendations(status, due_at);
create index if not exists recommendations_company_idx on recommendations(company_id);
create index if not exists recommendations_contact_idx on recommendations(contact_id);

-- Updated-At Trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_updated on companies;
create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();

drop trigger if exists trg_contacts_updated on contacts;
create trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

drop trigger if exists trg_recommendations_updated on recommendations;
create trigger trg_recommendations_updated before update on recommendations
  for each row execute function set_updated_at();

drop trigger if exists trg_app_user_updated on app_user;
create trigger trg_app_user_updated before update on app_user
  for each row execute function set_updated_at();

-- Auto-update last_interaction_at auf Company / Contact bei neuem Interaction-Eintrag
create or replace function bump_last_interaction()
returns trigger as $$
begin
  update companies set last_interaction_at = new.occurred_at
    where id = new.company_id and (last_interaction_at is null or last_interaction_at < new.occurred_at);
  if new.contact_id is not null then
    update contacts set last_interaction_at = new.occurred_at
      where id = new.contact_id and (last_interaction_at is null or last_interaction_at < new.occurred_at);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_interactions_bump on interactions;
create trigger trg_interactions_bump after insert on interactions
  for each row execute function bump_last_interaction();
