import { formatDateTime } from "@/lib/format";
import type { Contact, Interaction, InteractionType } from "@/types/db";

const ICONS: Record<InteractionType, string> = {
  email_sent: "📤",
  email_received: "📥",
  email_draft: "✏️",
  call: "📞",
  meeting: "🤝",
  note: "📝",
  task_done: "✅",
};

const LABELS: Record<InteractionType, string> = {
  email_sent: "Email gesendet",
  email_received: "Email empfangen",
  email_draft: "Entwurf erstellt",
  call: "Telefonat",
  meeting: "Termin",
  note: "Notiz",
  task_done: "Erledigt",
};

export function Timeline({
  interactions,
  contacts,
}: {
  interactions: Interaction[];
  contacts: Contact[];
}) {
  if (interactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-brand-200 p-6 text-center text-sm text-brand-500">
        Noch keine Kommunikation. Trage unten den ersten Eintrag ein.
      </div>
    );
  }

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return (
    <ol className="space-y-3">
      {interactions.map((it) => {
        const contact = it.contact_id ? contactMap.get(it.contact_id) : null;
        const outbound = it.direction === "outbound";
        return (
          <li key={it.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm ${
                outbound
                  ? "border-brand-200 bg-brand-50 text-brand-900"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-brand-500">
                <span>{ICONS[it.type]}</span>
                <span className="font-medium">{LABELS[it.type]}</span>
                {contact && <span>· {contact.full_name || contact.email}</span>}
                <span>· {formatDateTime(it.occurred_at)}</span>
              </div>
              {it.subject && <div className="mb-1 font-medium">{it.subject}</div>}
              {it.body && <div className="whitespace-pre-wrap text-sm">{it.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
