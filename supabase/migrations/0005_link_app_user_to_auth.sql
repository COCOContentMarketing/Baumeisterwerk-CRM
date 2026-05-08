-- Verknuepft den (Single-User-) app_user-Eintrag mit dem Supabase-Auth-User.
-- RLS-Policies werden in einer Folge-Migration auf
--   USING (auth.uid() = app_user.auth_user_id)
-- umgestellt - hier zunaechst nur die Spalte und das Email-Match-Linking.

alter table app_user
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- UNIQUE-Constraint nachziehen (idempotent ueber unique-index).
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'app_user_auth_user_id_key'
  ) then
    create unique index app_user_auth_user_id_key on app_user(auth_user_id) where auth_user_id is not null;
  end if;
end $$;

-- Bestehende app_user-Eintraege per Email-Match mit auth.users verknuepfen.
-- Achtung: app_user.email ist case-sensitive, auth.users.email auch.
-- Wir matchen tolerant per lower().
update app_user a
set auth_user_id = u.id
from auth.users u
where a.auth_user_id is null
  and lower(a.email) = lower(u.email);
