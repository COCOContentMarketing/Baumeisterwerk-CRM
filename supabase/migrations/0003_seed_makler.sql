-- Seed: Makler-Recherche Baumeisterwerk (Stand: Mai 2026)
-- Quellen: Recherche-Dokument "Makler_Recherche_Baumeisterwerk".
-- Aktion: Alle Eintraege werden als status='lead' angelegt mit
-- priority gemaess Recherche und einer initialen "email"-Recommendation
-- mit status='offen' (= "jetzt rausgehen").
--
-- Idempotent: insert ... on conflict do nothing waere ideal, aber wir haben
-- keinen UNIQUE-Index auf (name). Der Block prueft daher mit "if not exists"
-- pro Zeile.

-- ============================================================
-- Helper-Funktionen (nur fuer diesen Seed)
-- ============================================================

create or replace function _seed_company(
  p_name text,
  p_type company_type,
  p_priority priority_level,
  p_website text,
  p_address text,
  p_city text,
  p_country text,
  p_notes text,
  p_tags text[]
) returns uuid as $$
declare
  v_id uuid;
begin
  select id into v_id from companies where name = p_name limit 1;
  if v_id is null then
    insert into companies (name, type, status, priority, website, address, city, country, notes, tags)
    values (p_name, p_type, 'lead', p_priority, p_website, p_address, p_city, p_country, p_notes, p_tags)
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql;

create or replace function _seed_contact(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_email text,
  p_phone text,
  p_is_primary boolean
) returns uuid as $$
declare
  v_company_id uuid;
  v_id uuid;
begin
  select id into v_company_id from companies where name = p_company_name limit 1;
  if v_company_id is null then
    raise notice 'Company not found, skipping contact: %', p_company_name;
    return null;
  end if;
  -- Primaerkontakt: nach (first_name, last_name) within company prueffen
  select id into v_id from contacts
    where company_id = v_company_id
      and coalesce(first_name,'') = coalesce(p_first_name,'')
      and coalesce(last_name,'')  = coalesce(p_last_name,'')
    limit 1;
  if v_id is null then
    insert into contacts (company_id, first_name, last_name, role, email, phone, is_primary)
    values (v_company_id, p_first_name, p_last_name, p_role, p_email, p_phone, p_is_primary)
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql;

-- ============================================================
-- App-User sicherstellen
-- ============================================================
do $$
declare
  v_owner uuid;
begin
  select id into v_owner from app_user order by created_at limit 1;
  if v_owner is null then
    insert into app_user (email, display_name, digest_email)
    values ('mb@baumeisterwerk.de', 'Martin Bauer', 'mb@baumeisterwerk.de')
    returning id into v_owner;
  else
    update app_user set digest_email = coalesce(digest_email, 'mb@baumeisterwerk.de') where id = v_owner;
  end if;
end $$;

-- ============================================================
-- Email-Templates
-- ============================================================
insert into email_templates (name, language, use_case, target_company_type, subject_template, body_template, ai_guidance) values
  ('anschreiben_makler_erstkontakt', 'de', 'erstkontakt', 'makler',
   'Kooperationsvorschlag fuer internationale Kundschaft – Baumeisterwerk',
   E'Sehr geehrte/r {{anrede}},\n\n' ||
   E'{{persoenlicher_hook_zum_makler}}\n\n' ||
   E'Mit Baumeisterwerk biete ich genau diese Antwort. Ich uebernehme Baubegleitung und Baumanagement fuer hochwertigen Innenausbau – vom ersten Briefing ueber die Auswahl von Interior Designern und Handwerkern bis zur kompletten Fertigstellung. Vollstaendig zweisprachig (DE/EN, siehe baumeisterwerk.de/en), unabhaengig vom Generalunternehmer und mit Pauschalhonorar statt HOAI.\n\n' ||
   E'Zu meinen Referenzen zaehlen die Renovierung von 65 Zimmern im Bayerischen Hof Muenchen, mehrere Projekte im Max-Palais sowie die komplette Neueinrichtung weiterer Top-Immobilien. Mit der Klientel, die Sie betreuen, und mit Projekten dieser Groessenordnung bin ich bestens vertraut.\n\n' ||
   E'{{individueller_mehrwert_fuer_diesen_makler}}\n\n' ||
   E'Sehr gerne stelle ich Ihnen Baumeisterwerk in einem persoenlichen Gespraech vor. Welche Woche wuerde Ihnen passen?\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk\nhttps://www.baumeisterwerk.de/en',
   'Aufbau: persoenlicher Hook zum Makler -> Kernpitch (Baubegleitung & Baumanagement, zweisprachig, unabhaengig, Pauschalhonorar) -> Referenzen (Bayerischer Hof, Max-Palais) -> konkreter Mehrwert fuer diesen Makler -> Einladung zum persoenlichen Gespraech. Laenge 220-250 Worte. ZWINGEND: 1) Hook muss konkret an Lagen, Klientel oder Geschichte des Maklers anknuepfen. 2) Mehrwert muss erklaeren, warum gerade dieser Makler von der Kooperation profitiert. 3) Ton: hoeflich-Sie, nicht werblich, Concierge-Selbstverstaendnis. 4) Notizen/Bemerkungen aus Company-Datensatz aktiv referenzieren.'),
  ('anschreiben_relocation_erstkontakt', 'de', 'erstkontakt', 'relocation',
   'Anschluss-Loesung fuer Ihre Relocation-Klientel: Baumeisterwerk',
   E'Sehr geehrte/r {{anrede}},\n\n{{hook_relocation_konkret}}\n\nMit Baumeisterwerk biete ich Baubegleitung und Baumanagement fuer hochwertigen Innenausbau – vollstaendig zweisprachig (DE/EN, siehe baumeisterwerk.de/en), unabhaengig vom Generalunternehmer, mit Pauschalhonorar statt HOAI. Referenzen u.a. Bayerischer Hof Muenchen (65 Zimmer), Max-Palais.\n\nFuer Ihre Klientel waere Baumeisterwerk eine englischsprachige, diskrete Adresse, an die Sie nach dem Wechsel von Mieten zu Eigentum guten Gewissens weiterempfehlen koennen.\n\nSehr gerne stelle ich mich Ihnen persoenlich vor.\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Hook auf das Relocation-spezifische Geschaeftsmodell (Mieten -> Kaufen -> Umbau).'),
  ('follow_up_1', 'de', 'follow_up_1', null,
   'Kurzes Nachhaken: Baumeisterwerk',
   E'Sehr geehrte/r {{anrede}},\n\nich melde mich kurz, weil mein letztes Schreiben moeglicherweise im Posteingang untergegangen ist.\n\n{{kurzer_neuer_mehrwert_oder_anlass}}\n\nFalls eine Kooperation gerade nicht passt, ist das auch eine Antwort, die mir hilft. Ansonsten freue ich mich auf einen kurzen Austausch.\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Maximal 120 Worte, hoeflich, kein Druck. Falls vorhanden: einen neuen, konkreten Anlass einflechten. Endet mit "auch ein Nein hilft mir".'),
  ('follow_up_2', 'de', 'follow_up_2', null,
   'Letzter Versuch zu einem Gespraech – Baumeisterwerk',
   E'Sehr geehrte/r {{anrede}},\n\ndas ist mein letzter Versuch zu einem Gespraech – mit dem expliziten Hinweis, dass ich Sie damit nicht weiter behelligen werde.\n\n{{eine_kernfrage_oder_konkretes_angebot}}\n\nWenn ich nichts hoere, lege ich den Vorgang ohne Groll zur Seite. Sollten Sie zu einem spaeteren Zeitpunkt einen Innenausbau-Partner suchen, melden Sie sich gerne jederzeit.\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Kurz, klar, verbindlich-respektvoll. Eine Kernfrage oder klar umrissenes Angebot.'),
  ('inbound_reply', 'de', 'inbound_reply', null,
   'Re: {{ursprungsbetreff}}',
   E'Sehr geehrte/r {{anrede}},\n\nvielen Dank fuer Ihre Nachricht.\n\n{{antwort_auf_konkrete_punkte}}\n\n{{naechster_schritt_vorschlag}}\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Bezug auf inhaltliche Punkte der Inbound-Mail. Konkreten naechsten Schritt vorschlagen.'),
  ('post_meeting_thanks', 'de', 'post_meeting_thanks', null,
   'Danke fuer das Gespraech',
   E'Sehr geehrte/r {{anrede}},\n\nherzlichen Dank fuer das Gespraech am {{termin_datum}}.\n\n{{kurzes_resuemee_und_naechster_schritt}}\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Innerhalb 48h. Kurzes Resuemee, naechsten Schritt verbindlich machen.'),
  ('post_meeting_follow_up', 'de', 'post_meeting_follow_up', null,
   'Naechste Schritte nach unserem Gespraech',
   E'Sehr geehrte/r {{anrede}},\n\n{{rueckbezug_auf_termin}}\n\n{{konkreter_naechster_schritt}}\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Nach 7 Tagen ohne Reaktion.'),
  ('kunde_touchbase', 'de', 'kunde_touchbase', null,
   'Kurzer Update-Impuls',
   E'Sehr geehrte/r {{anrede}},\n\nes ist ein paar Wochen her, daher ein kurzer Stand bei uns:\n\n{{news_oder_referenz_aktuell}}\n\nFalls bei Ihnen aktuell ein Projekt anliegt, fuer das ich passen koennte – jederzeit gerne.\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Pflegen, nicht verkaufen.'),
  ('re_engagement', 'de', 're_engagement', null,
   'Lange nichts gehoert – kurzer Reminder',
   E'Sehr geehrte/r {{anrede}},\n\nes ist eine Weile her seit meinem letzten Anschreiben. Ich habe Verstaendnis, wenn der Zeitpunkt damals nicht passte.\n\n{{neuer_anlass_referenz_oder_news}}\n\nFalls eine Erstvorstellung jetzt passt, freue ich mich.\n\nMit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
   'Nach 90+ Tagen Pause. Neuer Anlass. Kein Druck.')
on conflict (name) do nothing;

-- ============================================================
-- Companies + primaere Kontakte (Makler & Relocation)
-- ============================================================

-- 1. München & Stadtgebiet
select _seed_company('München Sotheby''s International Realty', 'makler', 'hoch',
  'https://muenchen-sothebysrealty.com',
  'Maximilianstraße 13', '80539 München', 'DE',
  E'Boutique-Standort an der Maximilianstrasse. Teil des globalen Sotheby''s-Netzwerks (1.115+ Niederlassungen). Mehrsprachig (DE/EN/FR/IT/ES/PL). Spezialisiert auf Luxusimmobilien Stadt + Voralpenland. TOP-PRIORITÄT. Internationale Klientel ist Kerngeschaeft.',
  array['top_prioritaet','muenchen','international','sotheby']);
select _seed_contact('München Sotheby''s International Realty', 'Michael', 'Reiss', 'Inhaber', 'muenchen@bayern-sothebysrealty.com', '+49 89 744 24 189 0', true);
select _seed_contact('München Sotheby''s International Realty', 'Theresa', null, 'Koordination', null, null, false);
select _seed_contact('München Sotheby''s International Realty', 'Alexander', 'Krainer', null, null, null, false);
select _seed_contact('München Sotheby''s International Realty', 'Marzena', 'Malowanczyk', null, null, null, false);
select _seed_contact('München Sotheby''s International Realty', 'Amei', 'Schlagintweit', null, null, null, false);
select _seed_contact('München Sotheby''s International Realty', 'Isabel', 'Frauenhofer', null, null, null, false);

select _seed_company('Engel & Völkers München Bogenhausen', 'makler', 'hoch',
  'https://engelvoelkers.com/de/de/shops/muenchen-bogenhausen',
  'Ismaninger Str. 78', '81675 München', 'DE',
  E'Seit 20+ Jahren in Muenchen. Premium-Wohnimmobilien Top-Lagen. Eigenes Mietteam (Coco Solberg) - relevant fuer Expat-Mieter. Internationales Netzwerk 1.000+ Standorte. TOP-PRIORITÄT. Bogenhausen-Shop deckt Herzstueck Premiumsegment ab.',
  array['top_prioritaet','muenchen','engel_voelkers','bogenhausen']);
select _seed_contact('Engel & Völkers München Bogenhausen', 'Alexander', 'Kirchmann', 'Director Sales', 'MuenchenBogenhausen@engelvoelkers.com', '+49 89 99 89 96 0', true);
select _seed_contact('Engel & Völkers München Bogenhausen', 'Marc', 'Berresheim', 'Head of Business Operations', null, null, false);
select _seed_contact('Engel & Völkers München Bogenhausen', 'Maren', 'Luck', 'Head of Sales', null, null, false);
select _seed_contact('Engel & Völkers München Bogenhausen', 'Coco', 'Solberg', 'Head of Rental', null, null, false);

select _seed_company('Engel & Völkers München-Grünwald', 'makler', 'hoch',
  'https://engelvoelkers.com/de/de/shops/muenchen-gruenwald',
  'Südliche Münchner Str. 6a', '82031 München-Grünwald', 'DE',
  E'Spezialisiert auf Muenchner Sueden (Gruenwald, Pullach, Solln, Isartal). Sehr hohe Relevanz: Gruenwald ist eine der teuersten Lagen Bayerns mit hohem Anteil internationaler Kaeufer.',
  array['muenchen','engel_voelkers','gruenwald']);
select _seed_contact('Engel & Völkers München-Grünwald', 'Sören', 'Hein', 'Head of Sales', 'MuenchenGruenwald@engelvoelkers.com', '+49 89 649 88 60', true);
select _seed_contact('Engel & Völkers München-Grünwald', 'Alexander', 'Kirchmann', 'Director Sales', null, null, false);

select _seed_company('Engel & Völkers München City', 'makler', 'mittel',
  'https://engelvoelkers.com/de/de/shops/muenchen-city',
  'Residenzstr. 23', '80333 München', 'DE',
  E'Innenstadt-Standort. Schwerpunkt Altstadt, Lehel, Maxvorstadt. Relevant fuer Altbau-Sanierungen.',
  array['muenchen','engel_voelkers','city']);
select _seed_contact('Engel & Völkers München City', 'Alexander', 'Kirchmann', 'Director Sales', 'MuenchenCity@engelvoelkers.com', '+49 89 23 70 83 00', true);

select _seed_company('Mr. Lodge GmbH', 'makler', 'hoch',
  'https://mrlodge.de',
  'Barer Str. 32 / Prinz-Ludwig-Str. 7', '80333 München', 'DE',
  E'Marktfuehrer fuer moebliertes Wohnen auf Zeit Muenchen (~2.300 Vermittlungen/Jahr). 80 MA, 16-20 Sprachen. Seit 2019 auch Verkauf, eigene Innenarchitektinnen. Filiale am Tegernsee. ABSOLUTE TOP-PRIORITÄT: erste Anlaufstelle fuer Expats.',
  array['top_prioritaet','muenchen','mr_lodge','expats']);
select _seed_contact('Mr. Lodge GmbH', 'Norbert', 'Verbücheln', 'Geschäftsführer', 'info@mrlodge.de', '+49 89 340 823 0', true);
select _seed_contact('Mr. Lodge GmbH', 'Dietmar', 'Schlüter', 'Geschäftsleitung', null, null, false);
select _seed_contact('Mr. Lodge GmbH', 'Bernhard', 'Spitz', 'Geschäftsleitung', null, null, false);
select _seed_contact('Mr. Lodge GmbH', 'Jaqueline', 'Sauren', 'Verkauf', 'verkauf@mrlodge.de', null, false);
select _seed_contact('Mr. Lodge GmbH', 'Gavin', 'Carey', 'Internationale Kundenbeziehungen', null, null, false);

select _seed_company('Duken & v. Wangenheim AG', 'makler', 'hoch',
  'https://wangenheim.de',
  'Grosjeanstraße 4', '81925 München (Bogenhausen)', 'DE',
  E'Inhabergefuehrt seit 1966 (60 Jahre). Spezialist Herzogpark, Nymphenburg, Lehel, Harlaching, Solln, Pullach, Starnberg. Concierge-Level-Service. HNWI, Family Offices, Erbengemeinschaften. Eigene Sparte "Internationale Immobilien". TOP-PRIORITÄT.',
  array['top_prioritaet','muenchen','wangenheim','concierge']);
select _seed_contact('Duken & v. Wangenheim AG', 'Detlev', 'Frhr. v. Wangenheim', 'Vorstand', 'info@wangenheim.de', '+49 89 99 84 33 0', true);

select _seed_company('RIEDEL Immobilien GmbH', 'makler', 'hoch',
  'https://riedel-immobilien.de',
  'Tizianstraße 50', '80638 München (Nymphenburg)', 'DE',
  E'Familienunternehmen seit 1982 (40+ Jahre, 2. Generation). 50+ MA, 5 Standorte (Nymphenburg, Schwabing, Bogenhausen, Graefelfing, Gruenwald). 3.300+ vermittelte Objekte. Auch Schloss Possenhofen. TOP-PRIORITÄT.',
  array['top_prioritaet','muenchen','riedel','familienunternehmen']);
select _seed_contact('RIEDEL Immobilien GmbH', 'Markus', 'Riedel', 'Geschäftsführer', 'ny@riedel-immobilien.de', '+49 89 15 94 55-0', true);
select _seed_contact('RIEDEL Immobilien GmbH', 'Ralf', 'Heidemann', 'Standortleitung Bogenhausen', 'bo@riedel-immobilien.de', null, false);
select _seed_contact('RIEDEL Immobilien GmbH', 'Maximilian', 'Riedel', 'Standortleitung Schwabing', 'sw@riedel-immobilien.de', null, false);
select _seed_contact('RIEDEL Immobilien GmbH', 'Philip', 'Ebeling', 'Standortleitung Gräfelfing', 'gr@riedel-immobilien.de', null, false);

select _seed_company('KENSINGTON Finest Properties International - München', 'makler', 'hoch',
  'https://kensington-international.com/de/de/muenchen',
  null, 'München', 'DE',
  E'Internationaler Premium-Makler. Webseite explizit auf Expats und internationale Geschaeftsleute (Englisch verfuegbar). Spezialisiert auf Luxusimmobilien zentrale Lagen. Hoch relevant.',
  array['muenchen','kensington','international']);
select _seed_contact('KENSINGTON Finest Properties International - München', null, 'KENSINGTON Team', null, 'muenchen@kensington-international.com', null, true);

select _seed_company('Aigner Immobilien GmbH', 'makler', 'hoch',
  'https://aigner-immobilien.de',
  'Ruffinistraße 26', '80637 München (Nymphenburg)', 'DE',
  E'Marktfuehrer eigenstaendige inhabergefuehrte Maklerunternehmen Grossraum Muenchen (35+ Jahre). 165 MA, 9 Standorte. 550 Mio. Objektvolumen 2025. Sehr hohe Relevanz.',
  array['muenchen','aigner','marktfuehrer']);
select _seed_contact('Aigner Immobilien GmbH', 'Thomas', 'Aigner', 'Geschäftsführer', 'info@aigner-immobilien.de', '+49 89 17 87 87-0', true);
select _seed_contact('Aigner Immobilien GmbH', 'Jenny', 'Steinbeiß', 'Geschäftsführerin', null, null, false);

select _seed_company('DAHLER München', 'makler', 'mittel',
  'https://dahlercompany.com/de/immobilienmakler/wohnimmobilien/bayern/muenchen',
  'Maximilianstraße 32', '80539 München', 'DE',
  E'30+ Jahre, 100+ Standorte DE/AT/ES. Mehrfacher DISQ-Testsieger. Premium-Positionierung.',
  array['muenchen','dahler']);
select _seed_contact('DAHLER München', null, 'DAHLER Team München', null, null, null, true);

select _seed_company('VON POLL IMMOBILIEN München', 'makler', 'mittel',
  'https://von-poll.com/de/immobilienmakler/muenchen',
  null, 'München', 'DE',
  E'Premiummakler, mehrfach ausgezeichnet. Hauptsitz Frankfurt, deutschlandweit. Goldpartner ImmoScout24. Dezentrale Lizenzpartner-Struktur.',
  array['muenchen','von_poll']);
select _seed_contact('VON POLL IMMOBILIEN München', null, 'VON POLL Team München', null, null, null, true);

select _seed_company('Rogers Immobilien', 'makler', 'hoch',
  'https://immobilien-vip.com',
  null, 'München', 'DE',
  E'Boutique-Makler spezialisiert auf gehobenen Markt mit explizitem Fokus auf "nationale und internationale Klientel". Eigenes internationales Netzwerk solventer Interessenten.',
  array['muenchen','boutique','international']);
select _seed_contact('Rogers Immobilien', 'Katerina', 'Rogers', 'Inhaberin', null, null, true);
select _seed_contact('Rogers Immobilien', 'Thomas', 'Rogers', 'Inhaber', null, null, false);

select _seed_company('Alternate Immobilien GmbH', 'makler', 'mittel',
  'https://alternate-immobilien.de',
  null, 'München', 'DE',
  E'Full-Service-Makler im Luxussegment. Eigene Sparte fuer strukturierte Immobilienfinanzierungen. "Rundum-sorglos-Pakete".',
  array['muenchen','full_service']);
select _seed_contact('Alternate Immobilien GmbH', null, 'Alternate Team', null, null, null, true);
select _seed_contact('Alternate Immobilien GmbH', 'Jürgen', 'Kronawitter', 'Finanzierung', null, null, false);

select _seed_company('Quartier Eins Premium Immobilien', 'makler', 'niedrig',
  'https://quartier-eins.com',
  null, 'München', 'DE',
  E'Boutique-Makler mit 3 Standorten. Schwerpunkt Premium-Wohn- und Anlageimmobilien.',
  array['muenchen','boutique']);
select _seed_contact('Quartier Eins Premium Immobilien', null, 'Quartier Eins Team', null, null, null, true);

-- 2. Tegernsee
select _seed_company('München Sotheby''s International Realty - Tegernsee', 'makler', 'hoch',
  'https://muenchen-sothebysrealty.com/immobilienmakler-am-tegernsee',
  'Seestraße 10', '83700 Rottach-Egern', 'DE',
  E'Boutique-Standort am Tegernsee, gleiche Inhaberschaft wie Muenchen. Spezialisierung Landhaeuser, Villen, Luxuswohnungen. TOP-PRIORITÄT.',
  array['top_prioritaet','tegernsee','sotheby']);
select _seed_contact('München Sotheby''s International Realty - Tegernsee', 'Michael', 'Reiss', 'Inhaber', 'tegernsee@bayern-sothebysrealty.com', '+49 89 744 24 189 0', true);

select _seed_company('Engel & Völkers Tegernsee', 'makler', 'hoch',
  'https://engelvoelkers.com/de/de/immobilienmakler/bayern/tegernsee',
  null, 'Rottach-Egern', 'DE',
  E'Seit 24+ Jahren in Rottach-Egern. Taetigkeitsgebiet: gesamtes Tegernseer Tal. "kaufkraeftige Klientel aus Deutschland und vermehrt aus dem europaeischen Ausland". TOP-PRIORITÄT.',
  array['top_prioritaet','tegernsee','engel_voelkers']);
select _seed_contact('Engel & Völkers Tegernsee', null, 'E&V Team Tegernsee', null, null, null, true);

select _seed_company('Mr. Lodge - Filiale Tegernsee', 'makler', 'hoch',
  'https://mrlodge.de/immobilienmakler/tegernsee',
  null, 'Rottach-Egern', 'DE',
  E'Eigene Filiale fuer moebliertes Wohnen, Wohnen auf Zeit und Verkauf hochwertiger Immobilien. TOP-PRIORITÄT.',
  array['top_prioritaet','tegernsee','mr_lodge']);
select _seed_contact('Mr. Lodge - Filiale Tegernsee', 'Petra', 'Berger', 'Leitung Filiale', null, null, true);
select _seed_contact('Mr. Lodge - Filiale Tegernsee', 'Alexander', 'Tamm', 'Immobilienberater', null, null, false);

select _seed_company('Aulfes-Steinmüller Immobilien', 'makler', 'hoch',
  'https://immobilienmaklertegernsee.de',
  null, 'Rottach-Egern (Tegernseer Tal)', 'DE',
  E'Familienbetrieb seit 1982 (40+ Jahre). Spezialist hochwertige Wohnimmobilien und Seeliegenschaften.',
  array['tegernsee','familienbetrieb']);
select _seed_contact('Aulfes-Steinmüller Immobilien', null, 'Aulfes-Steinmüller', 'Gründerin', null, null, true);

select _seed_company('Füsser Immobilien', 'makler', 'hoch',
  'https://fuesser-immobilien.com',
  null, 'Tegernsee', 'DE',
  E'Boutique-Makler mit Premium-Fokus. Eigener Bezug zum Innenausbau (Innenarchitektur, Modernisierungen).',
  array['tegernsee','boutique','innenausbau']);
select _seed_contact('Füsser Immobilien', null, 'Füsser', 'Inhaber', null, null, true);

select _seed_company('DAHLER Tegernsee - Bad Tölz', 'makler', 'hoch',
  'https://dahlercompany.com/de/immobilienmakler/wohnimmobilien/bayern/tegernsee-bad-toelz',
  null, 'Tegernsee / Bad Tölz', 'DE',
  E'Premium-Standort DAHLER-Netzwerk. Wolfratshausen bis Oesterreich-Grenze. Villen Hanglage und Seeblick.',
  array['tegernsee','dahler']);
select _seed_contact('DAHLER Tegernsee - Bad Tölz', 'Frank', 'Huemer', null, null, null, true);

select _seed_company('VON POLL IMMOBILIEN Tegernsee', 'makler', 'mittel',
  'https://von-poll.com/de/immobilienmakler/tegernsee',
  null, 'Rottach-Egern, Gmund, Kreuth, Bad Wiessee', 'DE',
  'Premium-Mikrolagen rund um den Tegernsee.',
  array['tegernsee','von_poll']);
select _seed_contact('VON POLL IMMOBILIEN Tegernsee', null, 'VON POLL Team Tegernsee', null, null, null, true);

select _seed_company('Immobilienwelt Rehage & Partner GmbH', 'makler', 'mittel',
  'https://immobilienwelt.com',
  null, 'Tegernseer Tal', 'DE',
  E'IVD-Marktberichterstatter Tegernsee, Bellevue Best Property Agent.',
  array['tegernsee']);
select _seed_contact('Immobilienwelt Rehage & Partner GmbH', null, 'Rehage', 'Inhaber', null, null, true);

select _seed_company('Graf Immobilien GmbH', 'makler', 'niedrig',
  'https://grafimmo.de',
  null, 'Tegernsee', 'DE',
  '25+ Jahre Erfahrung. Muenchen und Tegernsee. Eher mittleres Segment.',
  array['tegernsee']);
select _seed_contact('Graf Immobilien GmbH', null, 'Graf Team', null, null, '+49 8022 27 12 000', true);

select _seed_company('Korbinian Müller Immobilien', 'makler', 'niedrig',
  'https://kmueller-immobilien.de',
  null, 'Tegernsee', 'DE',
  'Einzelmakler. Fokus Tegernsee und ueberregional.',
  array['tegernsee','einzelmakler']);
select _seed_contact('Korbinian Müller Immobilien', 'Korbinian', 'Müller', 'Inhaber', null, null, true);

select _seed_company('rimaldi Immobilien', 'makler', 'mittel',
  'https://rimaldi.de',
  null, 'Tegernsee', 'DE',
  'Lokale Tegernsee-Adresse mit Sachverstaendigen-Hintergrund.',
  array['tegernsee']);
select _seed_contact('rimaldi Immobilien', 'Mario', 'Haitzer', 'DEKRA-Sachverständiger', null, null, true);

-- 3. Starnberger See / Fuenfseenland
select _seed_company('Engel & Völkers Fünf Seen Land', 'makler', 'hoch',
  'https://engelvoelkers.com/de-de/starnbergersee',
  'Hauptstraße 9', '82319 Starnberg', 'DE',
  E'Seit 2004 in der Region. Fuenfseenland einer der weltweit erfolgreichsten E&V-Standorte. Pendler, Familien, Privatinvestoren UND Expats. Zwei Standorte: Starnberg + Herrsching. TOP-PRIORITÄT.',
  array['top_prioritaet','starnberg','engel_voelkers']);
select _seed_contact('Engel & Völkers Fünf Seen Land', 'Holger', 'Baete', 'Lizenzpartner', 'Starnberg@engelvoelkers.com', '+49 8151 36897-0', true);

select _seed_company('LOEGER Immobilien', 'makler', 'hoch',
  'https://loeger-immobilien.de',
  null, 'Tutzing am Starnberger See', 'DE',
  E'Seit 1976 (50 Jahre) am Starnberger See. Starnberg, Possenhofen, Poecking, Feldafing, Tutzing, Bernried, Seeshaupt, Berg, Muensing. TOP-PRIORITÄT.',
  array['top_prioritaet','starnberg','loeger']);
select _seed_contact('LOEGER Immobilien', null, 'Loeger', 'Inhaber', null, null, true);

select _seed_company('Astrid Kaiser Immobilien', 'makler', 'hoch',
  'https://immo-kaiserreich.de',
  null, 'Berg / Starnberger See', 'DE',
  E'Spezialisierte Maklerin Fuenfseenland und Muenchen-Spezialimmobilien. Auch Vermittlung Ferienimmobilien.',
  array['starnberg']);
select _seed_contact('Astrid Kaiser Immobilien', 'Astrid', 'Kaiser', 'Inhaberin', null, null, true);

select _seed_company('Aigner Immobilien - Standort Starnberg', 'makler', 'hoch',
  'https://aigner-immobilien.de',
  'Hauptstr. 5a', '82319 Starnberg', 'DE',
  'Eigener Standort des Marktfuehrers im Grossraum Muenchen.',
  array['starnberg','aigner']);
select _seed_contact('Aigner Immobilien - Standort Starnberg', null, 'Aigner Team Starnberg', null, null, '+49 89 17 87 87-0', true);

select _seed_company('FT Immobilien 24 Starnberg', 'makler', 'hoch',
  'https://ftimmobilien24.com/immobilienmakler-m%C3%BCnchen/immobilienmakler-starnberg',
  null, 'Starnberg', 'DE',
  E'20 Jahre Erfahrung am Starnberger See, 80+ Transaktionen. Off-Market-Vermittlung Premium > 3 Mio €.',
  array['starnberg','off_market']);
select _seed_contact('FT Immobilien 24 Starnberg', null, 'FT Team', null, null, '+49 89 318 138 10', true);

select _seed_company('VON POLL IMMOBILIEN Starnberg & Fünf Seen Land', 'makler', 'mittel',
  'https://von-poll.com/de/immobilienmakler/starnberg-fuenf-seen-land',
  null, 'Starnberg', 'DE',
  'Solide Premium-Marktpraesenz im Fuenfseenland.',
  array['starnberg','von_poll']);
select _seed_contact('VON POLL IMMOBILIEN Starnberg & Fünf Seen Land', null, 'VON POLL Team Starnberg', null, null, null, true);

select _seed_company('DAHLER Starnberg', 'makler', 'mittel',
  'https://dahlercompany.com',
  null, 'Starnberg', 'DE',
  'Eigener DAHLER-Standort in Starnberg.',
  array['starnberg','dahler']);
select _seed_contact('DAHLER Starnberg', null, 'DAHLER Team Starnberg', null, null, null, true);

select _seed_company('AKURAT Immobilien', 'makler', 'hoch',
  'https://akurat.net',
  null, 'Büro Fünfseenland & Repräsentanz München-Altstadt', 'DE',
  E'Hochklassige Immobilien Muenchen, Fuenfseenland, oberbayerische Seen. 20.000+ vorgemerkte Kaufinteressenten. "Secret Sale" / Off-Market.',
  array['starnberg','akurat','off_market']);
select _seed_contact('AKURAT Immobilien', null, 'AKURAT Team', null, null, null, true);

-- 4. Chiemsee
select _seed_company('Sotheby''s International Realty - Chiemgau', 'makler', 'hoch',
  'https://muenchen-sothebysrealty.com/immobilienmakler-chiemsee',
  'Ludwigsplatz 9', '83022 Rosenheim', 'DE',
  E'Bayern-Sotheby''s in Rosenheim fuer Chiemsee, Chiemgau, Rosenheimer Landkreis. TOP-PRIORITÄT, gleiche Inhaberschaft - Anschreiben buendeln.',
  array['top_prioritaet','chiemsee','sotheby']);
select _seed_contact('Sotheby''s International Realty - Chiemgau', 'Michael', 'Reiss', 'Inhaber', 'chiemgau@bayern-sothebysrealty.com', '+49 8031 589 59 54', true);

select _seed_company('Engel & Völkers Chiemsee', 'makler', 'hoch',
  'https://engelvoelkers.com/de/de/shops/chiemsee',
  null, 'Prien am Chiemsee + Rosenheim Mitte', 'DE',
  E'Seit 23+ Jahren in der Region. DE/EN/IT. Villen Seelagen, Landsitze, Bauernhaeuser. TOP-PRIORITÄT.',
  array['top_prioritaet','chiemsee','engel_voelkers']);
select _seed_contact('Engel & Völkers Chiemsee', 'Jörg', 'Kaller', 'Geschäftsleitung', null, null, true);

select _seed_company('VON POLL IMMOBILIEN Chiemsee', 'makler', 'hoch',
  'https://von-poll.com/de/immobilienmakler/chiemsee',
  null, 'Prien am Chiemsee', 'DE',
  E'Etabliert in Prien. Wohnraumberatung und Ferienhaus "Schneeganserhof" fuer Probewohnen.',
  array['chiemsee','von_poll']);
select _seed_contact('VON POLL IMMOBILIEN Chiemsee', null, 'VON POLL Team Chiemsee', null, null, null, true);

select _seed_company('CHIEMSEE VILLA IMMOBILIEN', 'makler', 'hoch',
  'https://chiemsee-villa.com',
  'Bernauer Str. 8', '83209 Prien am Chiemsee', 'DE',
  E'30+ Jahre Erfahrung. Villen, Landhaeuser, ETWs, Grundstuecke und Gewerbe Chiemgau. Diskrete Off-Market.',
  array['chiemsee','off_market']);
select _seed_contact('CHIEMSEE VILLA IMMOBILIEN', 'Franz', 'Laböck', 'Inhaber', null, null, true);

select _seed_company('Langmayer Immobilien & Home Staging', 'makler', 'hoch',
  'https://langmayer-immobilien.de',
  null, 'Chiemgau-Region', 'DE',
  'Familienunternehmen. IVD/DGHR. Auch Home Staging und 3D-Visualisierungen. Schnittmenge zum Innenausbau.',
  array['chiemsee','home_staging']);
select _seed_contact('Langmayer Immobilien & Home Staging', null, 'Langmayer', 'Inhaber', null, null, true);

select _seed_company('PK Immobilien Chiemsee Oberbayern', 'makler', 'mittel',
  'https://kennstdueinen.de/immobilienmakler-traunstein-pk-immobilien-chiemsee-oberbayern-d940357.html',
  null, 'Traunstein', 'DE',
  'Seit 2003. Sehr gute Bewertungen. Gesamte Chiemgau-Region.',
  array['chiemsee']);
select _seed_contact('PK Immobilien Chiemsee Oberbayern', 'Elfriede', 'Portenkirchner', 'Inhaberin', null, null, true);

select _seed_company('DAHLER Rosenheim & Chiemsee', 'makler', 'mittel',
  'https://dahlercompany.com',
  null, 'Rosenheim & Chiemsee', 'DE',
  'DAHLER-Standorte Rosenheim und Chiemsee.',
  array['chiemsee','dahler']);
select _seed_contact('DAHLER Rosenheim & Chiemsee', null, 'DAHLER Team Chiemsee', null, null, null, true);

-- 5. Relocation
select _seed_company('Anders Consulting Relocation Service München', 'relocation', 'hoch',
  'https://anders-relocation.de/relocation-muenchen',
  null, 'München', 'DE',
  E'Seit 1997 (28+ Jahre). Visa, Aufenthaltstitel, Home Search, Behoerden, Schulen. "Global Mobility Academy Muenchen". Manager, Fach-/Fuehrungskraefte. TOP-PRIORITÄT.',
  array['top_prioritaet','relocation','expats']);
select _seed_contact('Anders Consulting Relocation Service München', 'Christoph', 'Anders', 'Geschäftsführer', null, null, true);

select _seed_company('Fidelio Relocation - München', 'relocation', 'hoch',
  'https://fidelio-relocation.de/muenchen',
  null, 'München (Hauptsitz Frankfurt)', 'DE',
  E'Internationale Relocation-Agentur. Fach-/Fuehrungskraefte, Expats, Privatpersonen. Komplettservice. TOP-PRIORITÄT.',
  array['top_prioritaet','relocation','expats']);
select _seed_contact('Fidelio Relocation - München', null, 'Fidelio Team München', null, 'muenchen@fidelio-relocation.de', '+49 69 4056499-1', true);

select _seed_company('Relosophy', 'relocation', 'hoch',
  'https://therelosophy.com',
  null, 'München', 'DE',
  E'Inhabergefuehrte Boutique-Relocation. Inhaber selbst Expats. State-licensed Real Estate Professionals. Bieten Innenarchitektur-Unterstuetzung. TOP-PRIORITÄT (sehr passend) - natuerlichstes Anschluss-Geschaeft.',
  array['top_prioritaet','relocation','interior_design']);
select _seed_contact('Relosophy', 'Madalina', null, 'Co-Owner', null, null, true);
select _seed_contact('Relosophy', 'Raul', null, 'Co-Owner', null, null, false);

select _seed_company('Mildenberger Relocation Munich', 'relocation', 'hoch',
  'https://mildenberger-relocation.com',
  null, 'München & Bayern', 'DE',
  'Premium-Service Expats. Familienbetreuung (Kindergartensuche, Anmeldungen, Kinderaerzte). Mehrsprachig.',
  array['relocation','familie']);
select _seed_contact('Mildenberger Relocation Munich', null, 'Mildenberger', 'Inhaberin', null, null, true);

select _seed_company('Relocation One', 'relocation', 'mittel',
  'https://relocation-one.de',
  'Sundergaustraße 145', '81739 München', 'DE',
  'Region Muenchen/Augsburg. Wohnungssuche, Behoerdengaenge.',
  array['relocation']);
select _seed_contact('Relocation One', 'Sabine', 'Bergengruen', 'Inhaberin', null, '+49 89 60013883', true);

-- ============================================================
-- Initial-Recommendations: jeder primaere Kontakt mit Email -> Erstkontakt
-- ============================================================
insert into recommendations (company_id, contact_id, kind, priority, status, title, reason, due_at)
select
  co.id, p.id, 'email', co.priority, 'offen',
  'Erstkontakt-Email an ' || coalesce(p.full_name, p.email, 'Kontakt'),
  case
    when co.tags @> array['top_prioritaet']::text[] then 'TOP-PRIORITÄT aus Recherche: jetzt zuerst anschreiben.'
    else 'Aus der Makler-Recherche uebernommen - Erstkontakt steht aus.'
  end,
  now()
from companies co
join contacts p on p.company_id = co.id and p.is_primary = true
where co.status = 'lead'
  and not exists (
    select 1 from recommendations r
    where r.contact_id = p.id and r.status = 'offen' and r.kind = 'email'
  );

-- ============================================================
-- Cleanup
-- ============================================================
drop function if exists _seed_company(text, company_type, priority_level, text, text, text, text, text, text[]);
drop function if exists _seed_contact(text, text, text, text, text, text, boolean);
