-- Inbox-Sync, Klassifikation, Bounce-Tracking, Data-Health-Marker.
--
-- Setup-Notiz: Die Klassifikation passiert in der App (Claude-Tool-Output),
-- nicht in der DB. ai_classification ist deshalb eine freie JSONB-Spalte,
-- die je Inbound-Interaktion das Klassifikations-Ergebnis enthaelt.

-- ============================================================
-- app_user: Sync-Cursor + gewaehrte Scopes
-- ============================================================
alter table app_user
  add column if not exists gmail_last_history_id text,
  add column if not exists gmail_scopes text[];

-- ============================================================
-- interactions: Klassifikation, Bounce, hilfreiche Indizes
-- ============================================================
alter table interactions
  add column if not exists ai_classification jsonb not null default '{}'::jsonb,
  add column if not exists is_bounce boolean not null default false,
  add column if not exists bounce_reason text;

-- Idempotenter Sync: gleiche Gmail-Message-ID darf nicht doppelt landen.
create unique index if not exists interactions_gmail_message_id_uniq
  on interactions (gmail_message_id)
  where gmail_message_id is not null;

-- Schnelles Timeline-Rendering pro Unternehmen.
create index if not exists interactions_company_type_occurred_idx
  on interactions (company_id, type, occurred_at desc);

-- ============================================================
-- contacts: Data-Health (Bounce -> Email ungueltig markieren)
-- ============================================================
alter table contacts
  add column if not exists email_invalid boolean not null default false,
  add column if not exists email_invalid_since timestamptz,
  add column if not exists email_invalid_reason text;

-- ============================================================
-- recommendations: Quell-Interaktion (z.B. die Inbound-Mail, die diese
-- Reply-Empfehlung ausgeloest hat). Erlaubt der Draft-Pipeline, key_quotes
-- + Original-Auszug aus der Quelle zu lesen.
-- ============================================================
alter table recommendations
  add column if not exists source_interaction_id uuid references interactions(id) on delete set null;

-- ============================================================
-- Email-Templates fuer Reply-Empfehlungen
-- Platzhalter werden von der Claude-Draft-Pipeline ersetzt bzw. konkretisiert.
-- ============================================================
insert into email_templates (name, language, use_case, target_company_type, subject_template, body_template, ai_guidance) values
  ('inbound_reply_interest', 'de', 'inbound_reply_interest', null,
   'Re: {{ursprungsbetreff}}',
   E'Sehr geehrte/r {{contact_first_name}},\n\n' ||
   E'vielen Dank fuer Ihre Rueckmeldung - das freut mich.\n\n' ||
   E'{{kurze_bestaetigung_des_interesses_bezugnehmend_auf_quoted_excerpt}}\n\n' ||
   E'Als naechsten konkreten Schritt schlage ich vor: {{konkreter_naechster_schritt}}.\n\n' ||
   E'Mit besten Gruessen\n{{my_signature}}',
   'Antwort auf positives Interesse. Bezug auf {{quoted_excerpt}} aus der eingegangenen Mail nehmen, dann genau einen konkreten Naechsten-Schritt-Vorschlag (Termin, Materialprobe, kurzes Telefonat). Max. 140 Worte. Kein Marketing-Sprech.'),

  ('inbound_reply_rueckfrage', 'de', 'inbound_reply_rueckfrage', null,
   'Re: {{ursprungsbetreff}}',
   E'Sehr geehrte/r {{contact_first_name}},\n\n' ||
   E'danke fuer Ihre Nachfrage.\n\n' ||
   E'{{knappe_antwort_auf_konkrete_punkte_aus_quoted_excerpt}}\n\n' ||
   E'Fuer alles Weitere wuerde ich gerne ein kurzes Telefonat oder Treffen vorschlagen - so kann ich auf die Spezifika Ihres Projekts besser eingehen. Welche Woche wuerde Ihnen passen?\n\n' ||
   E'Mit besten Gruessen\n{{my_signature}}',
   'Antwort auf konkrete Rueckfrage. Die offenen Punkte aus {{quoted_excerpt}} knapp beantworten (max. 3 Saetze), dann verbindlich zum Folgegespraech einladen.'),

  ('inbound_reply_absage_reaktivierung', 'de', 'inbound_reply_absage_reaktivierung', null,
   'Vielen Dank - bis zum naechsten passenden Anlass',
   E'Sehr geehrte/r {{contact_first_name}},\n\n' ||
   E'vielen Dank fuer Ihre offene Rueckmeldung. Dass es aktuell nicht passt, ist absolut in Ordnung.\n\n' ||
   E'Ich melde mich gerne in 3 bis 6 Monaten unverbindlich wieder - sollte sich bei {{company_name}} bis dahin etwas in Richtung Innenausbau-Begleitung ergeben, freue ich mich auch ueber eine kurze Nachricht.\n\n' ||
   E'Mit besten Gruessen\n{{my_signature}}',
   'Dankesnachricht nach Absage. Kein erneuter Pitch, ehrliche Anerkennung, klare Tuer fuer Re-Engagement in 3-6 Monaten offenhalten. Max. 100 Worte.'),

  ('inbound_reply_ooo', 'de', 'inbound_reply_ooo', null,
   '(interner Reminder - kein Versand)',
   E'INTERNER REMINDER\n\n' ||
   E'{{contact_first_name}} ist out-of-office. Aktuell keine Antwort sinnvoll.\n\n' ||
   E'Wiedervorlage zum Ende der Abwesenheit. Bis dahin: keine Mail.',
   'Wird nur als interner Reminder verwendet, NIE versendet. Body bleibt unverandert ein interner Hinweis.'),

  ('inbound_reply_unklar', 'de', 'inbound_reply_unklar', null,
   'Re: {{ursprungsbetreff}}',
   E'Sehr geehrte/r {{contact_first_name}},\n\n' ||
   E'vielen Dank fuer Ihre Nachricht. Damit ich Ihnen so konkret wie moeglich antworten kann, eine kurze Rueckfrage:\n\n' ||
   E'{{neutrale_klarstellungsfrage_basierend_auf_quoted_excerpt}}\n\n' ||
   E'Sobald ich das weiss, komme ich mit einem konkreten Vorschlag zurueck.\n\n' ||
   E'Mit besten Gruessen\n{{my_signature}}',
   'Antwort wenn unklar, was der Absender konkret will. Eine einzige neutrale Klarstellungsfrage stellen, keine Annahmen. Max. 80 Worte.')
on conflict (name) do nothing;
