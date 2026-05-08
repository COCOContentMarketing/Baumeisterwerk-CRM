-- Email-Templates: wiederverwendbare Vorlagen, die Claude als Basis fuer
-- generierte Drafts nutzt (z.B. "Anschreiben_Makler_Erstkontakt").

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references app_user(id) on delete cascade,
  name text not null unique,
  language contact_language not null default 'de',
  -- Verwendungszweck: bestimmt, welche Cadence-Phase / welcher Company-Type
  -- diese Vorlage triggert.
  use_case text not null,
  target_company_type company_type,
  subject_template text,
  body_template text not null,
  -- Hinweise fuer Claude: was beim Anpassen zu beachten ist.
  ai_guidance text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_templates_use_case_idx on email_templates(use_case);
create index if not exists email_templates_company_type_idx on email_templates(target_company_type);

drop trigger if exists trg_email_templates_updated on email_templates;
create trigger trg_email_templates_updated before update on email_templates
  for each row execute function set_updated_at();

-- Tageszusammenfassungs-Konfiguration auf User-Level.
alter table app_user
  add column if not exists digest_email text,
  add column if not exists digest_enabled boolean not null default true,
  add column if not exists digest_last_sent_at timestamptz,
  add column if not exists digest_timezone text not null default 'Europe/Berlin';

-- Standard-Wert: Wenn keine separate Adresse hinterlegt ist, geht der
-- Digest an die Hauptmail des Users.
update app_user set digest_email = email where digest_email is null;
