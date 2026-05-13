import { formatDateTime } from "@/lib/format";
import type { Contact, Interaction, InteractionType } from "@/types/db";
import { isReplyClassification } from "@/types/classification";

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

const INTENT_LABELS: Record<string, string> = {
  interesse: "Interesse",
  rueckfrage: "Rueckfrage",
  absage: "Absage",
  ooo: "Abwesend",
  unklar: "Unklar",
};

const INTENT_STYLES: Record<string, string> = {
  interesse: "bg-emerald-100 text-emerald-900",
  rueckfrage: "bg-sky-100 text-sky-900",
  absage: "bg-slate-100 text-slate-700",
  ooo: "bg-amber-100 text-amber-900",
  unklar: "bg-violet-100 text-violet-900",
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
        const inbound = it.direction === "inbound";
        const isInboundEmail = it.type === "email_received" && !it.is_bounce;
        const classification =
          isInboundEmail && isReplyClassification(it.ai_classification)
            ? it.ai_classification
            : null;
        return (
          <li key={it.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm ${
                outbound
                  ? "border-brand-200 bg-brand-50 text-brand-900"
                  : inbound
                    ? "border-l-4 border-l-sky-400 border-sky-200 bg-sky-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-brand-500">
                <span>{ICONS[it.type]}</span>
                <span className="font-medium">{LABELS[it.type]}</span>
                {it.is_bounce && (
                  <span className="chip bg-rose-100 text-rose-900">Bounce</span>
                )}
                {isInboundEmail && (
                  <span className="chip bg-sky-200 text-sky-900">Antwort erhalten</span>
                )}
                {classification && (
                  <span
                    className={`chip ${
                      INTENT_STYLES[classification.intent] ?? "bg-brand-100 text-brand-900"
                    }`}
                  >
                    {INTENT_LABELS[classification.intent] ?? classification.intent}
                  </span>
                )}
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
