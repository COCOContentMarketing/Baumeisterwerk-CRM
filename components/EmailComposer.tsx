"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmailComposer({
  contactId,
  contactEmail,
  contactName,
  initialSubject = "",
  initialBody = "",
  recommendationId,
  onClose,
}: {
  contactId: string;
  contactEmail: string | null;
  contactName: string | null;
  initialSubject?: string;
  initialBody?: string;
  recommendationId?: string;
  onClose?: () => void;
}) {
  const hasEmail = !!contactEmail;
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [hint, setHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const router = useRouter();

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, hint }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Fehler");
      setSubject(j.subject ?? "");
      setBody(j.body ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  }

  async function sendToGmail() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/email/send-to-gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          subject,
          body,
          recommendation_id: recommendationId,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Fehler");
      setDraftUrl(j.gmailUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card space-y-3 p-6">
      <div className="text-sm text-brand-500">
        An:{" "}
        {hasEmail ? (
          <span className="text-brand-900">
            {contactName ? `${contactName} <${contactEmail}>` : contactEmail}
          </span>
        ) : (
          <span className="text-brand-900">{contactName ?? "(unbenannt)"}</span>
        )}
      </div>
      {!hasEmail && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Für diesen Kontakt ist noch keine Email-Adresse hinterlegt. Du kannst trotzdem
          einen Entwurf generieren – zum Speichern als Gmail-Entwurf bitte zuerst die{" "}
          <a href={`/contacts/${contactId}`} className="font-medium underline">
            Email-Adresse beim Kontakt
          </a>{" "}
          eintragen.
        </div>
      )}

      <div>
        <label className="label">Hinweis für KI (optional)</label>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="input"
          placeholder="z. B. Nachfass nach Messe; Materialprobe anbieten…"
        />
      </div>

      <button onClick={generate} disabled={generating} className="btn-secondary">
        {generating ? "Generiere…" : "✨ Mit Claude entwerfen"}
      </button>

      <div>
        <label className="label">Betreff</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Text</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="input min-h-[260px] font-sans"
        />
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      {draftUrl ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
          ✅ Entwurf in Gmail angelegt.{" "}
          <a href={draftUrl} target="_blank" className="font-medium underline">
            In Gmail öffnen
          </a>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          {onClose && (
            <button onClick={onClose} className="btn-ghost">
              Schließen
            </button>
          )}
          <button
            onClick={sendToGmail}
            disabled={sending || !hasEmail || !subject.trim() || !body.trim()}
            className="btn-primary"
            title={!hasEmail ? "Empfänger-Email beim Kontakt fehlt" : undefined}
          >
            {sending ? "Lege an…" : "→ Als Gmail-Entwurf speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
