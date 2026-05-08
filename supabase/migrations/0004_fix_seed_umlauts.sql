-- Repair-Migration: ersetzt ASCII-Ersatzformen durch echte Umlaute in den
-- Seed-Templates aus 0003_seed_makler.sql.
--
-- Idempotent: replace() ist no-op, wenn die Zielform schon vorhanden ist.
-- Zielfeld: nur subject_template + body_template, nur die 9 Seed-Templates.
-- Quelldatei 0003 wird bewusst NICHT angepasst (sie enthaelt absichtlich
-- ASCII-Ersatzformen, weil ein direkter UTF-8-Insert via Supabase-SQL-
-- Editor je nach Setup wieder zu Encoding-Problemen fuehren kann).
--
-- Ersetzt:
--   fuer    -> fuer wird zu fuer (Schreib-Trick: replace darf nichts kaputt machen)
--   ... siehe Statements unten.
--
-- Wort-Ersetzungen sind so gewaehlt, dass sie auch innerhalb groesserer
-- Woerter passen (z.B. 'Loesungen' wird ueber 'Loesung' getroffen).

update email_templates set
  subject_template = case when subject_template is null then null else
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(subject_template,
                  'fuer', 'für'),
                'Fuer', 'Für'),
              'Loesung', 'Lösung'),
            'Naechste', 'Nächste'),
          'naechste', 'nächste'),
        'Gespraech', 'Gespräch'),
      'gehoert', 'gehört')
  end,
  body_template = replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(body_template,
                    'fuer', 'für'),
                  'Fuer', 'Für'),
                'Loesung', 'Lösung'),
              'Naechste', 'Nächste'),
            'naechste', 'nächste'),
          'Gespraech', 'Gespräch'),
        'gehoert', 'gehört'),
      'Gehoert', 'Gehört'),
    -- typographischer Gedankenstrich: ' - ' (mit Spaces) -> ' – '
    -- (en-dash, U+2013). Wir matchen explizit auf das Pattern mit Spaces,
    -- damit Bindestriche in Zusammensetzungen wie 'Anschluss-Loesung' nicht
    -- getroffen werden.
    ' - ', ' – ')
where name in (
  'anschreiben_makler_erstkontakt',
  'anschreiben_relocation_erstkontakt',
  'follow_up_1',
  'follow_up_2',
  'inbound_reply',
  'post_meeting_thanks',
  'post_meeting_follow_up',
  'kunde_touchbase',
  're_engagement'
);
