import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ReadinessBadge } from "@/app/_components/ReadinessBadge";
import { BounceBadge } from "@/app/_components/BounceBadge";
import { SnoozeMenu } from "@/app/_components/SnoozeMenu";
import { getInteraction, getRecommendation } from "@/lib/db/queries";
import { formatDateTime, formatRelative } from "@/lib/format";
import { classifyReadiness } from "@/lib/recommendations/readiness";
import { isReplyClassification } from "@/types/classification";
import { RecommendationActions } from "./_components/RecommendationActions";

export const dynamic = "force-dynamic";

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rec = await getRecommendation(id);
  if (!rec) notFound();

  const source = rec.source_interaction_id
    ? await getInteraction(rec.source_interaction_id)
    : null;
  const classification =
    source && isReplyClassification(source.ai_classification)
      ? source.ai_classification
      : null;
  const readiness = classifyReadiness({
    recommendation: rec,
    contact: rec.contact,
    now: new Date(),
  });

  return (
    <div>
      <PageHeader
        title={rec.title}
        subtitle={
          <>
            {rec.company && (
              <Link href={`/companies/${rec.company.id}`} className="hover:underline">
                {rec.company.name}
              </Link>
            )}
            {rec.contact && (
              <>
                {" · "}
                <Link href={`/contacts/${rec.contact.id}`} className="hover:underline">
                  {rec.contact.full_name}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="chip bg-brand-100 text-brand-900">{rec.kind}</span>
            <PriorityBadge priority={rec.priority} />
            <ReadinessBadge readiness={readiness} snoozedUntil={rec.snoozed_until} />
            <SnoozeMenu recommendationId={rec.id} snoozedUntil={rec.snoozed_until} />
          </div>
        }
      />

      {rec.contact?.email_invalid && (
        <div className="card mb-4 flex items-start gap-3 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <BounceBadge
            reason={rec.contact.email_invalid_reason}
            since={rec.contact.email_invalid_since}
          />
          <div className="flex-1">
            <div className="font-medium">Email-Adresse als ungültig markiert</div>
            {rec.contact.email_invalid_reason && (
              <div className="text-xs">{rec.contact.email_invalid_reason}</div>
            )}
            <div className="mt-1 text-xs">
              Adresse von{" "}
              <Link href={`/contacts/${rec.contact.id}`} className="underline">
                {rec.contact.full_name ?? "Kontakt"}
              </Link>{" "}
              bitte zuerst korrigieren oder verifizieren.
            </div>
          </div>
        </div>
      )}

      {rec.reason && (
        <div className="card mb-4 p-4 text-sm text-brand-700">
          <span className="text-xs uppercase text-brand-500">Begründung</span>
          <div className="mt-1 whitespace-pre-wrap">{rec.reason}</div>
          {rec.due_at && (
            <div className="mt-2 text-xs text-brand-500">Fällig {formatRelative(rec.due_at)}</div>
          )}
        </div>
      )}

      {source && (
        <div className="card mb-4 p-4 text-sm text-brand-900">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase text-brand-500">
            <span>📥 Original-Email</span>
            <span>· {formatDateTime(source.occurred_at)}</span>
            {classification && (
              <span className="chip bg-sky-100 text-sky-900">
                Intent: {classification.intent}
              </span>
            )}
          </div>
          {source.subject && <div className="mb-2 font-medium">{source.subject}</div>}
          {source.body && (
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-brand-50 p-3 text-sm">
              {source.body.slice(0, 4000)}
              {source.body.length > 4000 && "\n…"}
            </div>
          )}
          {classification && classification.key_quotes.length > 0 && (
            <div className="mt-3">
              <div className="text-xs uppercase text-brand-500">Schluessel-Zitate</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-brand-700">
                {classification.key_quotes.map((q, i) => (
                  <li key={i} className="italic">&laquo;{q}&raquo;</li>
                ))}
              </ul>
            </div>
          )}
          {classification?.suggested_next_step && (
            <div className="mt-3 text-sm">
              <span className="text-xs uppercase text-brand-500">Vorgeschlagener Schritt:</span>{" "}
              {classification.suggested_next_step}
            </div>
          )}
        </div>
      )}

      <RecommendationActions
        recommendationId={rec.id}
        kind={rec.kind}
        contactId={rec.contact?.id ?? null}
        contactEmail={rec.contact?.email ?? null}
        contactName={rec.contact?.full_name ?? null}
      />
    </div>
  );
}
