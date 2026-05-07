-- Beispiel-Seed (optional, fuer lokale Entwicklung)
insert into app_user (email, display_name, signature)
values (
  'me@baumeisterwerk.de',
  'Baumeisterwerk',
  E'Mit besten Gruessen\nBaumeisterwerk\nhttps://baumeisterwerk.de'
)
on conflict (email) do nothing;
