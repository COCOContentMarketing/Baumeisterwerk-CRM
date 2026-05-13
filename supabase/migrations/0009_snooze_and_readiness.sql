-- Snooze fuer Empfehlungen.
-- ----------------------------------------------------------------
-- snoozed_until: solange in der Zukunft, wird die Empfehlung im
-- Dashboard nicht in der "Bereit"-Liste angezeigt, sondern in "Wartend".
-- Liegt der Wert in der Vergangenheit oder ist null, gilt die Empfehlung
-- wieder als bereit (Readiness wird in der App berechnet, nicht in der DB).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.

alter table recommendations
  add column if not exists snoozed_until timestamptz;

-- Partial-Index: laesst leeren snoozed_until aus, beschleunigt die
-- Wartend-Filter-Abfrage im Dashboard.
create index if not exists recommendations_snoozed_until_idx
  on recommendations(snoozed_until)
  where snoozed_until is not null;
