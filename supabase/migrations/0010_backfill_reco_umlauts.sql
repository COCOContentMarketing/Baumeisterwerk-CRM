-- Backfill: ASCII-Ersatzformen (ae/oe/ue/ss) in bereits gespeicherten
-- Recommendations auf echte Umlaute korrigieren.
-- ----------------------------------------------------------------
-- Betrifft recommendations.title und recommendations.reason. Quellen der
-- ASCII-Formen: aeltere Engine-Strings (vor diesem PR) und AI-generierte
-- Recos, die den frueheren ASCII-Prompt-Stil gespiegelt haben.
--
-- WICHTIG: KEINE pauschale ae->ae-Ersetzung - das wuerde englische
-- Woerter wie "Email" zerstoeren. Es werden ausschliesslich klar
-- definierte Wort-Stems ersetzt. Diese Liste ist identisch mit
-- UMLAUT_REPLACEMENTS in lib/recommendations/umlauts.ts (TS-Twin fuer
-- Unit-Tests) - beide muessen synchron gehalten werden.
--
-- Idempotent: jede Zielform enthaelt den Such-Stem nicht mehr, ein
-- zweiter Lauf der Migration ist ein No-op. Die WHERE-Klausel haelt das
-- UPDATE auf betroffene Zeilen begrenzt (case-insensitive Detektion;
-- die Ersetzung selbst bleibt case-sensitiv).

update recommendations set
  title = replace(replace(replace(replace(replace(replace(replace(replace(replace(
          replace(replace(replace(replace(replace(replace(replace(replace(replace(
          replace(replace(replace(replace(replace(replace(
            title,
            'persoenlich', 'persönlich'),
            'Persoenlich', 'Persönlich'),
            'Aufhaenger', 'Aufhänger'),
            'aufhaenger', 'aufhänger'),
            'fuer', 'für'),
            'Fuer', 'Für'),
            'ueber', 'über'),
            'Ueber', 'Über'),
            'Rueck', 'Rück'),
            'rueck', 'rück'),
            'Naechst', 'Nächst'),
            'naechst', 'nächst'),
            'Bestaetigung', 'Bestätigung'),
            'bestaetigung', 'bestätigung'),
            'Prioritaet', 'Priorität'),
            'prioritaet', 'priorität'),
            'Anstossen', 'Anstoßen'),
            'anstossen', 'anstoßen'),
            'Gespraech', 'Gespräch'),
            'gespraech', 'gespräch'),
            'Tonalitaet', 'Tonalität'),
            'tonalitaet', 'tonalität'),
            'Loesung', 'Lösung'),
            'loesung', 'lösung')
where title ~* '(persoenlich|aufhaenger|fuer|ueber|rueck|naechst|bestaetigung|prioritaet|anstossen|gespraech|tonalitaet|loesung)';

update recommendations set
  reason = replace(replace(replace(replace(replace(replace(replace(replace(replace(
           replace(replace(replace(replace(replace(replace(replace(replace(replace(
           replace(replace(replace(replace(replace(replace(
            reason,
            'persoenlich', 'persönlich'),
            'Persoenlich', 'Persönlich'),
            'Aufhaenger', 'Aufhänger'),
            'aufhaenger', 'aufhänger'),
            'fuer', 'für'),
            'Fuer', 'Für'),
            'ueber', 'über'),
            'Ueber', 'Über'),
            'Rueck', 'Rück'),
            'rueck', 'rück'),
            'Naechst', 'Nächst'),
            'naechst', 'nächst'),
            'Bestaetigung', 'Bestätigung'),
            'bestaetigung', 'bestätigung'),
            'Prioritaet', 'Priorität'),
            'prioritaet', 'priorität'),
            'Anstossen', 'Anstoßen'),
            'anstossen', 'anstoßen'),
            'Gespraech', 'Gespräch'),
            'gespraech', 'gespräch'),
            'Tonalitaet', 'Tonalität'),
            'tonalitaet', 'tonalität'),
            'Loesung', 'Lösung'),
            'loesung', 'lösung')
where reason is not null
  and reason ~* '(persoenlich|aufhaenger|fuer|ueber|rueck|naechst|bestaetigung|prioritaet|anstossen|gespraech|tonalitaet|loesung)';
