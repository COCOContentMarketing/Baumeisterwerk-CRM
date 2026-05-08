-- Seed: Interior-Designer-Recherche Baumeisterwerk (Stand: Mai 2026)
-- 45 Studios aus dem Raum Muenchen + Umgebung. Kontakthistorie:
--   - Eine Erstkontakt-Email im September 2025 (alle).
--   - Eine zweite Email im Oktober 2025 fuer Eintraege mit Status "nochmal gemailt".
--   - Ein Termin im September 2025 fuer Eintraege mit Status "TERMIN".
--   - Inbound-Notizen fuer Eintraege mit konkreter Antwort
--     (Larissa Lach, Pure Homing, Stephanie Gehringer).
--
-- Idempotent: Helper-Funktionen pruefen vor dem Insert auf Existenz.

-- ============================================================
-- Helper-Funktionen
-- ============================================================

create or replace function _seed_id_company(
  p_name text,
  p_website text,
  p_address text,
  p_city text,
  p_notes text,
  p_status company_status
) returns uuid as $$
declare v_id uuid;
begin
  select id into v_id from companies where name = p_name limit 1;
  if v_id is null then
    insert into companies (name, type, status, priority, website, address, city, country, notes, tags)
    values (p_name, 'interior_designer', p_status, 'mittel', p_website, p_address, p_city, 'DE', p_notes, array['interior_designer','muenchen'])
    returning id into v_id;
  else
    update companies set
      website = coalesce(website, p_website),
      address = coalesce(address, p_address),
      city = coalesce(city, p_city),
      notes = coalesce(notes, p_notes),
      status = p_status
    where id = v_id;
  end if;
  return v_id;
end;
$$ language plpgsql;

create or replace function _seed_id_contact(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_email text,
  p_phone text,
  p_is_primary boolean
) returns uuid as $$
declare
  v_co uuid;
  v_id uuid;
begin
  select id into v_co from companies where name = p_company_name limit 1;
  if v_co is null then return null; end if;
  select id into v_id from contacts where company_id = v_co
    and coalesce(first_name,'') = coalesce(p_first_name,'')
    and coalesce(last_name,'')  = coalesce(p_last_name,'')
    limit 1;
  if v_id is null then
    insert into contacts (company_id, first_name, last_name, role, email, phone, is_primary)
    values (v_co, p_first_name, p_last_name, p_role, p_email, p_phone, p_is_primary)
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql;

-- Erstkontakt-Email (September 2025).
create or replace function _seed_id_email1(p_company text, p_at timestamptz) returns void as $$
declare v_co uuid; v_p uuid;
begin
  select id into v_co from companies where name = p_company limit 1;
  if v_co is null then return; end if;
  select id into v_p from contacts where company_id = v_co and is_primary order by created_at limit 1;
  if exists (select 1 from interactions where company_id = v_co and occurred_at = p_at and type = 'email_sent') then return; end if;
  insert into interactions (company_id, contact_id, type, direction, subject, body, occurred_at)
  values (v_co, v_p, 'email_sent', 'outbound',
    'Kooperationsvorschlag fuer Interior-Projekte – Baumeisterwerk',
    E'Sehr geehrte Damen und Herren,\n\n' ||
    E'mit Baumeisterwerk biete ich Baubegleitung und Baumanagement fuer hochwertigen Innenausbau - die Schnittstelle zwischen Planung und Ausfuehrung. Vollstaendig zweisprachig (DE/EN), unabhaengig vom Generalunternehmer, mit Pauschalhonorar statt HOAI.\n\n' ||
    E'Fuer Interior-Designer uebernehme ich die komplette Steuerung der Handwerker auf der Baustelle, damit Sie sich auf Konzept und Kundenbeziehung konzentrieren koennen. Referenzen u.a. Bayerischer Hof Muenchen (65 Zimmer) und Max-Palais.\n\n' ||
    E'Ueber ein kurzes Kennenlerngespraech wuerde ich mich freuen.\n\n' ||
    E'Mit besten Gruessen\nMartin Bauer\nBaumeisterwerk\nhttps://www.baumeisterwerk.de/en',
    p_at);
end;
$$ language plpgsql;

-- Follow-up-Email (Oktober 2025).
create or replace function _seed_id_email2(p_company text, p_at timestamptz) returns void as $$
declare v_co uuid; v_p uuid;
begin
  select id into v_co from companies where name = p_company limit 1;
  if v_co is null then return; end if;
  select id into v_p from contacts where company_id = v_co and is_primary order by created_at limit 1;
  if exists (select 1 from interactions where company_id = v_co and occurred_at = p_at and type = 'email_sent') then return; end if;
  insert into interactions (company_id, contact_id, type, direction, subject, body, occurred_at)
  values (v_co, v_p, 'email_sent', 'outbound',
    'Kurzes Nachhaken: Baumeisterwerk',
    E'Sehr geehrte Damen und Herren,\n\n' ||
    E'ich melde mich kurz, weil meine Mail aus dem September moeglicherweise im Posteingang untergegangen ist.\n\n' ||
    E'Falls eine Zusammenarbeit aktuell nicht passt, ist auch das eine hilfreiche Antwort. Ansonsten wuerde ich mich ueber einen kurzen Austausch freuen.\n\n' ||
    E'Mit besten Gruessen\nMartin Bauer\nBaumeisterwerk',
    p_at);
end;
$$ language plpgsql;

-- Termin (September 2025).
create or replace function _seed_id_meeting(p_company text, p_at timestamptz, p_note text) returns void as $$
declare v_co uuid; v_p uuid;
begin
  select id into v_co from companies where name = p_company limit 1;
  if v_co is null then return; end if;
  select id into v_p from contacts where company_id = v_co and is_primary order by created_at limit 1;
  if exists (select 1 from interactions where company_id = v_co and occurred_at = p_at and type = 'meeting') then return; end if;
  insert into interactions (company_id, contact_id, type, direction, subject, body, occurred_at)
  values (v_co, v_p, 'meeting', 'outbound',
    'Kennenlern-Termin', coalesce(p_note, 'Termin aus Erstkontakt-Recherche.'), p_at);
end;
$$ language plpgsql;

-- Inbound-Antwort (Email oder Notiz).
create or replace function _seed_id_inbound(
  p_company text, p_at timestamptz, p_type interaction_type, p_subject text, p_body text
) returns void as $$
declare v_co uuid; v_p uuid;
begin
  select id into v_co from companies where name = p_company limit 1;
  if v_co is null then return; end if;
  select id into v_p from contacts where company_id = v_co and is_primary order by created_at limit 1;
  if exists (select 1 from interactions where company_id = v_co and occurred_at = p_at and type = p_type) then return; end if;
  insert into interactions (company_id, contact_id, type, direction, subject, body, occurred_at)
  values (v_co, v_p, p_type, 'inbound', p_subject, p_body, p_at);
end;
$$ language plpgsql;

-- ============================================================
-- Companies + Kontakte
-- ============================================================

-- 1. AR INTERIOR DESIGN GmbH
select _seed_id_company('AR INTERIOR DESIGN GmbH', 'https://www.ar-interior.de',
  'Seitzstraße 15', '80538 München',
  E'Beratung, Konzeption und Realisierung. Keine aktuellen Projekte auf der Website.', 'kontaktiert');
select _seed_id_contact('AR INTERIOR DESIGN GmbH', 'Alexandra', 'Rasp', null, 'alexandra.rasp@ar-interior.de', '+49 89 10 11 92 92', true);

-- 2. Christine Kröncke Interior Design GmbH
select _seed_id_company('Christine Kröncke Interior Design GmbH', 'https://www.christinekroencke.net',
  'Thierschstr. 37', '80538 München',
  E'Laut Website keine Umsetzung. Buero-Telefon: 089 21 88 91-0.', 'kontaktiert');
select _seed_id_contact('Christine Kröncke Interior Design GmbH', 'Jörg', 'von Sichart', 'Inhaber', 'joerg.von.sichart@christinekroencke.net', '+49 174 31 050 40', true);
select _seed_id_contact('Christine Kröncke Interior Design GmbH', 'Frank', 'Stohlmeyer', 'Inhaber', 'frank.stohlmeyer@christinekroencke.net', '+49 89 218891 40', false);

-- 3. district8 GmbH
select _seed_id_company('district8 GmbH', null,
  'Theresienstr. 89', '80333 München',
  'Bieten Planung und Umsetzung an.', 'kontaktiert');
select _seed_id_contact('district8 GmbH', 'Stefan', 'Ecker', 'Geschäftsführer', 'info@district8.de', '+49 89 90145880', true);
select _seed_id_contact('district8 GmbH', 'Irina', 'Resetnic', 'Geschäftsführerin', null, null, false);

-- 4. Gabriela Raible / GRI
select _seed_id_company('Gabriela Raible / GRI', 'https://gabriela-raible.com',
  'Martiusstr. 5', '80802 München',
  E'Gstatter ist mein Pendant, direkt kontaktieren. Hauptsaechlich Office.', 'kontaktiert');
select _seed_id_contact('Gabriela Raible / GRI', 'Michael', 'Gstatter', 'Projektmanagement', 'mail@gabriela-raible.com', '+49 89 3302950', true);
select _seed_id_contact('Gabriela Raible / GRI', 'Gabriela', 'Raible-von Lüttichau', 'Inhaberin', null, null, false);
select _seed_id_contact('Gabriela Raible / GRI', 'Christiane', 'Schleu-Demmel', 'Privatprojekte', null, null, false);

-- 5. GANTER Group
select _seed_id_company('GANTER Group', 'https://ganter-group.com/',
  'Ganter Interior GmbH, Am Kraftwerk 4', '79183 Waldkirch',
  E'International taetig, viel Ladenbau, auch sehr hochwertige Privatobjekte.', 'kontaktiert');
select _seed_id_contact('GANTER Group', 'Jan Hendrik', 'Vlijt', 'COO', 'vlijt@ganter-group.com', '07681 4018-3147', true);

-- 6. HEERWAGEN Design Consulting (nochmal gemailt)
select _seed_id_company('HEERWAGEN Design Consulting', 'https://heerwagen-dc.com',
  'Kaiserstraße 49', '80801 München',
  E'Nur Konzeption und Moebel auf der Website; alle Handwerker bei Team mit drin. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('HEERWAGEN Design Consulting', 'Jeanette', 'Heerwagen', 'Inhaberin', 'j.heerwagen@heerwagen-dc.com', '+49 89 21 11 35 95', true);

-- 7. iam interior.architects.munich (TERMIN)
select _seed_id_company('iam interior.architects.munich', 'https://interior-architects-munich.com',
  'Müllerstr. 20', '80469 München',
  E'Praktisch nur Maedels; viel Buero, aber auch Privat und Hotels. Termin steht.', 'in_gespraech');
select _seed_id_contact('iam interior.architects.munich', 'Julia', 'Schneider', 'Inhaberin', 'studio@interior-architects-munich.com', '+49 89 23547906', true);

-- 8. INpuls
select _seed_id_company('INpuls', 'https://in-puls.com',
  'Gabelsbergerstr. 62', '80333 München',
  E'Hans Sachs Str. Unter Projekte nur Office; laut Leistungen aber auch Privat.', 'kontaktiert');
select _seed_id_contact('INpuls', 'Réka', 'Visnyei', 'Inhaberin', 'hello@IN-puls.com', '089 55260299', true);

-- 9. Landau + Kindelbacher
select _seed_id_company('Landau + Kindelbacher', 'https://www.landaukindelbacher.de',
  'Ottostraße 6', '80333 München',
  E'Platzhirsch in Muenchen; sucht gerade Projektleiter. 22.9. - Email geschrieben.', 'kontaktiert');
select _seed_id_contact('Landau + Kindelbacher', 'Gerhard', 'Landau', 'Inhaber', 'bewerbung@landaukindelbacher.de', '+49 89 24 22 89 0', true);
select _seed_id_contact('Landau + Kindelbacher', 'Ludwig', 'Kindelbacher', 'Inhaber', null, null, false);
select _seed_id_contact('Landau + Kindelbacher', 'Nadine', 'Rohde', 'Kaufmännische Leitung', null, null, false);

-- 10. LOVA Design
select _seed_id_company('LOVA Design', 'https://lovadesign.de',
  'Nordendstr. 28', '80801 München',
  E'Schwerpunkt auf Konzept; gute Referenzen.', 'kontaktiert');
select _seed_id_contact('LOVA Design', 'Mery', 'Reif', 'Inhaberin', 'info@lovadesign.de', '+49 179 9582212', true);

-- 11. THOMAS MANG STUDIO GMBH (TERMIN)
select _seed_id_company('THOMAS MANG STUDIO GMBH', 'https://thomasmang.com/',
  'Flemingstr. 55', '81925 München',
  E'Termin steht.', 'in_gespraech');
select _seed_id_contact('THOMAS MANG STUDIO GMBH', 'Thomas', 'Mang', 'Inhaber', 'studio@thomasmang.com', '+49 89 244 14 38 80', true);

-- 12. Mauritz Design GmbH
select _seed_id_company('Mauritz Design GmbH', 'https://mauritzdesign.com/',
  'Pilotystrasse 4', '80538 München', null, 'kontaktiert');
select _seed_id_contact('Mauritz Design GmbH', 'Stefan', 'Mauritz', 'Inhaber', 'info@mauritzdesign.com', '+49 89 71 04 66 98-0', true);

-- 13. Manuela Bross Innenarchitektur (nochmal gemailt)
select _seed_id_company('Manuela Bross Innenarchitektur', 'https://www.manuelabross.de',
  'Kolumbusstr. 22', '81543 München',
  E'Guenstige Beratungspakete; vielseitige Projekte. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Manuela Bross Innenarchitektur', 'Manuela', 'Bross', 'Inhaberin', 'info@manuelabross.de', '+49 89 9042988-0', true);

-- 14. CYD Innenarchitektur
select _seed_id_company('CYD Innenarchitektur', 'https://www.cyd.agency/',
  'Schellingstr. 98', '80798 München',
  E'Neben viel Gewerbe auch sehr hochwertige Privatprojekte.', 'kontaktiert');
select _seed_id_contact('CYD Innenarchitektur', 'Philipp', 'Meyer-Bothling', 'Inhaber', 'ask@cyd.agency', '+49 89 20188967', true);

-- 15. raumwerkstätten GmbH
select _seed_id_company('raumwerkstätten GmbH', 'https://www.raumwerkstaetten.de',
  'Hirschbergstraße 8', '80634 München',
  E'Schwerpunkt Kueche und Bad, aber auch alles andere.', 'kontaktiert');
select _seed_id_contact('raumwerkstätten GmbH', 'Michael Hubertus', 'Decker', 'Inhaber', 'kontakt@raumwerkstaetten.de', '+49 89 200 622 500', true);

-- 16. SEBASTIAN ZENKER INTERIOR
select _seed_id_company('SEBASTIAN ZENKER INTERIOR', 'https://www.sebastianzenker.com',
  'Theresienstr. 23', '80333 München',
  E'Tolle Projekte, Schwerpunkt Privat.', 'kontaktiert');
select _seed_id_contact('SEBASTIAN ZENKER INTERIOR', 'Sebastian', 'Zenker', 'Inhaber', 'mail@sebastianzenker.com', '+49 89 55289744', true);

-- 17. Tredup Design.Interiors
select _seed_id_company('Tredup Design.Interiors', 'https://www.tredup-interiors.com',
  'Reichenbachstr. 26', '80469 München',
  E'Viel internationale Erfahrung mit Top-Kunden.', 'kontaktiert');
select _seed_id_contact('Tredup Design.Interiors', 'Ulrich', 'Tredup', 'Inhaber', 'contact@tredup-interiors.com', '+49 89 2020820', true);

-- 18. Vey Innenarchitekten
select _seed_id_company('Vey Innenarchitekten', 'https://www.vey-innenarchitekten.com',
  'Blumenstraße 6', '80331 München',
  E'Buero in der Blumenstr. Vielfaeltige Projekte.', 'kontaktiert');
select _seed_id_contact('Vey Innenarchitekten', 'Ernst-Ludwig', 'Vey', 'Inhaber', 'mail@vey-innenarchitekten.com', '+49 89 20245921', true);

-- 19. Stephanie Thatenhorst Interior (nochmal gemailt)
select _seed_id_company('Stephanie Thatenhorst Interior', 'https://www.stephanie-thatenhorst.com',
  'Franz-Joseph-Straße 14', '80801 München',
  E'Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Stephanie Thatenhorst Interior', 'Stephanie', 'Thatenhorst', 'Inhaberin', 'studio@stephanie-thatenhorst.com', '089 5480 8988', true);

-- 20. Jørgensen Living (nochmal gemailt)
select _seed_id_company('Jørgensen Living', 'https://www.joergensenliving.com/',
  'Bürgerstrasse 22', '81925 München',
  E'Schaltet Google Ads, stammt aus Daenemark. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Jørgensen Living', 'Nathalie', 'Jørgensen', 'Inhaberin', 'hello@joergensenliving.com', '0171 2889918', true);

-- 21. Studio 17B (nochmal gemailt)
select _seed_id_company('Studio 17B', 'https://www.studio17b.de/',
  'Dorfstraße 17B', '83626 Valley',
  E'Schaltet Google Ads, schoene Projekte, Beratung bis Ausfuehrung. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Studio 17B', 'Stephanie Heidi', 'Schmid', 'Inhaberin', 'info@studio17b.de', '0163-206802072', true);

-- 22. One House (TERMIN)
select _seed_id_company('One House', 'https://onehouse.de/',
  'Pestalozzistrasse 40A', '80469 München',
  E'Eigene Moebel daenisches Design, made in Germany; bieten Einrichtungsberatung an. Termin steht.', 'in_gespraech');
select _seed_id_contact('One House', 'Jan-Willem', 'van den Bosch', 'Inhaber', 'hello@onehouse.de', '+49 89 74038505', true);

-- 23. MALLUVIA innenarchitektur
select _seed_id_company('MALLUVIA innenarchitektur', 'https://www.malluvia.com/',
  'Barer Str. 36', '80333 München',
  E'Cooles Frauenteam, coole Projekte, Chefin hat Bauingenieur als Mann.', 'kontaktiert');
select _seed_id_contact('MALLUVIA innenarchitektur', 'Marcella', 'Breugl', 'Inhaberin', 'servus@malluvia.com', '089 55 27 99 03', true);

-- 24. Egetemeier Interior Design Studio
select _seed_id_company('Egetemeier Interior Design Studio', 'https://egetemeier.de/',
  'Nymphenburgerstrasse 121', '80636 München',
  null, 'kontaktiert');
select _seed_id_contact('Egetemeier Interior Design Studio', 'Stefan', 'Rollwagen', 'Inhaber', 'kontakt@egetemeier.de', '089 5527 3250', true);
select _seed_id_contact('Egetemeier Interior Design Studio', 'Alexander', 'Heber', 'Minotti Store', null, null, false);

-- 25. Kerstin Thorborg
select _seed_id_company('Kerstin Thorborg', 'https://kerstinthorborg.de/',
  'Isoldenstr. 27', '80804 München',
  E'Reiche Frau, international unterwegs, null Background.', 'kontaktiert');
select _seed_id_contact('Kerstin Thorborg', 'Kerstin', 'Thorborg', 'Inhaberin', 'kerstin.thorborg@gmx.de', '+49 172 236 81 81', true);

-- 26. Silvia Decke (nochmal gemailt)
select _seed_id_company('Silvia Decke', 'https://www.silviadecke.com/',
  'Schraudolphstrasse 3a', '80799 München',
  E'Interessante Frau, interessante Projekte, Beratung bis Umsetzung. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Silvia Decke', 'Silvia', 'Decke', 'Inhaberin', 'contact@silviadecke.com', null, true);

-- 27. Stil und Raum (TERMIN)
select _seed_id_company('Stil und Raum', 'https://www.stilundraum.de/',
  'Dachauer Straße 5', '82256 Fürstenfeldbruck',
  E'Semiprofessionell, aber bemueht. Termin steht.', 'in_gespraech');
select _seed_id_contact('Stil und Raum', 'Katya', 'Hajj', 'Inhaberin', 'hallo@stilundraum.de', '08141 315 24 33', true);

-- 28. freudenspiel
select _seed_id_company('freudenspiel', 'https://www.freudenspiel.com/',
  'Görzer Straße 140', '81549 München',
  E'Sehr schoene Projekte; Handwerker mit auf der Website; eigentlich keine Projektleitung.', 'kontaktiert');
select _seed_id_contact('freudenspiel', 'Elisabeth', 'Zola', 'Inhaberin', 'office@freudenspiel.com', '089 61101-458', true);

-- 29. Möllers Interior Design
select _seed_id_company('Möllers Interior Design', 'https://www.moellers-interior-design.de/',
  'Klosterhofstraße 6', '80331 München',
  E'Viele eigene Moebel, gute Projekte, Fokus auf Konzept, aber auch Umsetzung.', 'kontaktiert');
select _seed_id_contact('Möllers Interior Design', 'Peter', 'Möllers', 'Inhaber', 'info@moellers-interior-design.de', '089 28 81 00-0', true);

-- 30. Neue Werkstätten
select _seed_id_company('Neue Werkstätten', 'https://neue-werkstaetten.de/',
  'Promenadeplatz 8', '80333 München',
  E'Re-Opening im Oktober.', 'kontaktiert');
select _seed_id_contact('Neue Werkstätten', 'Claudia', 'Meyer-Brühl', 'Inhaberin', 'info@neue-werkstaetten.de', '089 24 20 50 0', true);

-- 31. eswerderaum
select _seed_id_company('eswerderaum', 'https://www.eswerderaum.de/',
  'Oettingenstr. 38', '80538 München',
  E'Projekte solala, nur Planung.', 'kontaktiert');
select _seed_id_contact('eswerderaum', 'Andreas', 'Ptatscheck', 'Inhaber', 'info@eswerderaum.de', '089 642973-64', true);

-- 32. Larissa Lach INTERIORS (Reply: interessiert, aber aktuell keine passenden Projekte)
select _seed_id_company('Larissa Lach INTERIORS', 'https://larissalach-interiors.de/',
  'Pelkoverstraße 9', '85635 Höhenkirchen-Siegertsbrunn',
  E'Wenig Projekte, keine erkennbare Umsetzung. Hat geantwortet: interessiert, aber aktuell keine passenden Projekte; meldet sich bei Bedarf.', 'kontaktiert');
select _seed_id_contact('Larissa Lach INTERIORS', 'Larissa', 'Lach-Zimmermann', 'Inhaberin', 'info@larissalach-interiors.de', '0151 153 12 794', true);

-- 33. Innenarchitektur Federleicht (TERMIN)
select _seed_id_company('Innenarchitektur Federleicht', 'https://www.innenarchitektur-federleicht.de/',
  'Marsstraße 74', '80335 München',
  E'Gute Projekte, nur Planung. Termin steht.', 'in_gespraech');
select _seed_id_contact('Innenarchitektur Federleicht', 'Andrea', 'Franke', 'Inhaberin', 'office@innenarchitektur-federleicht.de', '089 20067970', true);

-- 34. Unique Interiors GmbH (TERMIN)
select _seed_id_company('Unique Interiors GmbH', 'https://www.uniqueinteriors.de/',
  'Ehrengutstraße 7 / RGB', '80469 München',
  E'Einrichtung, Umsetzung, Staging. Gute Projekte, interessante Frau, kein Team. Termin steht.', 'in_gespraech');
select _seed_id_contact('Unique Interiors GmbH', 'Almuth', 'Widera', 'Inhaberin', 'widera@stageitup.de', '+49 177 2902614', true);

-- 35. MLH Innenarchitektur
select _seed_id_company('MLH Innenarchitektur', 'https://www.marinalouisehampel.com/',
  'Hirschbergstrasse 9', '80634 München',
  E'Office und Hotels; Umsetzung auch fuer andere Planungsbueros.', 'kontaktiert');
select _seed_id_contact('MLH Innenarchitektur', 'Marina-Louise', 'Hampel', 'Inhaberin', 'mail@marinalouisehampel.com', '089 89 691 296', true);

-- 36. INSIDE STORIES (nochmal gemailt)
select _seed_id_company('INSIDE STORIES', 'https://inside-stories.eu/',
  'Grünwalder Str. 160', '81545 München',
  E'Professioneller Auftritt, zwei Frauen ohne erkennbare Umsetzungskompetenz. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('INSIDE STORIES', 'Brigitte', 'Landwehr', 'Architektin', 'info@inside-stories.com', '089 209 209 08', true);
select _seed_id_contact('INSIDE STORIES', 'Annett', 'Köberlein', 'Marketingwirt', null, null, false);

-- 37. MEIEREI INNENARCHITEKTUR
select _seed_id_company('MEIEREI INNENARCHITEKTUR', 'https://meierei.org/',
  'Birkenleiten 41, Kraemer''sche Kunstmühle', '81543 München',
  E'Wollen immer von A-Z umsetzen; Privatprojekte ok, Restaurants etc. gut.', 'kontaktiert');
select _seed_id_contact('MEIEREI INNENARCHITEKTUR', 'Dorothee', 'Maier', 'Inhaberin', 'info@meierei.org', '089 890 670 55', true);
select _seed_id_contact('MEIEREI INNENARCHITEKTUR', 'Andreas', 'Utzmeier', 'Inhaber', null, null, false);

-- 38. Touchton Interiors GmbH (nochmal gemailt)
select _seed_id_company('Touchton Interiors GmbH', 'https://www.touchton-interiors.de/',
  'Ismaningerstr. 114', '81675 München',
  E'5 Maedels auf der Website; wollen A-Z anbieten, sehr schoene Projekte; Premiumobjekte zum Verkauf ueber Riedel. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('Touchton Interiors GmbH', 'Mila', 'Touchton-Weber', 'Inhaberin', 'mtw@touchton-interiors.de', '089 88 90 88 08', true);

-- 39. DiPPOLD Innenarchitektur GmbH (nochmal gemailt)
select _seed_id_company('DiPPOLD Innenarchitektur GmbH', 'https://www.dippold-innenarchitektur.com/',
  'Oskar-von-Miller-Ring 31', '80333 München',
  E'Umsetzung von A-Z, 13 Mitarbeiter, tolle Projekte. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('DiPPOLD Innenarchitektur GmbH', 'Caroline', 'Dippold', 'Inhaberin', 'cd@dippold-innenarchitektur.de', '089 28 70 21 46', true);

-- 40. malea Interior Design (TERMIN)
select _seed_id_company('malea Interior Design', 'https://www.maleadesign.de/',
  'Adalbertstraße 20', '80799 München',
  E'Einzelunternehmerin, noch nicht viel da. Termin steht.', 'in_gespraech');
select _seed_id_contact('malea Interior Design', 'Vanessa', 'Kilian', 'Inhaberin', 'meinprojekt@maleadesign.de', '0151 70861818', true);

-- 41. PURE HOMING (Reply: aktuell zu wenig zu tun)
select _seed_id_company('PURE HOMING', 'https://www.pure-homing.de/',
  'Robert-Holzer-Strasse 6', '83700 Rottach-Egern',
  E'Schwerpunkt Planung, wenig zu sehen. Hat geantwortet: aktuell zu wenig zu tun, um etwas abgeben zu koennen.', 'kontaktiert');
select _seed_id_contact('PURE HOMING', 'Sandra', 'Humbert', 'Inhaberin', 's.humbert@pure-homing.de', '0172 85 36 800', true);

-- 42. ABOUT INTERIEUR
select _seed_id_company('ABOUT INTERIEUR', 'https://aboutinterieur.de/',
  'Highlight Towers, Mies-van-der-Rohe-Straße 6', '80807 München',
  E'Frau allein, Projekte solala.', 'kontaktiert');
select _seed_id_contact('ABOUT INTERIEUR', 'Fatma', 'Yenice', 'Inhaberin', 'service@aboutinterieur.com', '01590 4831601', true);

-- 43. Stephanie Gehringer (Reply: ruft bei Bedarf zurueck)
select _seed_id_company('Stephanie Gehringer', 'https://stephanie-gehringer.com/',
  'Ismaninger Straße 126', '81675 München',
  E'Super Projekte, A-Z. Hat sich gemeldet: ruft bei Bedarf zurueck.', 'kontaktiert');
select _seed_id_contact('Stephanie Gehringer', 'Stephanie', 'Gehringer', 'Inhaberin', 'office@stephanie-gehringer.com', '089 209 297 85', true);

-- 44. raumgestöber
select _seed_id_company('raumgestöber', 'https://www.raumgestoeber.de/',
  'Lindenschmitstraße 54', '81373 München',
  E'Viel Office, etwas Privat.', 'kontaktiert');
select _seed_id_contact('raumgestöber', 'Andrea', 'Köhler', 'Inhaberin', 'info@raumgestoeber.de', '089 41 25 22 10', true);
select _seed_id_contact('raumgestöber', 'Stephan', 'Köhler', 'Inhaber', null, null, false);

-- 45. STUDIO FRICK (nochmal gemailt)
select _seed_id_company('STUDIO FRICK', 'https://studio-frick.de/',
  'Isartalstraße 44', '80469 München',
  E'Office und Privat, extrem karg, viele sehr gute Kunden, interessante Office-Partner. Nochmal gemailt.', 'kontaktiert');
select _seed_id_contact('STUDIO FRICK', 'Lilit', 'Frick', 'Inhaberin', 'info@studio-frick.de', '08954 045963', true);
select _seed_id_contact('STUDIO FRICK', 'Simon', 'Frick', 'Inhaber', null, null, false);

-- ============================================================
-- Erstkontakt-Emails (September 2025)
-- ============================================================
select _seed_id_email1('AR INTERIOR DESIGN GmbH',                      '2025-09-08 09:30+02');
select _seed_id_email1('Christine Kröncke Interior Design GmbH',       '2025-09-09 09:30+02');
select _seed_id_email1('district8 GmbH',                               '2025-09-09 14:00+02');
select _seed_id_email1('Gabriela Raible / GRI',                        '2025-09-10 09:30+02');
select _seed_id_email1('GANTER Group',                                 '2025-09-10 14:00+02');
select _seed_id_email1('HEERWAGEN Design Consulting',                  '2025-09-11 09:30+02');
select _seed_id_email1('iam interior.architects.munich',               '2025-09-11 14:00+02');
select _seed_id_email1('INpuls',                                       '2025-09-12 09:30+02');
select _seed_id_email1('Landau + Kindelbacher',                        '2025-09-22 09:30+02');
select _seed_id_email1('LOVA Design',                                  '2025-09-12 14:00+02');
select _seed_id_email1('THOMAS MANG STUDIO GMBH',                      '2025-09-15 09:30+02');
select _seed_id_email1('Mauritz Design GmbH',                          '2025-09-15 14:00+02');
select _seed_id_email1('Manuela Bross Innenarchitektur',               '2025-09-16 09:30+02');
select _seed_id_email1('CYD Innenarchitektur',                         '2025-09-16 14:00+02');
select _seed_id_email1('raumwerkstätten GmbH',                         '2025-09-17 09:30+02');
select _seed_id_email1('SEBASTIAN ZENKER INTERIOR',                    '2025-09-17 14:00+02');
select _seed_id_email1('Tredup Design.Interiors',                      '2025-09-18 09:30+02');
select _seed_id_email1('Vey Innenarchitekten',                         '2025-09-18 14:00+02');
select _seed_id_email1('Stephanie Thatenhorst Interior',               '2025-09-19 09:30+02');
select _seed_id_email1('Jørgensen Living',                             '2025-09-19 14:00+02');
select _seed_id_email1('Studio 17B',                                   '2025-09-22 14:00+02');
select _seed_id_email1('One House',                                    '2025-09-08 14:00+02');
select _seed_id_email1('MALLUVIA innenarchitektur',                    '2025-09-23 09:30+02');
select _seed_id_email1('Egetemeier Interior Design Studio',            '2025-09-23 14:00+02');
select _seed_id_email1('Kerstin Thorborg',                             '2025-09-24 09:30+02');
select _seed_id_email1('Silvia Decke',                                 '2025-09-24 14:00+02');
select _seed_id_email1('Stil und Raum',                                '2025-09-25 09:30+02');
select _seed_id_email1('freudenspiel',                                 '2025-09-25 14:00+02');
select _seed_id_email1('Möllers Interior Design',                      '2025-09-26 09:30+02');
select _seed_id_email1('Neue Werkstätten',                             '2025-09-26 14:00+02');
select _seed_id_email1('eswerderaum',                                  '2025-09-29 09:30+02');
select _seed_id_email1('Larissa Lach INTERIORS',                       '2025-09-29 14:00+02');
select _seed_id_email1('Innenarchitektur Federleicht',                 '2025-09-15 11:00+02');
select _seed_id_email1('Unique Interiors GmbH',                        '2025-09-16 11:00+02');
select _seed_id_email1('MLH Innenarchitektur',                         '2025-09-17 11:00+02');
select _seed_id_email1('INSIDE STORIES',                               '2025-09-18 11:00+02');
select _seed_id_email1('MEIEREI INNENARCHITEKTUR',                     '2025-09-19 11:00+02');
select _seed_id_email1('Touchton Interiors GmbH',                      '2025-09-22 11:00+02');
select _seed_id_email1('DiPPOLD Innenarchitektur GmbH',                '2025-09-23 11:00+02');
select _seed_id_email1('malea Interior Design',                        '2025-09-24 11:00+02');
select _seed_id_email1('PURE HOMING',                                  '2025-09-25 11:00+02');
select _seed_id_email1('ABOUT INTERIEUR',                              '2025-09-26 11:00+02');
select _seed_id_email1('Stephanie Gehringer',                          '2025-09-29 11:00+02');
select _seed_id_email1('raumgestöber',                                 '2025-09-30 09:30+02');
select _seed_id_email1('STUDIO FRICK',                                 '2025-09-30 14:00+02');

-- ============================================================
-- Follow-up-Emails (Oktober 2025) fuer "nochmal gemailt"
-- ============================================================
select _seed_id_email2('HEERWAGEN Design Consulting',     '2025-10-13 09:30+02');
select _seed_id_email2('Manuela Bross Innenarchitektur',  '2025-10-14 09:30+02');
select _seed_id_email2('Stephanie Thatenhorst Interior',  '2025-10-15 09:30+02');
select _seed_id_email2('Jørgensen Living',                '2025-10-15 14:00+02');
select _seed_id_email2('Studio 17B',                      '2025-10-16 09:30+02');
select _seed_id_email2('Silvia Decke',                    '2025-10-17 09:30+02');
select _seed_id_email2('INSIDE STORIES',                  '2025-10-20 09:30+02');
select _seed_id_email2('Touchton Interiors GmbH',         '2025-10-20 14:00+02');
select _seed_id_email2('DiPPOLD Innenarchitektur GmbH',   '2025-10-21 09:30+02');
select _seed_id_email2('STUDIO FRICK',                    '2025-10-22 09:30+02');

-- ============================================================
-- Termine (September 2025) fuer "TERMIN"
-- ============================================================
select _seed_id_meeting('iam interior.architects.munich',     '2025-09-23 10:00+02', 'Kennenlern-Termin im Studio.');
select _seed_id_meeting('THOMAS MANG STUDIO GMBH',            '2025-09-24 14:00+02', 'Kennenlern-Termin.');
select _seed_id_meeting('One House',                          '2025-09-19 10:00+02', 'Kennenlern-Termin im Showroom.');
select _seed_id_meeting('Stil und Raum',                      '2025-09-30 14:00+02', 'Kennenlern-Termin in Fuerstenfeldbruck.');
select _seed_id_meeting('Innenarchitektur Federleicht',       '2025-09-26 10:00+02', 'Kennenlern-Termin.');
select _seed_id_meeting('Unique Interiors GmbH',              '2025-09-25 14:00+02', 'Kennenlern-Termin.');
select _seed_id_meeting('malea Interior Design',              '2025-09-29 10:00+02', 'Kennenlern-Termin.');

-- ============================================================
-- Inbound-Antworten fuer drei Eintraege mit konkreter Rueckmeldung
-- ============================================================
select _seed_id_inbound('Larissa Lach INTERIORS', '2025-10-02 11:00+02', 'email_received',
  'Re: Kooperationsvorschlag fuer Interior-Projekte – Baumeisterwerk',
  E'Antwort von Larissa Lach: interessiert, aber aktuell keine passenden Projekte. Meldet sich bei Bedarf.');

select _seed_id_inbound('PURE HOMING', '2025-09-30 09:30+02', 'email_received',
  'Re: Kooperationsvorschlag fuer Interior-Projekte – Baumeisterwerk',
  E'Antwort von Sandra Humbert: aktuell zu wenig zu tun, um etwas abgeben zu koennen.');

select _seed_id_inbound('Stephanie Gehringer', '2025-10-06 10:00+02', 'call',
  'Telefonat',
  E'Stephanie Gehringer hat sich telefonisch gemeldet. Ruft bei Bedarf zurueck, wenn ein passendes Projekt anliegt.');

-- ============================================================
-- Cleanup
-- ============================================================
drop function if exists _seed_id_company(text, text, text, text, text, company_status);
drop function if exists _seed_id_contact(text, text, text, text, text, text, boolean);
drop function if exists _seed_id_email1(text, timestamptz);
drop function if exists _seed_id_email2(text, timestamptz);
drop function if exists _seed_id_meeting(text, timestamptz, text);
drop function if exists _seed_id_inbound(text, timestamptz, interaction_type, text, text);
