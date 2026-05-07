# Baumeisterwerk CRM

Single-User CRM für Baumeisterwerk: Kontakte (Interior Designer, Handwerker, Hotels,
Makler, Relocation Services …) verwalten, Kommunikation tracken und mit Hilfe von
Claude individuelle Email-Entwürfe direkt in Gmail anlegen.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind)
- **Supabase** (Postgres + Auth-Optional, Service Role für Server-Mutations)
- **Anthropic Claude** (Sonnet 4.6) für Email-Drafts, Telefonat-Briefings und
  proaktive Empfehlungen
- **Gmail API** (OAuth) – legt Entwürfe an, sendet nichts automatisch

## Funktionen

- 📋 Übersicht über Unternehmen + Detailseite mit Kontaktpersonen
- 👤 Kontakt-Detailseite mit **Chat-Style Timeline** (Email, Telefonat, Termin, Notiz)
- ✏️ Email-Composer: Claude entwirft, du redigierst, das Tool legt Gmail-Draft an
- 📞 Telefonat-Briefing: Ziel, Kernaussagen, Fragen, Einwände
- 🔔 Proaktive Empfehlungen mit Begründung und Fälligkeitsdatum
- ✍️ Manuelles Erfassen von persönlichen Treffen, Telefonaten, Notizen

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen

- Auf <https://supabase.com> ein neues Projekt erstellen.
- SQL-Editor öffnen und `supabase/migrations/0001_init.sql` ausführen.
- Optional: `supabase/seed.sql` für einen Standard-User einspielen.
- **Settings → API**: `Project URL`, `anon public key` und `service_role key`
  notieren.

### 3. Google OAuth (Gmail) einrichten

1. <https://console.cloud.google.com> → neues Projekt
2. **APIs & Services → OAuth consent screen** → External, App-Name
   „Baumeisterwerk CRM", Scope `gmail.compose` und `userinfo.email`,
   Testbenutzer: deine eigene Email.
3. **APIs & Services → Credentials → Create OAuth Client ID** → Web application
   - Authorized redirect URI: `http://localhost:3000/api/gmail/callback`
   - Bei Production: `https://<dein-host>/api/gmail/callback`
4. Client ID + Secret in `.env.local` eintragen.

### 4. Anthropic API-Key

- <https://console.anthropic.com> → API Keys → neuen Key erstellen
- In `.env.local` als `ANTHROPIC_API_KEY` eintragen.

### 5. Environment-Variablen

`.env.example` nach `.env.local` kopieren und ausfüllen:

```bash
cp .env.example .env.local
```

### 6. Dev-Server starten

```bash
npm run dev
```

Im Browser <http://localhost:3000> öffnen, dann:

1. **Einstellungen** → Profil ausfüllen, Signatur eintragen.
2. **Einstellungen** → „Mit Gmail verbinden" klicken (OAuth-Flow).
3. **Unternehmen** → erstes Unternehmen anlegen.
4. Auf der Unternehmensseite Kontaktpersonen hinzufügen.
5. **Dashboard** → „Empfehlungen generieren" → Claude erzeugt Empfehlungen.

## Wie es funktioniert

### Email-Workflow

```
Empfehlung anklicken → "Mit Claude entwerfen" → redigieren →
"Als Gmail-Entwurf speichern" → Draft erscheint in Gmail →
manuell prüfen und absenden
```

Sobald der Draft angelegt ist, wird der Vorgang als `email_draft`-Interaktion
in der Timeline des Kontakts protokolliert.

### Datenmodell

- `companies` – Zielunternehmen (Typ, Status, Priorität)
- `contacts` – Personen pro Unternehmen
- `interactions` – Timeline-Einträge (Email, Anruf, Termin, Notiz)
- `recommendations` – Vorschläge der KI mit Begründung und Fälligkeit

### Mit Claude generieren

Drei Endpunkte nutzen Claude:

- `POST /api/recommendations/generate` – iteriert über Unternehmen + Kontakte,
  liefert priorisierte nächste Schritte
- `POST /api/email/draft` – Email basierend auf Kontakt-Kontext und Historie
- `POST /api/call/briefing` – Vorbereitung für ein Telefonat

Der Baumeisterwerk-Hintergrund-Prompt wird mit `cache_control: ephemeral`
gecacht, sodass nachfolgende Aufrufe günstiger werden.

## Deployment

- **Vercel** ist die einfachste Option: `vercel`, ENVs eintragen.
- `GOOGLE_REDIRECT_URI` und `NEXT_PUBLIC_APP_URL` auf Production-URL
  umstellen, in der Google Cloud Console die neue Redirect-URI hinzufügen.

## Sicherheit

- Single-User: kein Auth-Layer im Frontend; bei Production hinter ein einfaches
  Passwort/Vercel-Auth oder Cloudflare Access stellen.
- Gmail-Refresh-Token liegt in `app_user.gmail_refresh_token` – wird nur über
  den Service-Role-Key gelesen (Server-Side).
- Service-Role-Key niemals in Client-Code verwenden.

## Branch-Hygiene

Entwicklung läuft auf `claude/baumeisterwerk-crm-tool-rJ1fb`.
