import Link from "next/link";
import type { InboxItem } from "@/lib/db/queries";
import { PriorityBadge } from "@/components/PriorityBadge";
import { isReplyClassification } from "@/types/classification";

function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function snippetFromMetadata(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const s = (meta as { snippet?: unknown }).snippet;
  return typeof s === "string" ? s : null;
}

const INTENT_LABEL: Record<string, string> = {
  interesse: "Interesse",
  rueckfrage: "Rueckfrage",
  absage: "Absage",
  ooo: "Abwesend",
  unklar: "Unklar",
};
const INTENT_STYLE: Record<string, string> = {
  interesse: "bg-emerald-100 text-emerald-900",
  rueckfrage: "bg-sky-100 text-sky-900",
  absage: "bg-slate-100 text-slate-700",
  ooo: "bg-amber-100 text-amber-900",
  unklar: "bg-violet-100 text-violet-900",
};

export function InboxRow({ item }: { item: InboxItem }) {
  const contactName = item.contact?.full_name ?? null;
  const contactEmail = item.contact?.email ?? null;
  const companyName = item.company?.name ?? null;
  const snippet = snippetFromMetadata(item.metadata) ?? (item.body ?? "").slice(0, 200);
  const cls = isReplyClassification(item.ai_classification) ? item.ai_classification : null;
  const intent = cls?.intent ?? null;
  const reco = item.open_recommendation;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-brand-500">
            <span>{formatShortDateTime(item.occurred_at)}</span>
            {item.contact ? (
              <Link href={`/contacts/${item.contact.id}`} className="hover:underline">
                {contactName ?? contactEmail}
              </Link>
            ) : (
              <span>{contactEmail ?? "Unbekannt"}</span>
            )}
            {companyName && item.company && (
              <>
                <span>·</span>
                <Link href={`/companies/${item.company.id}`} className="hover:underline">
                  {companyName}
                </Link>
              </>
            )}
            {intent && (
              <span className={`chip ${INTENT_STYLE[intent] ?? "bg-brand-100 text-brand-900"}`}>
                {INTENT_LABEL[intent] ?? intent}
              </span>
            )}
            {reco && <PriorityBadge priority={reco.priority} />}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-brand-900">
            {item.subject ?? "(ohne Betreff)"}
          </div>
          {snippet && (
            <div className="mt-1 line-clamp-2 text-xs text-brand-700">{snippet}</div>
          )}
          {cls?.suggested_next_step && (
            <div className="mt-2 text-xs text-brand-500">
              Vorgeschlagener Schritt: {cls.suggested_next_step}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reco ? (
            <Link href={`/recommendations/${reco.id}`} className="btn-primary">
              Empfehlung oeffnen
            </Link>
          ) : (
            <span className="text-xs text-brand-500" title="Noch keine offene Empfehlung">
              keine offene Aktion
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
