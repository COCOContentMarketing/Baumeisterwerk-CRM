# Baumeisterwerk CRM

Single-User CRM für Baumeisterwerk: Kontakte (Interior Designer, Handwerker, Hotels,
Makler, Relocation Services …) verwalten, Kommunikation tracken und mit Hilfe von
Claude individuelle Email-Entwürfe direkt in Gmail anlegen.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind)
- **Supabase** (Postgres + Service-Role-Key serverseitig)
- **Anthropic Claude** (Sonnet 4.6) für Email-Drafts und Telefonat-Briefings
- **Gmail API** (OAuth) — Drafts erstellen + Tagesdigest senden
- **Vercel Cron** für täglichen 8-Uhr-Digest (06:00 UTC = 08:00 CEST)

## Funktionen

- 📋 Übersicht über Unternehmen + Detailseite mit Kontaktpersonen
- 👤 Kontakt-Detailseite mit **Chat-Style Timeline**
- ✏️ Email-Composer: Claude entwirft auf Basis der Vorlagen aus DB, du redigierst, Tool legt Gmail-Draft an
- 📞 Telefonat-Briefing
- 🔔 **Deterministische B2B-Kontaktzyklen** (siehe `lib/recommendations/cadence.ts`):
  - Erstkontakt → 1. Follow-up nach 8 Tagen → 2. Follow-up nach weiteren 14 Tagen → Pause → Re-Engagement nach 90 Tagen
  - Termin: 48 h Dank → 7 Tage substanzieller Follow-up
  - Bestandskunden: 30-Tage-Touchbase
  - Inbound unbeantwortet > 4 h → höchste Priorität
- 📨 **Tägliche Digest-Email** an `mb@baumeisterwerk.de` um 08:00 Berlin-Zeit (im Sommer; im Winter 07:00) mit allen Aktionen für heute
- 🌱 Vorbefüllt mit **40+ Maklern und Relocation Services** aus der Recherche, sortiert nach Priorität, plus Anschreiben-Template

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen + Migrationen ausführen

- Auf <https://supabase.com> ein neues Projekt erstellen.
- SQL-Editor öffnen und **in dieser Reihenfolge** ausführen:
  1. `supabase/migrations/0001_init.sql` — Schema
  2. `supabase/migrations/0002_templates_and_digest.sql` — Email-Templates + Digest-Spalten
  3. `supabase/migrations/0003_seed_makler.sql` — Seed: 40+ Makler/Relocation + Anschreiben-Template
- **Settings → API**: `Project URL` (Form: `https://xxx.supabase.co` — **kein** `/rest/v1`!), `anon public key` und `service_role key` notieren.

### 3. Google OAuth (Gmail) einrichten

1. <https://console.cloud.google.com> → neues Projekt
2. **APIs & Services → OAuth consent screen** → External, Scopes:
   - `https://www.googleapis.com/auth/gmail.compose` (Drafts erstellen)
   - `https://www.googleapis.com/auth/gmail.send` (Daily-Digest senden)
   - `https://www.googleapis.com/auth/userinfo.email`
3. **APIs & Services → Credentials → Create OAuth Client ID** → Web application
   - Authorized redirect URI: `http://localhost:3000/api/gmail/callback` (lokal) und/oder `https://<dein-host>/api/gmail/callback` (Production)
4. Client ID + Secret in `.env.local` eintragen.

> **Wichtig:** Falls du Gmail vor Einführung des `gmail.send`-Scopes verbunden hattest,
> in `/settings` einmal trennen und neu verbinden.

### 4. Anthropic API-Key

- <https://console.anthropic.com> → API Keys → neuen Key erstellen
- In `.env.local` als `ANTHROPIC_API_KEY` eintragen.

### 5. Environment-Variablen

`.env.example` nach `.env.local` kopieren und ausfüllen:

```bash
cp .env.example .env.local
```

Auf **Vercel** musst du dieselben Env-Vars in den Project Settings hinterlegen.
**Wichtig:** `NEXT_PUBLIC_SUPABASE_URL` darf **keinen** Pfad enthalten (also kein `/rest/v1` am Ende). Falls doch, schlägt jede DB-Query mit PGRST125 „Invalid path specified in request URL" fehl.

### 6. Dev-Server starten

```bash
npm run dev
```

1. **Einstellungen** → Profil ausfüllen, Signatur eintragen, `mb@baumeisterwerk.de` als Digest-Empfänger ist bereits voreingestellt.
2. **Einstellungen** → „Mit Gmail verbinden".
3. **Dashboard** → die 40+ Makler stehen schon da, jeder mit einer offenen „Erstkontakt-Email"-Empfehlung.

## Daily Digest

### Wie es funktioniert

- Vercel Cron triggert um **06:00 UTC** täglich (= 08:00 CEST im Sommer, 07:00 CET im Winter) den Endpoint `/api/cron/daily-digest`.
- Die Cadence-Engine (`lib/recommendations/cadence.ts`) wertet alle Kontakte gegen die B2B-Zyklen aus und persistiert offene Empfehlungen.
- Der Digest wird via Gmail-API (verbundener Account) an die Adresse aus `app_user.digest_email` gesendet.

### Konfiguration

- `vercel.json` enthält den Cron-Schedule. Vercel benötigt das Pro-Plan oder ein Cron-Limit-Plan.
- Setze in Vercel-Env-Vars: `CRON_SECRET=<beliebiger Token>`. Vercel-Cron schickt dann automatisch `Authorization: Bearer <CRON_SECRET>`.
- Für manuelles Testen: `curl https://<host>/api/cron/daily-digest?token=<CRON_SECRET>`.
- Empfänger ändern: `update app_user set digest_email = 'andere@email.de';`
- Digest pausieren: `update app_user set digest_enabled = false;`

### Kontaktzyklen

Definiert in `lib/recommendations/cadence.ts`:

| Trigger                                     | Aktion           | Frist  |
|---------------------------------------------|------------------|--------|
| Inbound erhalten, > 4h unbeantwortet        | Antwort senden   | sofort |
| Termin/Anruf < 48h alt                      | Danke senden     | < 48h  |
| Termin > 7 Tage alt, keine Reaktion         | Substanz-Follow-up | sofort |
| Noch keine Outbound                         | Erstkontakt      | sofort |
| 1 Outbound, > 8 Tage, keine Antwort         | 1. Follow-up     | sofort |
| 2 Outbound, > 14 Tage, keine Antwort        | 2. Follow-up     | sofort |
| 3+ Outbound, > 90 Tage Pause                | Re-Engagement    | sofort |
| Bestandskunde, > 30 Tage kein Kontakt       | Touchbase        | sofort |

## Email-Templates

Jede AI-generierte Email basiert auf einer Vorlage aus `email_templates`. Beim Generieren:

1. Use-Case wird aus dem Verlauf abgeleitet (Erstkontakt / Follow-up / Inbound-Reply / Re-Engagement / …).
2. Passende Vorlage zum Company-Type wird geladen.
3. Claude bekommt Vorlage + AI-Guidance + Kontext und generiert eine personalisierte Email.

Templates verwalten:

```sql
-- Vorlage anpassen
update email_templates set body_template = '...' where name = 'anschreiben_makler_erstkontakt';

-- Eigene Vorlage hinzufügen
insert into email_templates (name, language, use_case, target_company_type, subject_template, body_template, ai_guidance)
values ('anschreiben_hotel_erstkontakt', 'de', 'erstkontakt', 'hotel', '...', '...', '...');
```

## Datenmodell

- `companies` — Zielunternehmen (Typ, Status, Priorität, Tags)
- `contacts` — Personen pro Unternehmen, mit Sprache und `is_primary`
- `interactions` — Timeline-Einträge (Email, Anruf, Termin, Notiz)
- `recommendations` — B2B-Zyklus-Empfehlungen mit Begründung und Fälligkeit
- `email_templates` — wiederverwendbare Vorlagen für Claude
- `app_user` — Owner mit Gmail-Token, Signatur, Digest-Konfiguration

## Deployment

1. `vercel` deployen
2. Env-Vars setzen (siehe oben), inkl. `CRON_SECRET`
3. Google Cloud Console: Production-Redirect-URI hinzufügen
4. Supabase: Migrationen ausführen
5. Auf `/settings` Gmail verbinden (mit `gmail.send` Scope)

## Branch-Hygiene

Entwicklung läuft auf `claude/baumeisterwerk-crm-tool-rJ1fb`.
