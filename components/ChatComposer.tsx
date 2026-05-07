"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logInteraction } from "@/lib/db/mutations";
import type { Contact, InteractionType } from "@/types/db";

const TYPES: { value: InteractionType; label: string; emoji: string }[] = [
  { value: "note", label: "Notiz", emoji: "📝" },
  { value: "call", label: "Telefonat", emoji: "📞" },
  { value: "meeting", label: "Termin", emoji: "🤝" },
  { value: "email_sent", label: "Email gesendet", emoji: "📤" },
  { value: "email_received", label: "Email empfangen", emoji: "📥" },
];

export function ChatComposer({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}) {
  const [type, setType] = useState<InteractionType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim() && !subject.trim()) return;
    start(async () => {
      await logInteraction({
        company_id: companyId,
        contact_id: contactId || null,
        type,
        subject: subject.trim() || null,
        body: body.trim() || null,
      });
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`chip ${
              type === t.value ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-700"
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        ))}
        {contacts.length > 0 && (
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="ml-auto rounded-md border border-brand-200 bg-white px-2 py-1 text-xs"
          >
            <option value="">Keine Person</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email || "(unbenannt)"}
              </option>
            ))}
          </select>
        )}
      </div>
      {(type === "email_sent" || type === "email_received") && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Betreff"
          className="input mb-2"
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          type === "call"
            ? "Was wurde besprochen?"
            : type === "meeting"
              ? "Inhalte und nächste Schritte…"
              : type === "note"
                ? "Kurze Notiz…"
                : "Inhalt der Nachricht…"
        }
        className="input min-h-[80px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-brand-500">
        <span>⌘/Ctrl+Enter zum Absenden</span>
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending ? "Speichere…" : "Eintragen"}
        </button>
      </div>
    </div>
  );
}
