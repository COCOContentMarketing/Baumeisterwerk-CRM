import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { getRecommendation } from "@/lib/db/queries";
import { formatRelative } from "@/lib/format";
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
          </div>
        }
      />

      {rec.reason && (
        <div className="card mb-4 p-4 text-sm text-brand-700">
          <span className="text-xs uppercase text-brand-500">Begründung</span>
          <div className="mt-1 whitespace-pre-wrap">{rec.reason}</div>
          {rec.due_at && (
            <div className="mt-2 text-xs text-brand-500">Fällig {formatRelative(rec.due_at)}</div>
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
